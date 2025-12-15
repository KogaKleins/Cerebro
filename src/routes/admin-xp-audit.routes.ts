/**
 * Admin XP Dashboard - Painel de Controle Centralizado
 * 
 * Permite:
 * - Visualizar logs de XP por usuário
 * - Validar integridade de saldos
 * - Corrigir erros de pontuação
 * - Gerar relatórios de auditoria
 * - Reverter transações erradas
 * 
 * ✓ CORREÇÃO #3: Todas as rotas protegidas com requireAdmin
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { requireAdmin } from '../middleware/admin.middleware';
import { authenticateToken } from '../utils/auth.utils';
import { XPAuditService } from '../services/xp-audit.service';
import { getRepositories } from '../repositories';

const router = Router();
const { prisma } = getRepositories();
const auditService = new XPAuditService(prisma, logger);

/**
 * GET /api/v2/admin/xp-audit
 * Obter histórico completo de auditoria
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, username, source, limit = '50', offset = '0' } = req.query;

    if (!userId && !username) {
      return res.status(400).json({
        error: 'Forneça userId ou username para filtrar'
      });
    }

    // Encontrar userId se apenas username foi fornecido
    let targetUserId = userId as string;
    if (!targetUserId && username) {
      const user = await prisma.user.findUnique({
        where: { username: username as string }
      });
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      targetUserId = user.id;
    }

    const { logs, total } = await auditService.getUserAuditHistory(targetUserId, {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      source: source as string
    });

    // Obter saldo atual
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: targetUserId }
    });

    res.json({
      userId: targetUserId,
      username: username || logs[0]?.username,
      currentBalance: userLevel?.totalXP || 0,
      currentLevel: userLevel?.level || 1,
      totalTransactions: total,
      logs: logs.map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp,
        source: log.source,
        reason: log.reason,
        amount: log.amount,
        balanceBefore: log.balanceBefore,
        balanceAfter: log.balanceAfter,
        status: log.status,
        reversedAt: log.reversedAt,
        reversedReason: log.reversedReason,
        metadata: log.metadata
      })),
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar audit log', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/validate/:userId
 * Validar integridade do saldo de um usuário
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/validate/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const validation = await auditService.validateUserBalance(userId);
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId }
    });

    res.json({
      userId,
      username: (userLevel as any)?.username,
      validation,
      status: validation.isValid ? 'OK' : 'ERRO',
      message: validation.isValid
        ? 'Saldo está correto'
        : `Diferença detectada: ${validation.difference} XP`
    });
  } catch (error) {
    logger.error('Erro ao validar saldo', error);
    res.status(500).json({ error: 'Erro ao validar saldo' });
  }
});

/**
 * POST /api/v2/admin/xp-audit/correct/:userId
 * Corrigir saldo de um usuário
 * ✓ Protegido: apenas ADMINs
 */
router.post('/xp-audit/correct/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Forneça um motivo para a correção' });
    }

    await auditService.correctUserBalance(userId, reason);

    const validation = await auditService.validateUserBalance(userId);

    res.json({
      success: true,
      message: 'Saldo corrigido com sucesso',
      validation,
      userId
    });
  } catch (error) {
    logger.error('Erro ao corrigir saldo', error);
    res.status(500).json({ error: 'Erro ao corrigir saldo' });
  }
});

/**
 * POST /api/v2/admin/xp-audit/reverse/:auditId
 * Reverter uma transação específica
 * ✓ Protegido: apenas ADMINs
 */
