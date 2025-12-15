/**
 * 🧠 CÉREBRO - Settings Routes
 * Rotas para configurações do sistema (XP config, etc)
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { getRepositories } from '../repositories';
import { AuthRequest } from '../types';

const router = Router();
const repos = getRepositories();

// ============================================
// ROTAS ESPECÍFICAS PARA XP CONFIG (devem vir ANTES das rotas genéricas)
// ============================================

/**
 * GET /api/v2/settings/xp/config
 * Buscar configuração de XP
 */
router.get('/xp/config', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const config = await repos.setting.getXPConfig();
    res.json(config || {});
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v2/settings/xp/config
 * Salvar configuração de XP (apenas ADMIN)
 */
router.put('/xp/config', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'O campo "config" é obrigatório e deve ser um objeto' });
    }
    const setting = await repos.setting.saveXPConfig(config, req.user?.username);
    logger.info(`XP Config atualizado por ${req.user?.username}`);

    // Recalcular níveis e XP de todos usuários após alteração da config
    try {
      // Instanciar AchievementService com TODOS os repositórios necessários para recálculo completo
      const achievementService = new (require('../services/achievement.service').AchievementService)(
        repos.coffee,
        repos.achievement,
        repos.level,
        repos.setting,
        repos.user,
        repos.prisma,   // 🔧 FIX: Prisma para mensagens, reações e logins
        repos.rating    // 🔧 FIX: Rating para avaliações dadas/recebidas
      );
      const users = await repos.user.findAll();
      
      // Recalcular XP retroativo para TODOS os usuários
      for (const user of users) {
        await achievementService.recalculateUserXP(user.id);
      }
      logger.info('Recalculo completo de XP concluído para todos usuários após alteração de XP config');
    } catch (recalcError) {
      logger.error('Erro ao recalcular níveis/XP após alteração de XP config', { error: recalcError });
    }

    res.json({ success: true, setting });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/settings/xp/recalculate
 * Recalcular XP de todos os usuários (apenas ADMIN)
 */
router.post('/xp/recalculate', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`Iniciando recálculo de XP de todos usuários por ${req.user?.username}`);
    
    // Instanciar AchievementService com TODOS os repositórios para recálculo COMPLETO
    const achievementService = new (require('../services/achievement.service').AchievementService)(
      repos.coffee,
      repos.achievement,
      repos.level,
      repos.setting,
      repos.user,
      repos.prisma,   // 🔧 FIX: Prisma para mensagens, reações e logins
      repos.rating    // 🔧 FIX: Rating para avaliações dadas/recebidas
    );
    
    const users = await repos.user.findAll();
    let success = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        await achievementService.recalculateUserXP(user.id);
        success++;
      } catch (err) {
        logger.error(`Erro ao recalcular XP de ${user.username}`, { error: err });
        errors++;
      }
    }
    
    logger.info(`Recálculo de XP concluído: ${success} sucesso, ${errors} erros`);
    res.json({ 
      success: true, 
      stats: { 
        total: users.length, 
        success, 
        errors 
      } 
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ROTAS GENÉRICAS
// ============================================

/**
 * GET /api/v2/settings
 * Listar todas as configurações (apenas ADMIN)
 */
router.get('/', authenticateToken, requireAdmin, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await repos.setting.findAll();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/settings/:key
 * Buscar uma configuração específica
 */
router.get('/:key', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const setting = await repos.setting.findByKey(key);
    
    if (!setting) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    
    res.json(setting);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v2/settings/:key
 * Salvar ou atualizar uma configuração (apenas ADMIN)
 */
router.put('/:key', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'O campo "value" é obrigatório' });
    }
    
    const setting = await repos.setting.upsert(key, value, req.user?.username);
    
    logger.info(`Setting "${key}" atualizado por ${req.user?.username}`);
    res.json(setting);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/settings/:key
 * Deletar uma configuração (apenas ADMIN)
 */
router.delete('/:key', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const deleted = await repos.setting.delete(key);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    
    logger.info(`Setting "${key}" deletado por ${req.user?.username}`);
    res.json({ success: true, message: 'Configuração deletada' });
  } catch (error) {
    next(error);
  }
});

export { router as settingRoutes };
