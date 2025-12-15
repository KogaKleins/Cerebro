/**
 * Points Engine - Motor Centralizado de Pontos
 * 
 * TODAS as ações que geram pontos DEVEM passar por aqui.
 * Garante auditoria, previne duplicação e mantém integridade.
 * 
 * Uso:
 * await pointsEngine.addPoints(userId, 'coffee-made', { amount: 10, reason: 'Fez café' })
 */

import { PrismaClient } from '@prisma/client';
import { Logger } from 'winston';
import { XPAuditService } from './xp-audit.service';
import { calculateLevel } from '../utils/level.utils';

export type PointSource = 'coffee-made' | 'coffee-brought' | 'achievement' | 'rating' | 'manual' | 'system-correction' | 'message' | 'reaction';

export interface PointConfig {
  amount: number;
  reason: string;
  sourceId?: string;
  metadata?: Record<string, any>;
}

export class PointsEngine {
  private auditService: XPAuditService;
  
  // 🆕 Limites diários para mensagens e reações
  private static readonly DAILY_LIMIT_MESSAGES = 10;
  private static readonly DAILY_LIMIT_REACTIONS = 10;

  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {
    this.auditService = new XPAuditService(prisma, logger);
  }

  /**
   * 🆕 Verifica e atualiza limite diário para um tipo de ação
   * @param userId - ID do usuário
   * @param limitType - 'messages' ou 'reactions'
   * @returns { allowed: boolean, count: number, limit: number }
   */
  async checkAndUpdateDailyLimit(
    userId: string,
    limitType: 'messages' | 'reactions'
  ): Promise<{ allowed: boolean; count: number; limit: number }> {
    const limit = limitType === 'messages' 
      ? PointsEngine.DAILY_LIMIT_MESSAGES 
      : PointsEngine.DAILY_LIMIT_REACTIONS;

    // Buscar userLevel
    let userLevel = await this.prisma.userLevel.findUnique({
      where: { userId }
    });

    // Se não existe, criar
    if (!userLevel) {
      userLevel = await this.prisma.userLevel.create({
        data: {
          userId,
          totalXP: 0,
          level: 1,
          dailyLimits: {
            messages: { count: 0, date: null },
            reactions: { count: 0, date: null }
          }
        }
      });
    }

    const dailyLimits = (userLevel.dailyLimits as any) || {
      messages: { count: 0, date: null },
      reactions: { count: 0, date: null }
    };

    const today = new Date().toDateString();
    const limitData = dailyLimits[limitType] || { count: 0, date: null };

    // Resetar contador se for um novo dia
    if (limitData.date !== today) {
      limitData.count = 0;
      limitData.date = today;
    }

    // Verificar se atingiu o limite
    if (limitData.count >= limit) {
      this.logger.debug(`Limite diário de ${limitType} atingido para ${userId}`, {
        count: limitData.count,
        limit
      });
      return { allowed: false, count: limitData.count, limit };
    }

    // Incrementar e atualizar
    limitData.count++;
    dailyLimits[limitType] = limitData;

    await this.prisma.userLevel.update({
      where: { userId },
      data: {
        dailyLimits
      }
    });

    this.logger.debug(`Limite diário de ${limitType} atualizado`, {
      userId,
      count: limitData.count,
      limit
    });

    return { allowed: true, count: limitData.count, limit };
  }

