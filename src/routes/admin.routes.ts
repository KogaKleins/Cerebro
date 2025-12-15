/**
 * Rotas administrativas (recalculo de níveis etc.)
 */
import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../utils/auth.utils';
import { getRepositories } from '../repositories';
import { loadAchievementRarities } from '../utils/achievements.loader';
import { calculateLevel, calculateCurrentLevelXP } from '../utils/level.utils';
import { getDefaultXPForAction } from '../utils/xp.actions';
import { getPointsEngine } from '../services/points-engine.service';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types';

const router = Router();
const repos = getRepositories();

/**
 * POST /api/v2/admin/recalculate-levels
 * Recalcula níveis baseado em TODAS as fontes de XP persistidas no DB.
 * ⚠️ CRÍTICO: NÃO remove dados - apenas recalcula XP total.
 * Apenas ADMIN.
 */
router.post('/recalculate-levels', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Carregar mapa de raridades a partir das definições frontend
    const rarityMap = await loadAchievementRarities();
    const xpConfig = await repos.setting.getXPConfig() as Record<string, any> | null;
    const users = await repos.user.findAll();
    let updated = 0;

    logger.info(`🔄 Iniciando recálculo COMPLETO de níveis para ${users.length} usuários`);

    for (const user of users) {
      // Helper para obter XP de uma ação
      const getXP = (actionKey: string, defaultValue: number): number => {
        if (xpConfig && xpConfig[actionKey] && typeof xpConfig[actionKey].xp === 'number') {
          return xpConfig[actionKey].xp;
        }
        return defaultValue;
      };

      // 1. CONQUISTAS
      const achievements = await repos.achievement.findByUser(user.id);
      const achievementEntries = achievements.map(a => ({ type: a.type, unlockedAt: a.unlockedAt }));
      let achievementsXP = 0;
      const achievementsHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      for (const ach of achievementEntries) {
        const rarity = rarityMap[ach.type] || 'common';
        const actionKey = `achievement-${rarity}`;
        const xpAmount = getXP(actionKey, getDefaultXPForAction(actionKey));
        achievementsXP += xpAmount;
        achievementsHistory.push({ action: `achievement:${ach.type}`, xp: xpAmount, timestamp: ach.unlockedAt.toISOString() });
      }

      // 2. Café feito/trazido
      const coffeeStats = await repos.coffee.getStatsByUser(user.id);
      let coffeeXP = 0;
      const coffeeHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      
      const coffeeMadeXP = getXP('coffee-made', 50);
      coffeeXP += coffeeStats.totalMade * coffeeMadeXP;
      if (coffeeStats.totalMade > 0) {
        coffeeHistory.push({ action: 'coffee-made', xp: coffeeStats.totalMade * coffeeMadeXP, timestamp: new Date().toISOString() });
      }
      
      const coffeeBroughtXP = getXP('coffee-brought', 75);
      coffeeXP += coffeeStats.totalBrought * coffeeBroughtXP;
      if (coffeeStats.totalBrought > 0) {
        coffeeHistory.push({ action: 'coffee-brought', xp: coffeeStats.totalBrought * coffeeBroughtXP, timestamp: new Date().toISOString() });
      }

      // 3. Mensagens enviadas
      const messageCount = await repos.message.countByAuthor(user.id);
      const messageXPValue = getXP('message-sent', 1);
      const messageXP = messageCount * messageXPValue;
      const messageHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      if (messageCount > 0) {
        messageHistory.push({ action: 'message-sent', xp: messageXP, timestamp: new Date().toISOString() });
      }

      // 4. Avaliações dadas
      const ratingsGiven = await repos.rating.countRatingsGivenByUser(user.id);
      const ratingXPValue = getXP('rating-given', 15);
      const ratingXP = ratingsGiven * ratingXPValue;
      const ratingHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      if (ratingsGiven > 0) {
        ratingHistory.push({ action: 'rating-given', xp: ratingXP, timestamp: new Date().toISOString() });
      }

      // 5. Avaliações 4-5 estrelas RECEBIDAS
      let ratingsReceivedXP = 0;
      const ratingsReceivedHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      const fiveStarXP = getXP('five-star-received', 30);
      const fourStarXP = getXP('four-star-received', 15);
      
      const ratingStats = await repos.rating.getRatingStatsForMaker(user.id);
      if (ratingStats.fiveStarCount > 0) {
        ratingsReceivedXP += ratingStats.fiveStarCount * fiveStarXP;
        ratingsReceivedHistory.push({ action: 'five-star-received', xp: ratingStats.fiveStarCount * fiveStarXP, timestamp: new Date().toISOString() });
      }
      
      // Contar 4 estrelas separadamente
      const fourStarCount = await repos.prisma.rating.count({
        where: {
          coffee: { makerId: user.id },
          rating: 4
        }
      });
      if (fourStarCount > 0) {
        ratingsReceivedXP += fourStarCount * fourStarXP;
        ratingsReceivedHistory.push({ action: 'four-star-received', xp: fourStarCount * fourStarXP, timestamp: new Date().toISOString() });
      }

      // 6. 🆕 Logins diários
      let loginXP = 0;
      const loginHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      const loginCount = await repos.prisma.dailyLogin.count({ where: { userId: user.id } });
      if (loginCount > 0) {
        const loginXPValue = getXP('daily-login', 10);
        loginXP = loginCount * loginXPValue;
        loginHistory.push({ action: 'daily-login', xp: loginXP, timestamp: new Date().toISOString() });
      }

      // 7. 🆕 Reações dadas e recebidas
      let reactionXP = 0;
      const reactionHistory: Array<{ action: string; xp: number; timestamp: string }> = [];
      
      const reactionsGiven = await repos.prisma.messageReaction.count({ where: { userId: user.id } });
      if (reactionsGiven > 0) {
        const reactionGivenXPValue = getXP('reaction-given', 3);
        reactionXP += reactionsGiven * reactionGivenXPValue;
        reactionHistory.push({ action: 'reaction-given', xp: reactionsGiven * reactionGivenXPValue, timestamp: new Date().toISOString() });
      }
      
      const reactionsReceived = await repos.prisma.messageReaction.count({
        where: { message: { authorId: user.id } }
      });
      if (reactionsReceived > 0) {
        const reactionReceivedXPValue = getXP('reaction-received', 5);
        reactionXP += reactionsReceived * reactionReceivedXPValue;
        reactionHistory.push({ action: 'reaction-received', xp: reactionsReceived * reactionReceivedXPValue, timestamp: new Date().toISOString() });
      }

      // 8. SOMA TOTAL E HISTÓRICO
      const totalXP = achievementsXP + coffeeXP + messageXP + ratingXP + ratingsReceivedXP + loginXP + reactionXP;
      const newLevel = calculateLevel(totalXP);
      const newLevelXP = calculateCurrentLevelXP(totalXP, newLevel);
      const fullHistory = [
        ...achievementsHistory,
        ...coffeeHistory,
        ...messageHistory,
        ...ratingHistory,
        ...ratingsReceivedHistory,
        ...loginHistory,
        ...reactionHistory
      ];

      await repos.level.upsertByUsername(user.username, {
        totalXP,
        level: newLevel,
        xp: newLevelXP,
        history: fullHistory
      });
      updated++;
      
      logger.debug(`✅ ${user.username}: ${totalXP} XP, Nível ${newLevel}`);
    }
    
    logger.info(`✅ Recálculo concluído: ${updated}/${users.length} usuários atualizados`);
    res.json({ success: true, usersProcessed: users.length, updated });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/admin/cleanup-duplicates
 * Limpar duplicações de níveis mantendo o mais alto para cada usuário
 * Apenas admin pode acessar
 */
router.post('/cleanup-duplicates', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Obter todos os usuários
    const users = await repos.user.findAll();
    
    let deleted = 0;
    let processed = 0;
    
    // Para cada usuário, verificar se há múltiplos registros de nível
    for (const user of users) {
      const userLevels = await repos.prisma.userLevel.findMany({
        where: { userId: user.id },
        orderBy: { level: 'desc' }
      });
      
      if (userLevels.length > 1) {
        processed++;
        console.log(`⚠️  ${user.username}: ${userLevels.length} registros encontrados`);
        
        // Manter o primeiro (mais alto) e deletar os outros
        const toDelete = userLevels.slice(1);
        for (const levelRecord of toDelete) {
          await repos.prisma.userLevel.delete({
            where: { id: levelRecord.id }
          });
          deleted++;
          console.log(`  ✅ Deletado: Nível ${levelRecord.level} | XP: ${levelRecord.totalXP}`);
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Limpeza concluída com sucesso',
      stats: {
        totalUsers: users.length,
        usersWithDuplicates: processed,
        recordsDeleted: deleted
      }
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/admin/check-duplicates
 * Verificar duplicações sem deletar
 */
router.get('/check-duplicates', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Obter todos os usuários
    const users = await repos.user.findAll();
    
    const duplicates: any[] = [];
    
    // Para cada usuário, verificar se há múltiplos registros
    for (const user of users) {
      const userLevels = await repos.prisma.userLevel.findMany({
        where: { userId: user.id },
        orderBy: { level: 'desc' }
      });
      
      if (userLevels.length > 1) {
        duplicates.push({
          username: user.username,
          count: userLevels.length,
          records: userLevels.map(l => ({
            level: l.level,
            xp: l.xp,
            totalXP: l.totalXP,
            updatedAt: l.updatedAt.toISOString()
          }))
        });
      }
    }
    
    res.json({
      totalUsers: users.length,
      usersWithDuplicates: duplicates.length,
      details: duplicates
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/admin/validate-integrity
 * 🆕 CORREÇÃO #6: Validar que XP total bate com soma de audit logs
 * E corrigir discrepâncias automaticamente
 */
router.post('/validate-integrity', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const users = await repos.user.findAll();
    const results: any[] = [];
    let corrected = 0;

    for (const user of users) {
      const userLevel = await repos.level.findByUserId(user.id);
      if (!userLevel) {
        results.push({
          username: user.username,
          status: 'no-data',
          totalXP: 0,
          auditSum: 0
        });
        continue;
      }

      // Somar todos os XP audit logs confirmados
      const auditLogs = await repos.prisma.xPAuditLog.findMany({
        where: {
          userId: user.id,
          status: 'confirmed'
        }
      });

      const auditSum = auditLogs.reduce((sum, log) => sum + log.amount, 0);
      const databaseTotal = userLevel.totalXP;

      if (auditSum !== databaseTotal) {
        logger.warn(`🚨 INTEGRIDADE: ${user.username} - DB: ${databaseTotal}, Auditoria: ${auditSum}`);
        
        // Corrigir para o valor de auditoria (fonte verdadeira)
        await repos.level.upsertByUsername(user.username, {
          totalXP: auditSum,
          level: calculateLevel(auditSum),
          xp: calculateCurrentLevelXP(auditSum, calculateLevel(auditSum))
        });
        
        corrected++;
        results.push({
          username: user.username,
          status: 'corrected',
          totalXPBefore: databaseTotal,
          totalXPAfter: auditSum,
          auditSum,
          discrepancy: Math.abs(databaseTotal - auditSum)
        });
      } else {
        results.push({
          username: user.username,
          status: 'ok',
          totalXP: databaseTotal,
          auditSum
        });
      }
    }

    res.json({
      success: true,
      totalUsers: users.length,
      corrected,
      details: results
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/admin/audit-logs
 * 🆕 CORREÇÃO #6: Buscar todos os audit logs de um usuário
 */
router.get('/audit-logs/:username', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = _req.params;
    const user = await repos.user.findByUsername(username);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const auditLogs = await repos.prisma.xPAuditLog.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' }
    });

    const stats = {
      totalTransactions: auditLogs.length,
      pending: auditLogs.filter(l => l.status === 'pending').length,
      confirmed: auditLogs.filter(l => l.status === 'confirmed').length,
      reversed: auditLogs.filter(l => l.status === 'reversed').length,
      totalXP: auditLogs.filter(l => l.status === 'confirmed').reduce((sum, l) => sum + l.amount, 0)
    };

    res.json({
      username,
      stats,
      logs: auditLogs.map(l => ({
        id: l.id,
        amount: l.amount,
        reason: l.reason,
        source: l.source,
        status: l.status,
        timestamp: l.timestamp.toISOString(),
        balanceBefore: l.balanceBefore,
        balanceAfter: l.balanceAfter
      }))
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/admin/xp/add
 * ✅ CORREÇÃO: Rota para admin adicionar XP manualmente
 * Usa Points Engine para garantir auditoria completa
 * 
 * Body:
 * {
 *   "username": "username_do_usuario",
 *   "amount": 100,
 *   "reason": "Bônus manual por boa comportamento"
 * }
 */
router.post('/xp/add', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username, amount, reason } = req.body;

    // Validação
    if (!username || !amount || !reason) {
      return res.status(400).json({
        error: 'Campos obrigatórios: username, amount, reason'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Amount deve ser maior que 0'
      });
    }

    // Buscar usuário
    const user = await repos.user.findByUsername(username);
    if (!user) {
      return res.status(404).json({
        error: `Usuário "${username}" não encontrado`
      });
    }

    // Adicionar XP via Points Engine
    const pointsEngine = getPointsEngine(repos.prisma, logger);
    const result = await pointsEngine.addPoints(user.id, 'manual', {
      amount: Math.floor(amount),
      reason: reason,
      metadata: {
        addedByAdmin: req.user?.username,
        adminTimestamp: new Date().toISOString()
      }
    });

    logger.info('Admin adicionou XP manualmente', {
      admin: req.user?.username,
      target: username,
      amount,
      reason,
      auditId: result.auditId
    });

    res.json({
      success: true,
      message: `${amount} XP adicionados para ${username}`,
      data: {
        userId: user.id,
        username: user.username,
        newBalance: result.newBalance,
        newLevel: result.level,
        auditId: result.auditId
      }
    });

  } catch (error) {
    logger.error('Erro ao adicionar XP manualmente', error);
    next(error);
  }
});

/**
 * POST /api/v2/admin/xp/remove
 * ✅ CORREÇÃO: Rota para admin remover XP manualmente (como penalidade)
 * 
 * Body:
 * {
 *   "username": "username_do_usuario",
 *   "amount": 50,
 *   "reason": "Penalidade por comportamento inadequado"
 * }
 */
router.post('/xp/remove', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username, amount, reason } = req.body;

    // Validação
    if (!username || !amount || !reason) {
      return res.status(400).json({
        error: 'Campos obrigatórios: username, amount, reason'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Amount deve ser maior que 0'
      });
    }

    // Buscar usuário
    const user = await repos.user.findByUsername(username);
    if (!user) {
      return res.status(404).json({
        error: `Usuário "${username}" não encontrado`
      });
    }

    // Remover XP via Points Engine (registra como transação negativa)
    const pointsEngine = getPointsEngine(repos.prisma, logger);
    const result = await pointsEngine.addPoints(user.id, 'manual', {
      amount: -Math.floor(amount), // Negativo para remover
      reason: `PENALIDADE: ${reason}`,
      metadata: {
        removedByAdmin: req.user?.username,
        adminTimestamp: new Date().toISOString(),
        penaltyReason: reason
      }
    });

    logger.warn('Admin removeu XP manualmente (penalidade)', {
      admin: req.user?.username,
      target: username,
      amount,
      reason,
      auditId: result.auditId
    });

    res.json({
      success: true,
      message: `${amount} XP removidos de ${username}`,
      data: {
        userId: user.id,
        username: user.username,
        newBalance: result.newBalance,
        newLevel: result.level,
        auditId: result.auditId
      }
    });

  } catch (error) {
    logger.error('Erro ao remover XP manualmente', error);
    next(error);
  }
});

/**
 * GET /api/v2/admin/xp/user/:username
 * ✅ CORREÇÃO: Obter informações completas de XP de um usuário
 * Inclui saldo, nível, histórico recente
 */
router.get('/xp/user/:username', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;

    const user = await repos.user.findByUsername(username);
    if (!user) {
      return res.status(404).json({
        error: `Usuário "${username}" não encontrado`
      });
    }

    const pointsEngine = getPointsEngine(repos.prisma, logger);
    const userPoints = await pointsEngine.getUserPoints(user.id);

    // Histórico recente
    const auditLogs = await repos.prisma.xPAuditLog.findMany({
      where: { userId: user.id, status: 'confirmed' },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      },
      points: {
        totalXP: userPoints.totalXP,
        level: userPoints.level,
        nextLevelXP: userPoints.nextLevelXP,
        progressToNextLevel: userPoints.progressToNextLevel,
        progressPercentage: `${userPoints.progressToNextLevel}%`
      },
      recentTransactions: auditLogs.map(log => ({
        id: log.id,
        amount: log.amount,
        reason: log.reason,
        source: log.source,
        timestamp: log.timestamp.toISOString(),
        balanceBefore: log.balanceBefore,
        balanceAfter: log.balanceAfter
      }))
    });

  } catch (error) {
    logger.error('Erro ao obter informações de XP', error);
    next(error);
  }
});

/**
 * POST /api/v2/admin/xp/reverse/:auditId
 * ✅ CORREÇÃO: Reverter uma transação específica
 * 
 * Body:
 * {
 *   "reason": "Reversão de erro - transação duplicada"
 * }
 */
router.post('/xp/reverse/:auditId', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { auditId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        error: 'Forneça um motivo para a reversão'
      });
    }

    // Buscar audit log
    const auditLog = await repos.prisma.xPAuditLog.findUnique({
      where: { id: auditId }
    });

    if (!auditLog) {
      return res.status(404).json({
        error: 'Audit log não encontrado'
      });
    }

    if (auditLog.status !== 'confirmed') {
      return res.status(400).json({
        error: `Não é possível reverter transação com status "${auditLog.status}"`
      });
    }

    // Reverter via Points Engine
    const pointsEngine = getPointsEngine(repos.prisma, logger);
    await pointsEngine.removePoints(auditId, reason);

    logger.warn('Admin reverteu transação', {
      admin: req.user?.username,
      auditId,
      userId: auditLog.userId,
      amount: auditLog.amount,
      reason
    });

    res.json({
      success: true,
      message: `Transação ${auditId} revertida com sucesso`,
      data: {
        auditId,
        userId: auditLog.userId,
        amountReversed: auditLog.amount,
        reason
      }
    });

  } catch (error) {
    logger.error('Erro ao reverter transação', error);
    next(error);
  }
});

/**
 * POST /api/v2/admin/switch-user
 * Permite que um admin faça login como outro usuário
 * ✓ Protegido: apenas ADMINs
 */
router.post('/switch-user', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        error: 'Username é obrigatório'
      });
    }

    // Buscar usuário alvo
    const targetUser = await repos.user.findByUsername(username);

    if (!targetUser) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    // Importar função de geração de token
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'cerebro-secret-key';

    // Gerar novo token para o usuário alvo
    const token = jwt.sign(
      { 
        userId: targetUser.id, 
        username: targetUser.username,
        role: targetUser.role,
        switchedBy: req.user?.username // Registrar quem fez a troca
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.warn('Admin trocou para outro usuário', {
      admin: req.user?.username,
      targetUser: targetUser.username
    });

    res.json({
      success: true,
      token,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        role: targetUser.role,
        photo: targetUser.photo
      }
    });

  } catch (error) {
    logger.error('Erro ao trocar de usuário', error);
    next(error);
  }
});

export { router as adminRoutes };