router.post('/xp-audit/reverse/:auditId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { auditId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Forneça um motivo para a reversão' });
    }

    await auditService.reverseTransaction(auditId, reason);

    res.json({
      success: true,
      message: 'Transação revertida com sucesso',
      auditId
    });
  } catch (error) {
    logger.error('Erro ao reverter transação', error);
    res.status(500).json({ error: 'Erro ao reverter transação' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/report
 * Gerar relatório completo de auditoria
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/report', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, source } = req.query;

    const options: any = {};
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);
    if (source) options.source = source as string;

    const report = await auditService.generateAuditReport(options);

    // Calcular estatísticas gerais
    const totalEarned = report.reduce((sum, user) => sum + user.totalEarned, 0);
    const totalReversed = report.reduce((sum, user) => sum + user.totalReversed, 0);

    res.json({
      period: {
        startDate: options.startDate || 'Início do tempo',
        endDate: options.endDate || 'Agora'
      },
      statistics: {
        totalUsers: report.length,
        totalEarned,
        totalReversed,
        netTotal: totalEarned - totalReversed
      },
      bySource: source || 'Todas as fontes',
      users: report.map(user => ({
        userId: user.userId,
        username: user.username,
        totalEarned: user.totalEarned,
        totalReversed: user.totalReversed,
        net: user.totalEarned - user.totalReversed,
        transactionCount: user.transactions.length
      }))
    });
  } catch (error) {
    logger.error('Erro ao gerar relatório', error);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/duplicates
 * Detectar possíveis transações duplicadas
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/duplicates', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Buscar todas as transações
    const allLogs = await (prisma as any).xPAuditLog.findMany();

    // Agrupar por sourceIdentifier
    const bySource = new Map<string, any[]>();

    allLogs.forEach((log: any) => {
      const key = log.sourceIdentifier || `${log.userId}-${log.source}-${log.sourceId}`;
      if (!bySource.has(key)) {
        bySource.set(key, []);
      }
      bySource.get(key)!.push(log);
    });

    // Encontrar duplicatas
    const duplicates = Array.from(bySource.values())
      .filter(logs => logs.length > 1)
      .map(logs => ({
        sourceIdentifier: logs[0].sourceIdentifier,
        userId: logs[0].userId,
        username: logs[0].username,
        source: logs[0].source,
        count: logs.length,
        totalXP: logs.reduce((sum, log) => sum + log.amount, 0),
        logs: logs.map(log => ({
          id: log.id,
          timestamp: log.timestamp,
          amount: log.amount,
          status: log.status
        }))
      }));

    res.json({
      duplicateFound: duplicates.length > 0,
      count: duplicates.length,
      duplicates: duplicates.sort((a, b) => b.count - a.count)
    });
  } catch (error) {
    logger.error('Erro ao detectar duplicatas', error);
    res.status(500).json({ error: 'Erro ao detectar duplicatas' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/user-breakdown/:userId
 * 🆕 Breakdown COMPLETO de XP de um usuário específico
 * Mostra exatamente de onde veio cada ponto, agrupado por categoria
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/user-breakdown/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Buscar dados do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        levelData: true,
        achievements: true,
        coffeeMade: {
          include: {
            ratings: true
          }
        },
        coffeeRatings: {
          include: {
            coffee: {
              include: {
                maker: {
                  select: { name: true, username: true }
                }
              }
            }
          }
        },
        chatMessages: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar todos os logs de auditoria do usuário
    const allLogs = await prisma.xPAuditLog.findMany({
      where: { 
        userId,
        status: 'confirmed'
      },
      orderBy: { timestamp: 'desc' }
    });

    // Buscar reações que o usuário RECEBEU (em suas mensagens)
    const reactionsReceived = await prisma.messageReaction.findMany({
      where: {
        message: {
          authorId: userId
        }
      },
      include: {
        message: true
      }
    });

    // Agrupar logs por fonte
    const bySource: Record<string, {
      source: string;
      displayName: string;
      icon: string;
      totalXP: number;
      count: number;
      items: any[];
    }> = {};

    const sourceConfig: Record<string, { displayName: string; icon: string }> = {
      'coffee-made': { displayName: 'Cafés Feitos', icon: '☕' },
      'coffee-brought': { displayName: 'Cafés Trazidos', icon: '🎁' },
      'achievement': { displayName: 'Conquistas', icon: '🏆' },
      'rating': { displayName: 'Avaliações', icon: '⭐' },
      'message': { displayName: 'Mensagens', icon: '💬' },
      'reaction': { displayName: 'Reações Recebidas', icon: '👍' },
      'manual': { displayName: 'Ajuste Manual', icon: '✏️' },
      'system-correction': { displayName: 'Correção Sistema', icon: '🔧' }
    };

    // Processar logs
    allLogs.forEach((log: any) => {
      const source = log.source;
      if (!bySource[source]) {
        const config = sourceConfig[source] || { displayName: source, icon: '📦' };
        bySource[source] = {
          source,
          displayName: config.displayName,
          icon: config.icon,
          totalXP: 0,
          count: 0,
          items: []
        };
      }

      bySource[source].totalXP += log.amount;
      bySource[source].count++;
      bySource[source].items.push({
        id: log.id,
        amount: log.amount,
        reason: log.reason,
        timestamp: log.timestamp,
        metadata: log.metadata,
        sourceId: log.sourceId
      });
    });

    // Calcular totais
    const totalXP = user.levelData?.totalXP || 0;
    const calculatedXP = Object.values(bySource).reduce((sum, src) => sum + src.totalXP, 0);

    // Ordenar itens dentro de cada categoria por timestamp (mais recente primeiro)
    Object.values(bySource).forEach(category => {
      category.items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    // Ordenar categorias por total de XP
    const sortedSources = Object.values(bySource).sort((a, b) => b.totalXP - a.totalXP);

    // Estatísticas detalhadas
    const stats = {
      totalCoffeesMade: user.coffeeMade.filter(c => c.type === 'MADE').length,
      totalCoffeesBrought: user.coffeeMade.filter(c => c.type === 'BROUGHT').length,
      totalAchievements: user.achievements.length,
      totalMessages: user.chatMessages.length,
      totalRatingsGiven: user.coffeeRatings.length,
      totalReactionsReceived: reactionsReceived.length
    };

    res.json({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        photo: user.photo || null
      },
      summary: {
        totalXP,
        calculatedXP,
        isConsistent: totalXP === calculatedXP,
        level: user.levelData?.level || 1,
        streak: user.levelData?.streak || 0,
        bestStreak: user.levelData?.bestStreak || 0
      },
      stats,
      breakdown: sortedSources,
      totalTransactions: allLogs.length,
      lastActivity: allLogs[0]?.timestamp || null
    });
  } catch (error) {
    logger.error('Erro ao gerar breakdown de usuário', error);
    res.status(500).json({ error: 'Erro ao gerar breakdown' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/all-users-breakdown
 * 🆕 Breakdown de TODOS os usuários para visão geral
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/all-users-breakdown', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Buscar todos os usuários com seus níveis
    const users = await prisma.user.findMany({
      include: {
        levelData: true,
        achievements: true
      },
      orderBy: {
        levelData: {
          totalXP: 'desc'
        }
      }
    });

    // Buscar logs agrupados por usuário e fonte
    const logsByUser = await prisma.xPAuditLog.groupBy({
      by: ['userId', 'source'],
      where: { status: 'confirmed' },
      _sum: { amount: true },
      _count: true
    });

    // Organizar dados por usuário
    const userBreakdowns = users.map(user => {
      const userLogs = logsByUser.filter((l: any) => l.userId === user.id);
      
      const breakdown: Record<string, number> = {};
      userLogs.forEach((log: any) => {
        breakdown[log.source] = log._sum.amount || 0;
      });

      return {
        userId: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        photo: user.photo || null,
        totalXP: user.levelData?.totalXP || 0,
        level: user.levelData?.level || 1,
        achievementCount: user.achievements.length,
        breakdown,
        totalTransactions: userLogs.reduce((sum: number, l: any) => sum + l._count, 0)
      };
    });

    // Estatísticas globais
    const globalStats = {
      totalUsers: users.length,
      totalXP: users.reduce((sum, u) => sum + (u.levelData?.totalXP || 0), 0),
      totalAchievements: users.reduce((sum, u) => sum + u.achievements.length, 0),
      averageXP: users.length > 0 
        ? Math.round(users.reduce((sum, u) => sum + (u.levelData?.totalXP || 0), 0) / users.length)
        : 0
    };

    res.json({
      globalStats,
      users: userBreakdowns
    });
  } catch (error) {
    logger.error('Erro ao gerar breakdown de todos usuários', error);
    res.status(500).json({ error: 'Erro ao gerar breakdown' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/detailed-logs/:userId
 * 🆕 Logs detalhados com paginação e filtros avançados
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/detailed-logs/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { 
      source, 
      startDate, 
      endDate, 
      minAmount, 
      maxAmount,
      limit = '100', 
      offset = '0',
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Construir filtros
    const where: any = { userId, status: 'confirmed' };
    
    if (source) {
      where.source = source;
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }
    
    if (minAmount || maxAmount) {
      where.amount = {};
      if (minAmount) where.amount.gte = parseInt(minAmount as string);
      if (maxAmount) where.amount.lte = parseInt(maxAmount as string);
    }

    // Buscar logs
    const logs = await prisma.xPAuditLog.findMany({
      where,
      orderBy: { [sortBy as string]: sortOrder },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    // Contar total
    const total = await prisma.xPAuditLog.count({ where });

    // Calcular estatísticas dos logs filtrados
    const stats = await prisma.xPAuditLog.aggregate({
      where,
      _sum: { amount: true },
      _avg: { amount: true },
      _min: { amount: true },
      _max: { amount: true }
    });

    // Buscar info do usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { levelData: true }
    });

    res.json({
      user: {
        id: user?.id,
        name: user?.name,
        username: user?.username,
        totalXP: user?.levelData?.totalXP || 0,
        level: user?.levelData?.level || 1
      },
      filters: {
        source: source || 'all',
        startDate: startDate || null,
        endDate: endDate || null,
        minAmount: minAmount || null,
        maxAmount: maxAmount || null
      },
      stats: {
        totalInFilter: stats._sum.amount || 0,
        averagePerTransaction: Math.round(stats._avg?.amount || 0),
        minTransaction: stats._min?.amount || 0,
        maxTransaction: stats._max?.amount || 0,
        transactionCount: total
      },
      logs: logs.map((log: any) => ({
        id: log.id,
        amount: log.amount,
        reason: log.reason,
        source: log.source,
        sourceId: log.sourceId,
        timestamp: log.timestamp,
        balanceBefore: log.balanceBefore,
        balanceAfter: log.balanceAfter,
        metadata: log.metadata
      })),
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total,
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total
      }
    });
  } catch (error) {
    logger.error('Erro ao buscar logs detalhados', error);
    res.status(500).json({ error: 'Erro ao buscar logs' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/export/:userId
 * 🆕 Exportar dados de XP de um usuário (formato JSON completo)
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/export/:userId', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        levelData: true,
        achievements: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const allLogs = await prisma.xPAuditLog.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' }
    });

    res.json({
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        createdAt: user.createdAt
      },
      levelData: user.levelData,
      achievements: user.achievements,
      transactionHistory: allLogs,
      summary: {
        totalTransactions: allLogs.length,
        totalXPEarned: allLogs.filter((l: any) => l.status === 'confirmed').reduce((sum: number, l: any) => sum + l.amount, 0),
        totalXPReversed: allLogs.filter((l: any) => l.status === 'reversed').reduce((sum: number, l: any) => sum + l.amount, 0)
      }
    });
  } catch (error) {
    logger.error('Erro ao exportar dados', error);
    res.status(500).json({ error: 'Erro ao exportar' });
  }
});

/**
 * GET /api/v2/admin/xp-audit/summary
 * Resumo geral do sistema de pontuação
 * ✓ Protegido: apenas ADMINs
 */
router.get('/xp-audit/summary', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Contar usuários
    const totalUsers = await prisma.userLevel.count();

    // Somar XP total
    const xpSum = await prisma.userLevel.aggregate({
      _sum: { totalXP: true }
    });

    // Contar transações por status
    const transactionStats = await (prisma as any).xPAuditLog.groupBy({
      by: ['status'],
      _count: true
    });

    // Contar por fonte
    const bySource = await (prisma as any).xPAuditLog.groupBy({
      by: ['source'],
      _count: true,
      _sum: { amount: true }
    });

    // Usuários com maior XP - incluir dados do usuário
    const topUsers = await prisma.userLevel.findMany({
      orderBy: { totalXP: 'desc' },
      take: 10,
      select: {
        userId: true,
        totalXP: true,
        level: true,
        user: {
          select: {
            name: true,
            username: true,
            avatar: true,
            photo: true
          }
        }
      }
    });

    res.json({
      summary: {
        totalUsers,
        totalXPDistributed: xpSum._sum.totalXP || 0,
        averageXPPerUser: totalUsers > 0 ? Math.round((xpSum._sum.totalXP || 0) / totalUsers) : 0
      },
      transactions: {
        byStatus: transactionStats.reduce((acc: any, stat: any) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>)
      },
      bySource: bySource.map((item: any) => ({
        source: item.source,
        count: item._count,
        totalXP: item._sum.amount || 0
      })),
      topUsers: topUsers.map(u => ({
        userId: u.userId,
        name: u.user?.name || u.user?.username || 'Desconhecido',
        username: u.user?.username || '',
        avatar: u.user?.avatar || '',
        photo: u.user?.photo || null,
        totalXP: u.totalXP,
        level: u.level
      }))
    });
  } catch (error) {
    logger.error('Erro ao gerar resumo', error);
    res.status(500).json({ error: 'Erro ao gerar resumo' });
  }
});

export default router;
