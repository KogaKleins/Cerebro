/**
 * 🧠 CÉREBRO - Announcement Routes
 * Rotas para comunicados/anúncios
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { getRepositories } from '../repositories';
import { AuthRequest } from '../types';

const router = Router();

// Lazy load de repositories
const getRepos = () => getRepositories();

/**
 * GET /api/v2/announcements
 * Buscar comunicados ativos (público - usuários autenticados)
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    const announcements = await repos.announcement.findActive(limit);
    
    res.json({
      success: true,
      announcements
    });
  } catch (error) {
    logger.error('Erro ao buscar comunicados', error);
    next(error);
  }
});

/**
 * GET /api/v2/announcements/all
 * Buscar todos os comunicados (admin)
 */
router.get('/all', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const [announcements, total] = await Promise.all([
      repos.announcement.findAll(limit, offset),
      repos.announcement.count()
    ]);
    
    res.json({
      success: true,
      announcements,
      total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Erro ao buscar todos os comunicados', error);
    next(error);
  }
});

/**
 * GET /api/v2/announcements/:id
 * Buscar comunicado por ID
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { id } = req.params;
    
    const announcement = await repos.announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({
        error: 'Comunicado não encontrado'
      });
    }
    
    res.json({
      success: true,
      announcement
    });
  } catch (error) {
    logger.error('Erro ao buscar comunicado', error);
    next(error);
  }
});

/**
 * POST /api/v2/announcements
 * Criar novo comunicado (admin)
 */
router.post('/', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { title, content, priority, expiresAt } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        error: 'Título e conteúdo são obrigatórios'
      });
    }
    
    // Buscar ID do admin
    const admin = await repos.user.findByUsername(req.user!.username);
    
    if (!admin) {
      return res.status(401).json({
        error: 'Usuário não encontrado'
      });
    }
    
    const announcement = await repos.announcement.create({
      title,
      content,
      priority: priority || 'NORMAL',
      authorId: admin.id,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });
    
    logger.info('Comunicado criado', { 
      id: announcement.id, 
      title: announcement.title,
      author: req.user!.username 
    });
    
    res.status(201).json({
      success: true,
      announcement
    });
  } catch (error) {
    logger.error('Erro ao criar comunicado', error);
    next(error);
  }
});

/**
 * PUT /api/v2/announcements/:id
 * Atualizar comunicado (admin)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { id } = req.params;
    const { title, content, priority, active, expiresAt } = req.body;
    
    // Verificar se existe
    const existing = await repos.announcement.findById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Comunicado não encontrado'
      });
    }
    
    const announcement = await repos.announcement.update(id, {
      title,
      content,
      priority,
      active,
      expiresAt: expiresAt === null ? null : (expiresAt ? new Date(expiresAt) : undefined)
    });
    
    logger.info('Comunicado atualizado', { 
      id, 
      title: announcement.title,
      admin: req.user!.username 
    });
    
    res.json({
      success: true,
      announcement
    });
  } catch (error) {
    logger.error('Erro ao atualizar comunicado', error);
    next(error);
  }
});

/**
 * DELETE /api/v2/announcements/:id
 * Deletar comunicado (admin)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { id } = req.params;
    
    // Verificar se existe
    const existing = await repos.announcement.findById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Comunicado não encontrado'
      });
    }
    
    await repos.announcement.delete(id);
    
    logger.info('Comunicado deletado', { 
      id, 
      title: existing.title,
      admin: req.user!.username 
    });
    
    res.json({
      success: true,
      message: 'Comunicado deletado com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao deletar comunicado', error);
    next(error);
  }
});

export { router as announcementRoutes };