  /**
   * PONTO DE ENTRADA CENTRALIZADO
   * Adicionar pontos de forma segura com auditoria
   */
  async addPoints(
    userId: string,
    source: PointSource,
    config: PointConfig
  ): Promise<{
    success: boolean;
    message: string;
    newBalance: number;
    level: number;
    auditId: string;
  }> {
    try {
      // 1. Validar usuário
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error(`Usuário ${userId} não encontrado`);
      }

      // 2. Validar montante
      if (config.amount <= 0) {
        throw new Error(`Montante deve ser maior que 0, recebido: ${config.amount}`);
      }

      // 3. Registrar transação através do audit service
      const audit = await this.auditService.recordTransaction({
        userId,
        username: user.username,
        amount: config.amount,
        reason: config.reason,
        source,
        sourceId: config.sourceId,
        metadata: config.metadata,
        timestamp: new Date()
      });

      // 4. Obter novo saldo
      const userLevel = await this.prisma.userLevel.findUnique({
        where: { userId }
      });

      this.logger.info('Pontos adicionados com sucesso', {
        userId: user.username,
        source,
        amount: config.amount,
        newBalance: userLevel?.totalXP,
        level: userLevel?.level,
        auditId: audit.id
      });

      return {
        success: true,
        message: `${config.amount} pontos adicionados: ${config.reason}`,
        newBalance: userLevel?.totalXP || 0,
        level: userLevel?.level || 1,
        auditId: audit.id
      };
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos', {
        userId,
        source,
        config,
        error
      });

      throw error;
    }
  }

  /**
   * Adicionar pontos por café feito
   * 🔧 CORREÇÃO: Buscar valor do xp-config centralizado, não de chave separada
   */
  async addCoffeeMadePoints(userId: string, coffeeId: string): Promise<any> {
    try {
      // 🔧 CORREÇÃO: Buscar da config centralizada (xp-config)
      const xpConfigSetting = await this.prisma.setting.findUnique({
        where: { key: 'xp-config' }
      });

      // Default: 50 XP (sincronizado com DEFAULT_XP_ACTIONS)
      let xpAmount = 50;
      
      if (xpConfigSetting && xpConfigSetting.value) {
        const config = xpConfigSetting.value as Record<string, { xp: number }>;
        if (config['coffee-made'] && typeof config['coffee-made'].xp === 'number') {
          xpAmount = config['coffee-made'].xp;
        }
      }

      return await this.addPoints(userId, 'coffee-made', {
        amount: xpAmount,
        reason: 'Fez um café',
        sourceId: coffeeId
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos de café feito', { userId, coffeeId, error });
      throw error;
    }
  }

  /**
   * Adicionar pontos por café trazido
   * 🔧 CORREÇÃO: Buscar valor do xp-config centralizado
   */
  async addCoffeeBroughtPoints(userId: string, coffeeId: string): Promise<any> {
    try {
      // 🔧 CORREÇÃO: Buscar da config centralizada (xp-config)
      const xpConfigSetting = await this.prisma.setting.findUnique({
        where: { key: 'xp-config' }
      });

      // Default: 75 XP (sincronizado com DEFAULT_XP_ACTIONS)
      let xpAmount = 75;
      
      if (xpConfigSetting && xpConfigSetting.value) {
        const config = xpConfigSetting.value as Record<string, { xp: number }>;
        if (config['coffee-brought'] && typeof config['coffee-brought'].xp === 'number') {
          xpAmount = config['coffee-brought'].xp;
        }
      }

      return await this.addPoints(userId, 'coffee-brought', {
        amount: xpAmount,
        reason: 'Trouxe um café',
        sourceId: coffeeId
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos de café trazido', { userId, coffeeId, error });
      throw error;
    }
  }

  /**
   * Adicionar pontos por conquista desbloqueada
   * 🔧 CORREÇÃO: Buscar XP da configuração do banco (xp-config)
   * 🔧 CORREÇÃO: Sincronizado com DEFAULT_XP_ACTIONS
   */
  async addAchievementPoints(
    userId: string,
    achievementType: string,
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'platinum'
  ): Promise<any> {
    try {
      // 🆕 BUSCAR XP DA CONFIGURAÇÃO DO BANCO
      const xpConfigSetting = await this.prisma.setting.findUnique({
        where: { key: 'xp-config' }
      });

      // 🔧 CORREÇÃO: Defaults sincronizados com DEFAULT_XP_ACTIONS (src/utils/xp.actions.ts)
      const defaultRarityXP: Record<string, number> = {
        common: 25,      // achievement-common
        uncommon: 35,    // intermediário
        rare: 50,        // achievement-rare
        epic: 100,       // achievement-epic
        legendary: 200,  // achievement-legendary
        platinum: 500    // achievement-platinum
      };

      let amount = defaultRarityXP[rarity] || 25;

      // Se existe configuração, usar valores do banco
      if (xpConfigSetting && xpConfigSetting.value) {
        const config = xpConfigSetting.value as Record<string, { xp: number }>;
        const configKey = `achievement-${rarity}`;
        if (config[configKey] && typeof config[configKey].xp === 'number') {
          amount = config[configKey].xp;
        }
      }

      this.logger.info('🏆 Creditando XP de conquista', {
        userId,
        achievementType,
        rarity,
        amount
      });

      return await this.addPoints(userId, 'achievement', {
        amount,
        reason: `Desbloqueou conquista: ${achievementType} (${rarity})`,
        sourceId: achievementType,
        metadata: { achievementType, rarity }
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos de conquista', { userId, achievementType, error });
      throw error;
    }
  }

  /**
   * Adicionar pontos por reação a mensagem
   * 🆕 CORREÇÃO #3: Integrar reações de chat com Points Engine
   * 🔧 CORREÇÃO #1: sourceId agora inclui userId e reactionType para garantir unicidade
   * 🔧 CORREÇÃO #2: Verifica limite diário ANTES de dar XP
   */
  async addMessageReactionPoints(
    userId: string,
    messageId: string,
    reactionType: string
  ): Promise<any> {
    try {
      // 🆕 VERIFICAR LIMITE DIÁRIO PRIMEIRO
      const limitCheck = await this.checkAndUpdateDailyLimit(userId, 'reactions');
      if (!limitCheck.allowed) {
        this.logger.info(`Limite diário de reações atingido para ${userId}`, {
          count: limitCheck.count,
          limit: limitCheck.limit
        });
        return {
          success: false,
          message: `Limite diário de XP por reações atingido (${limitCheck.limit}/dia)`,
          limitReached: true,
          dailyCount: limitCheck.count,
          dailyLimit: limitCheck.limit
        };
      }

      // 🔧 CORREÇÃO: Buscar valor de reaction-given do xp-config
      const xpConfigSetting = await this.prisma.setting.findUnique({
        where: { key: 'xp-config' }
      });

      // Default: 3 XP (sincronizado com DEFAULT_XP_ACTIONS)
      let baseAmount = 3;
      
      if (xpConfigSetting && xpConfigSetting.value) {
        const config = xpConfigSetting.value as Record<string, { xp: number }>;
        if (config['reaction-given'] && typeof config['reaction-given'].xp === 'number') {
          baseAmount = config['reaction-given'].xp;
        }
      }

      const amount = baseAmount;

      // 🔧 CORREÇÃO #1: sourceId ÚNICO com userId + reactionType + messageId
      // Garante que o mesmo usuário reagindo 2x com emoji diferente = 2 transações
      // Garante que o mesmo usuário reagindo 2x com MESMO emoji = 1 transação (idempotente)
      const sourceId = `reaction-${messageId}-${reactionType}-${userId}`;

      return await this.addPoints(userId, 'reaction', { // 🔧 CORREÇÃO: Era 'rating', agora é 'reaction'
        amount,
        reason: `Reagiu a mensagem com ${reactionType}`,
        sourceId,
        metadata: { 
          reactionType,
          messageId
        }
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos de reação', { userId, messageId, error });
      throw error;
    }
  }

  /**
   * Adicionar pontos por RECEBER reação em mensagem
   * 🆕 CORREÇÃO #3B: Creditar autor da mensagem que recebeu reação
   * 🔧 CORREÇÃO #1: sourceId ÚNICO por reactor para evitar duplicação
   */
  async addReactionReceivedPoints(
    authorId: string,
    messageId: string,
    reactionType: string,
    reactorId: string
  ): Promise<any> {
    try {
      // 🔧 CORREÇÃO: Buscar valor de reaction-received do xp-config
      const xpConfigSetting = await this.prisma.setting.findUnique({
        where: { key: 'xp-config' }
      });

      // Default: 5 XP (sincronizado com DEFAULT_XP_ACTIONS)
      let amount = 5;
      
      if (xpConfigSetting && xpConfigSetting.value) {
        const config = xpConfigSetting.value as Record<string, { xp: number }>;
        if (config['reaction-received'] && typeof config['reaction-received'].xp === 'number') {
          amount = config['reaction-received'].xp;
        }
      }

      // 🔧 CORREÇÃO #1: sourceId ÚNICO por reactor
      // Mesmo que 10 pessoas reajam com ❤️, cada uma gera uma transação diferente (5 XP cada)
      const sourceId = `reaction-received-${messageId}-${reactionType}-${reactorId}`;

      return await this.addPoints(authorId, 'reaction', { // 🔧 CORREÇÃO: Era 'rating', agora é 'reaction'
        amount,
        reason: `Recebeu reação ${reactionType} na mensagem do chat`,
        sourceId,
        metadata: { 
          reactionType,
          reactorId,
          messageId
        }
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos de reação recebida', { authorId, messageId, error });
      throw error;
    }
  }

  /**
   * Adicionar pontos por mensagem de chat enviada
   * 🆕 PADRONIZAÇÃO: Igual ao fluxo de reações
   * 🔧 CORREÇÃO: Verifica limite diário ANTES de dar XP
   */
  async addChatMessagePoints(
    userId: string,
    messageId: string
  ): Promise<any> {
    try {
      // 🆕 VERIFICAR LIMITE DIÁRIO PRIMEIRO
      const limitCheck = await this.checkAndUpdateDailyLimit(userId, 'messages');
      if (!limitCheck.allowed) {
        this.logger.info(`Limite diário de mensagens atingido para ${userId}`, {
          count: limitCheck.count,
          limit: limitCheck.limit
        });
        return {
          success: false,
          message: `Limite diário de XP por mensagens atingido (${limitCheck.limit}/dia)`,
          limitReached: true,
          dailyCount: limitCheck.count,
          dailyLimit: limitCheck.limit
        };
      }

      // Buscar valor de message-sent do xp-config
      const xpConfigSetting = await this.prisma.setting.findUnique({
        where: { key: 'xp-config' }
      });

      // Default: 1 XP (sincronizado com DEFAULT_XP_ACTIONS)
      let amount = 1;
      
      if (xpConfigSetting && xpConfigSetting.value) {
        const config = xpConfigSetting.value as Record<string, { xp: number }>;
        if (config['message-sent'] && typeof config['message-sent'].xp === 'number') {
          amount = config['message-sent'].xp;
        }
      }

      // sourceId ÚNICO por mensagem para evitar duplicação
      const sourceId = `message-${messageId}`;

      return await this.addPoints(userId, 'message', {
        amount,
        reason: `Enviou mensagem no chat`,
        sourceId,
        metadata: { 
          messageId
        }
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar pontos de mensagem', { userId, messageId, error });
      throw error;
    }
  }

  /**
   * Remover pontos (reversal)
   */
  async removePoints(auditId: string, reason: string): Promise<void> {
    try {
      await this.auditService.reverseTransaction(auditId, reason);
      
      this.logger.warn('Pontos removidos', { auditId, reason });
    } catch (error) {
      this.logger.error('Erro ao remover pontos', { auditId, error });
      throw error;
    }
  }

  /**
   * Recalcular nível baseado em XP
   * 
   * 🔧 CORREÇÃO: Usar fórmula correta de level.utils.ts
   * Fórmula: XP necessário = 100 * (nível - 1) ^ 1.5
   * Exemplo: 9313 XP → Nível 9
   */
  async recalculateLevel(userId: string): Promise<number> {
    try {
      const userLevel = await this.prisma.userLevel.findUnique({
        where: { userId }
      });

      if (!userLevel) {
        return 1;
      }

      // 🔧 CORREÇÃO: Usar função centralizada de level.utils.ts
      const newLevel = calculateLevel(userLevel.totalXP);

      if (newLevel !== userLevel.level) {
        await this.prisma.userLevel.update({
          where: { userId },
          data: { level: newLevel }
        });

        this.logger.info('Nível recalculado', {
          userId,
          oldLevel: userLevel.level,
          newLevel,
          totalXP: userLevel.totalXP
        });
      }

      return newLevel;
    } catch (error) {
      this.logger.error('Erro ao recalcular nível', { userId, error });
      throw error;
    }
  }

  /**
   * Obter informações de pontos do usuário
   */
  async getUserPoints(userId: string): Promise<{
    userId: string;
    username: string;
    totalXP: number;
    level: number;
    nextLevelXP: number;
    progressToNextLevel: number;
    recentTransactions: any[];
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error(`Usuário ${userId} não encontrado`);
      }

      const userLevel = await this.prisma.userLevel.findUnique({
        where: { userId }
      });

      const { logs } = await this.auditService.getUserAuditHistory(userId, {
        limit: 10
      });

      const currentLevel = userLevel?.level || 1;
      const nextLevelXP = currentLevel * 100;
      const currentXP = userLevel?.totalXP || 0;
      const progressToNextLevel = Math.min(100, (currentXP / nextLevelXP) * 100);

      return {
        userId,
        username: user.username,
        totalXP: currentXP,
        level: currentLevel,
        nextLevelXP,
        progressToNextLevel: Math.round(progressToNextLevel),
        recentTransactions: logs
      };
    } catch (error) {
      this.logger.error('Erro ao obter pontos do usuário', { userId, error });
      throw error;
    }
  }

  /**
   * Validar e corrigir integridade de todos os usuários
   */
  async validateAllUsers(): Promise<{
    checked: number;
    corrected: number;
    errors: any[];
  }> {
    try {
      const allUsers = await this.prisma.userLevel.findMany();
      const errors: any[] = [];
      let corrected = 0;

      for (const userLevel of allUsers) {
        try {
          const validation = await this.auditService.validateUserBalance(userLevel.userId);

          if (!validation.isValid) {
            corrected++;
            await this.auditService.correctUserBalance(
              userLevel.userId,
              'Validação periódica do sistema'
            );
          }
        } catch (error) {
          errors.push({
            userId: userLevel.userId,
            error: (error as any).message
          });
        }
      }

      this.logger.warn('Validação de integridade concluída', {
        checked: allUsers.length,
        corrected,
        errors: errors.length
      });

      return {
        checked: allUsers.length,
        corrected,
        errors
      };
    } catch (error) {
      this.logger.error('Erro ao validar todos os usuários', error);
      throw error;
    }
  }
}

// Singleton
let pointsEngineInstance: PointsEngine | null = null;

export function getPointsEngine(prisma: PrismaClient, logger: Logger): PointsEngine {
  if (!pointsEngineInstance) {
    pointsEngineInstance = new PointsEngine(prisma, logger);
  }
  return pointsEngineInstance;
}
