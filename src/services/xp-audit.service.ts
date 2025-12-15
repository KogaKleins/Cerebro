/**
 * XP Audit Service - Sistema Centralizado de Auditoria de Pontos
 * 
 * Responsabilidades:
 * - Registrar TODA transação de XP
 * - Prevenir duplicação de pontos
 * - Permitir rastreamento completo
 * - Validar integridade de dados
 * 
 * 🛡️ ROBUSTO: Inclui retry automático para transações e tratamento de deadlocks
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Logger } from 'winston';
import { calculateLevel, calculateCurrentLevelXP } from '../utils/level.utils';

// 🛡️ Configuração de retry para transações
const MAX_TRANSACTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 100;

export interface XPTransaction {
  userId: string;
  username: string;
  amount: number;
  reason: string;
  source: string;
  sourceId?: string; // ID do café, conquista, etc
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface XPAuditLog extends XPTransaction {
  id: string;
  balanceBefore: number;
  balanceAfter: number;
  status: string; // 'pending' | 'confirmed' | 'failed' | 'reversed'
  reversedAt: Date | null | undefined;
  reversedReason: string | null | undefined;
  createdAt: Date;
}

export class XPAuditService {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  /**
   * 🛡️ Helper para executar transação com retry automático
   * Lida com deadlocks, timeouts e erros transitórios
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Verificar se é um erro retentável
        const isRetryable = this.isRetryableError(error);
        
        if (!isRetryable || attempt === MAX_TRANSACTION_RETRIES) {
          this.logger.error(`❌ ${operationName} falhou após ${attempt} tentativas`, {
            operation: operationName,
            attempt,
            error: error.message,
            code: error.code,
            isRetryable
          });
          throw error;
        }
        
        // Calcular delay com backoff exponencial + jitter
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 50;
        
        this.logger.warn(`⚠️ ${operationName} falhou (tentativa ${attempt}/${MAX_TRANSACTION_RETRIES}), retry em ${Math.round(delay)}ms`, {
          operation: operationName,
          attempt,
          error: error.message,
          code: error.code
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  /**
   * 🛡️ Verifica se o erro é retentável
   */
  private isRetryableError(error: any): boolean {
    // Códigos de erro Prisma retentáveis
    const retryablePrismaCodes = [
      'P1001', // Can't reach database server
      'P1002', // Connection timed out
      'P1008', // Operations timed out
      'P1017', // Server closed connection
      'P2024', // Timed out fetching connection
      'P2034', // Transaction failed due to write conflict or deadlock
    ];
    
    // Códigos PostgreSQL retentáveis
    const retryablePostgresCodes = [
      '40001', // Serialization failure
      '40P01', // Deadlock detected
      '57014', // Query cancelled
      '08006', // Connection failure
      '08001', // Unable to establish connection
      '08004', // Server rejected connection
    ];
    
    const code = error.code || '';
    const message = error.message || '';
    
    return retryablePrismaCodes.includes(code) ||
           retryablePostgresCodes.includes(code) ||
           message.includes('deadlock') ||
           message.includes('timeout') ||
           message.includes('connection') ||
           error instanceof Prisma.PrismaClientKnownRequestError && 
           (error.code === 'P2024' || error.code === 'P2034');
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Registrar uma transação de XP com idempotência
   * Usa sourceId para garantir que a mesma ação não resulta em duplicação
   * 🔒 CORREÇÃO: Usa transação Prisma para evitar race conditions
   * 🛡️ ROBUSTO: Retry automático para deadlocks e timeouts
   */
  async recordTransaction(transaction: XPTransaction): Promise<XPAuditLog> {
    const sourceIdentifier = this.generateSourceIdentifier(transaction);

    // 🛡️ RETRY: Executar transação com retry automático
    return await this.executeWithRetry(async () => {
      // 🔒 CORREÇÃO: Usar transação Prisma para garantir atomicidade
      return await this.prisma.$transaction(async (tx) => {
        // 1. Verificar se essa transação já foi registrada
        // 🔧 CORREÇÃO #5: Verifica tanto pelo sourceIdentifier quanto pelo sourceId
        // Isso previne duplicatas mesmo quando o formato do identifier é diferente
        // (ex: backfill usa "message-sent-{id}", sistema usa "{userId}:message:{id}")
        const existingConditions: any[] = [
          { sourceIdentifier, status: { in: ['pending', 'confirmed'] } }
        ];
        
        // Se tem sourceId, também verificar por ele (previne duplicatas de formatos diferentes)
        if (transaction.sourceId) {
          existingConditions.push({
            sourceId: transaction.sourceId,
            source: transaction.source,
            status: { in: ['pending', 'confirmed'] }
          });
        }

        const existing = await tx.xPAuditLog.findFirst({
          where: {
            userId: transaction.userId,
            OR: existingConditions
          }
        });

        if (existing) {
          this.logger.warn('Tentativa de duplicar transação de XP', {
            userId: transaction.userId,
            sourceIdentifier,
            existingId: existing.id,
            newTransaction: transaction
          });
          return existing as XPAuditLog;
        }

        // 2. Obter saldo atual
        let userLevel = await tx.userLevel.findUnique({
          where: { userId: transaction.userId }
        });

        // Se não existe, criar registro
        if (!userLevel) {
          userLevel = await tx.userLevel.create({
            data: {
              userId: transaction.userId,
              totalXP: 0,
              level: 1
            }
          });
        }

      const balanceBefore = userLevel.totalXP;
      const balanceAfter = balanceBefore + transaction.amount;

      // 3. Registrar no audit log
      const auditLog = await tx.xPAuditLog.create({
        data: {
          userId: transaction.userId,
          username: transaction.username,
          amount: transaction.amount,
          reason: transaction.reason,
          source: transaction.source,
          sourceId: transaction.sourceId,
          sourceIdentifier, // Chave única para prevenir duplicação
          metadata: transaction.metadata || {},
          balanceBefore,
          balanceAfter,
          status: 'pending',
          timestamp: transaction.timestamp
        }
      });

      // 4. Atualizar XP do usuário E RECALCULAR NÍVEL
      const newLevel = calculateLevel(balanceAfter);
      const currentLevelXP = calculateCurrentLevelXP(balanceAfter, newLevel);
      
      await tx.userLevel.update({
        where: { userId: transaction.userId },
        data: {
          totalXP: balanceAfter,
          level: newLevel,  // 🔧 CORREÇÃO: Recalcular nível sempre que XP muda
          xp: currentLevelXP, // XP dentro do nível atual
          history: {
            push: {
              type: transaction.source,
              xp: transaction.amount,
              timestamp: new Date().toISOString(),
              reason: transaction.reason,
              auditId: auditLog.id
            }
          }
        }
      });

      // 5. Confirmar transação
      const confirmed = await tx.xPAuditLog.update({
        where: { id: auditLog.id },
        data: { status: 'confirmed' }
      });

      this.logger.info('Transação XP registrada com sucesso', {
        auditId: confirmed.id,
        userId: transaction.userId,
        username: transaction.username,
        amount: transaction.amount,
        reason: transaction.reason,
        balanceBefore,
        balanceAfter
      });

      return confirmed as XPAuditLog;
      }, {
        // 🛡️ Opções da transação para robustez
        maxWait: 10000, // Esperar no máximo 10s para iniciar
        timeout: 30000, // Timeout de 30s para completar
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      });
    }, 'recordXPTransaction');
  }

  /**
   * Reverter uma transação (para corrigir erros)
   * 🛡️ ROBUSTO: Com retry automático
   */
  async reverseTransaction(auditId: string, reason: string): Promise<void> {
    return await this.executeWithRetry(async () => {
      const audit = await this.prisma.xPAuditLog.findUnique({
        where: { id: auditId }
      });

      if (!audit) {
        throw new Error(`Audit log ${auditId} não encontrado`);
      }

      if (audit.status === 'reversed') {
        throw new Error(`Transação ${auditId} já foi revertida`);
      }

      // Reverter o XP em uma transação
      await this.prisma.$transaction(async (tx) => {
        const userLevel = await tx.userLevel.findUnique({
          where: { userId: audit.userId }
        });

        if (userLevel) {
          const newTotal = Math.max(0, userLevel.totalXP - audit.amount); // Nunca negativo
          const newLevel = calculateLevel(newTotal);
          const currentLevelXP = calculateCurrentLevelXP(newTotal, newLevel);
          
          await tx.userLevel.update({
            where: { userId: audit.userId },
            data: {
              totalXP: newTotal,
              level: newLevel, // 🔧 CORREÇÃO: Recalcular nível ao reverter
              xp: currentLevelXP,
              history: {
                push: {
                  type: 'reversal',
                  xp: -audit.amount,
                  timestamp: new Date().toISOString(),
                  reason: `Reversão: ${reason}`,
                  auditId
                }
              }
            }
          });
        }

        // Marcar audit como revertido
        await tx.xPAuditLog.update({
          where: { id: auditId },
          data: {
            status: 'reversed',
            reversedAt: new Date(),
            reversedReason: reason
          }
        });
      });

      this.logger.warn('Transação XP revertida', {
        auditId,
        userId: audit.userId,
        amount: audit.amount,
        reason
      });
    }, 'reverseXPTransaction');
  }

  /**
   * Obter histórico completo de um usuário
   */
  async getUserAuditHistory(
    userId: string,
    options: { limit?: number; offset?: number; source?: string } = {}
  ): Promise<{ logs: any[]; total: number }> {
    const where: any = { userId };
    if (options.source) {
      where.source = options.source;
    }

    const logs = await this.prisma.xPAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options.limit || 50,
      skip: options.offset || 0
    });

    const total = await this.prisma.xPAuditLog.count({ where });

    return { logs, total };
  }

  /**
   * Validar integridade: recalcular saldo baseado em logs
   */
  async validateUserBalance(userId: string): Promise<{
    isValid: boolean;
    recordedBalance: number;
    calculatedBalance: number;
    difference: number;
  }> {
    const userLevel = await this.prisma.userLevel.findUnique({
      where: { userId }
    });

    if (!userLevel) {
      return {
        isValid: false,
        recordedBalance: 0,
        calculatedBalance: 0,
        difference: 0
      };
    }

    // Calcular baseado em logs confirmados
    const logs = await this.prisma.xPAuditLog.findMany({
      where: {
        userId,
        status: 'confirmed'
      },
      orderBy: { timestamp: 'asc' }
    });

    let calculatedBalance = 0;
    logs.forEach((log: any) => {
      calculatedBalance += log.amount;
    });

    const recordedBalance = userLevel.totalXP;
    const isValid = recordedBalance === calculatedBalance;
    const difference = recordedBalance - calculatedBalance;

    return {
      isValid,
      recordedBalance,
      calculatedBalance,
      difference
    };
  }

  /**
   * Corrigir saldo para o valor correto
   */
  async correctUserBalance(userId: string, auditReason: string): Promise<void> {
    const validation = await this.validateUserBalance(userId);

    if (validation.isValid) {
      this.logger.info('Saldo do usuário já está correto', { userId });
      return;
    }

    // Registrar correção como transação especial
    const correctionAmount = validation.calculatedBalance - validation.recordedBalance;

    await this.recordTransaction({
      userId,
      username: (await this.prisma.user.findUnique({ where: { id: userId } }))?.username || 'unknown',
      amount: correctionAmount,
      reason: `Correção de saldo: ${auditReason}`,
      source: 'system-correction',
      metadata: {
        before: validation.recordedBalance,
        after: validation.calculatedBalance,
        difference: validation.difference
      },
      timestamp: new Date()
    });

    this.logger.warn('Saldo do usuário corrigido', {
      userId,
      correction: correctionAmount,
      before: validation.recordedBalance,
      after: validation.calculatedBalance
    });
  }

  /**
   * Gerar relatório de auditoria por período
   */
  async generateAuditReport(options: {
    startDate?: Date;
    endDate?: Date;
    source?: string;
  } = {}): Promise<any[]> {
    const where: any = {};

    if (options.startDate || options.endDate) {
      where.timestamp = {};
      if (options.startDate) where.timestamp.gte = options.startDate;
      if (options.endDate) where.timestamp.lte = options.endDate;
    }

    if (options.source) {
      where.source = options.source;
    }

    const logs = await this.prisma.xPAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' }
    });

    // Agrupar por usuário
    const byUser = new Map<string, any>();

    logs.forEach((log: any) => {
      if (!byUser.has(log.userId)) {
        byUser.set(log.userId, {
          userId: log.userId,
          username: log.username,
          transactions: [],
          totalEarned: 0,
          totalReversed: 0
        });
      }

      const user = byUser.get(log.userId);
      user.transactions.push(log);

      if (log.status === 'confirmed') {
        user.totalEarned += Math.max(0, log.amount);
      } else if (log.status === 'reversed') {
        user.totalReversed += log.amount;
      }
    });

    return Array.from(byUser.values());
  }

  /**
   * Gerar identificador único para prevenir duplicação
   * 🆕 CORREÇÃO #4: Melhorado para suportar múltiplas reações na mesma mensagem
   * 
   * Antes: Apenas userId + source + sourceId + timestamp = falha com múltiplas reações
   * Depois: Inclui metadata para diferençar reações diferentes (emoji diferentes)
   */
  private generateSourceIdentifier(transaction: XPTransaction): string {
    const parts = [
      transaction.userId,
      transaction.source,
      transaction.sourceId || '',
      // Se há metadata com tipo de reação/ação, incluir para diferençar
      transaction.metadata?.reactionType ? `reaction-${transaction.metadata.reactionType}` : '',
      // Para reações, usar ID único de metadata se disponível
      transaction.metadata?.uniqueId ? `unique-${transaction.metadata.uniqueId}` : ''
    ].filter(p => p); // Remove strings vazias
    
    return parts.join(':');
  }
}
