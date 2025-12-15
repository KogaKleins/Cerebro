/**
 * 🧠 CÉREBRO - Level Routes
 * Rotas para gerenciamento de níveis e XP dos usuários
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { getRepositories } from '../repositories';
import { getPointsEngine } from '../services/points-engine.service';
import { AuthRequest } from '../types';

const router = Router();
const repos = getRepositories();

// Funções de nível movedas para utils/level.utils.ts

/**
 * GET /api/v2/levels
 * Buscar todos os dados de níveis
 */
router.get('/', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const levels = await repos.level.getAllAsObject();
    res.json(levels);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/levels/ranking
 * Buscar ranking de níveis
 */
router.get('/ranking', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const ranking = await repos.level.getRanking(limit);
    res.json(ranking);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/levels/:username
 * Buscar dados de nível de um usuário específico
 */
router.get('/:username', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const level = await repos.level.findByUsername(username);
    
    if (!level) {
      return res.json({
        xp: 0,
        level: 1,
        totalXP: 0,
        streak: 0,
        bestStreak: 0,
        lastDaily: null,
        trackedActions: { ratings: [], reactions: [], fiveStars: [] },
        history: []
      });
    }
    
    res.json({
      xp: level.xp,
      level: level.level,
      totalXP: level.totalXP,
      streak: level.streak,
      bestStreak: level.bestStreak,
      lastDaily: level.lastDaily?.toISOString() || null,
      trackedActions: level.trackedActions || { ratings: [], reactions: [], fiveStars: [] },
      history: level.history || []
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v2/levels
 * Salvar todos os dados de níveis (batch update)
 */
router.put('/', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const allData = req.body;
    
    if (!allData || typeof allData !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    const result = await repos.level.saveAll(allData);
    
    logger.info(`Níveis salvos: ${result.success} sucesso, ${result.failed.length} falhas`);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v2/levels/:username
 * Salvar dados de nível de um usuário específico
 */
router.put('/:username', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const data = req.body;
    
    // Verificar se é admin ou o próprio usuário
    if (req.user?.role !== 'ADMIN' && req.user?.username !== username) {
      return res.status(403).json({ error: 'Não autorizado a modificar dados de outro usuário' });
    }
    
    const level = await repos.level.upsertByUsername(username, data);
    
    if (!level) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    logger.debug(`Nível de ${username} atualizado`);
    res.json({ success: true, level });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/levels/:username/xp
 * Adicionar XP a um usuário (ADMIN only)
 * 🆕 CORREÇÃO #5: Usar Points Engine para auditoria automática
 */
router.post('/:username/xp', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const { amount, reason } = req.body;
    
    if (typeof amount !== 'number' || amount === 0) {
      return res.status(400).json({ error: 'O campo "amount" deve ser um número diferente de zero' });
    }
    
    // Buscar usuário
    const user = await repos.user.findByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // 🆕 CORREÇÃO #5: Usar Points Engine para registrar auditoria
    try {
      const pointsEngine = getPointsEngine(repos.prisma, logger);
      
      const result = await pointsEngine.addPoints(user.id, 'manual', {
        amount,
        reason: `${reason || 'Ajuste manual de XP'} (por ${req.user?.username || 'admin'})`,
        sourceId: `manual-${user.id}-${Date.now()}`,
        metadata: {
          adminUsername: req.user?.username,
          originalReason: reason
        }
      });

      // Recalcular conquistas após XP manual
      try {
        const { AchievementService } = await import('../services/achievement.service');
        // 🆕 Incluir ratingRepo para verificar conquistas de 5 estrelas
        const achievementService = new AchievementService(
          repos.coffee,
          repos.achievement,
          repos.level,
          repos.setting,
          repos.user,
          repos.prisma,
          repos.rating  // 🆕 CRÍTICO: Necessário para checkRatingAchievements
        );
        // Verificar AMBOS os tipos de conquistas
        await achievementService.checkCoffeeAchievements(user.id);
        await achievementService.checkRatingAchievements(user.id);
        logger.info(`Conquistas recalculadas para ${username} após XP manual`);
      } catch (achError) {
        logger.warn(`Erro ao recalcular conquistas para ${username}`, achError);
        // Continua mesmo se falhar
      }

      logger.info(`XP manual: ${amount > 0 ? '+' : ''}${amount} para ${username} por ${req.user?.username} (${reason || 'sem motivo'})`);
      
      return res.json({ 
        success: true,
        message: result.message,
        newBalance: result.newBalance,
        level: result.level,
        auditId: result.auditId
      });
    } catch (engineError) {
      logger.error('Erro ao adicionar XP via Points Engine', { username, amount, error: engineError });
      return res.status(500).json({ error: 'Erro ao adicionar XP' });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/levels/:username
 * Deletar dados de nível de um usuário (ADMIN only)
 */
router.delete('/:username', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { username } = req.params;
    const deleted = await repos.level.deleteByUsername(username);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado ou sem dados de nível' });
    }
    
    logger.info(`Dados de nível de ${username} deletados por ${req.user?.username}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/levels
 * Deletar todos os dados de níveis (ADMIN only)
 */
router.delete('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await repos.level.deleteAll();
    
    logger.warn(`Todos os dados de níveis (${count}) deletados por ${req.user?.username}`);
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
});

export { router as levelRoutes };
