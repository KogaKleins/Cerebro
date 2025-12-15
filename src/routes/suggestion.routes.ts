/**
 * 🧠 CÉREBRO - Suggestion Routes
 * Rotas para sugestões de usuários
 * 
 * Endpoints:
 * - GET /api/v2/suggestions - Sugestões do usuário atual
 * - GET /api/v2/suggestions/all - Todas as sugestões (admin)
 * - GET /api/v2/suggestions/:id - Sugestão por ID
 * - POST /api/v2/suggestions - Criar sugestão
 * - PUT /api/v2/suggestions/:id/status - Atualizar status (admin)
 * - DELETE /api/v2/suggestions/:id - Deletar sugestão
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken, requireAdmin } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { getRepositories } from '../repositories';
import { AuthRequest } from '../types';
import { SuggestionStatus } from '@prisma/client';

const router = Router();

// Lazy load de repositories
const getRepos = () => getRepositories();

// Constantes de validação
const MAX_PENDING_SUGGESTIONS = 5;
const MIN_TITLE_LENGTH = 5;
const MAX_TITLE_LENGTH = 100;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 2000;

/**
 * GET /api/v2/suggestions
 * Buscar sugestões do usuário atual
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    
    // Buscar ID do usuário
    const user = await repos.user.findByUsername(req.user!.username);
    
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não encontrado'
      });
    }
    
    const suggestions = await repos.suggestion.findByAuthor(user.id);
    
    res.json({
      success: true,
      suggestions
    });
  } catch (error) {
    logger.error('Erro ao buscar sugestões', error);
    next(error);
  }
});

/**
 * GET /api/v2/suggestions/all
 * Buscar todas as sugestões (admin)
 */
router.get('/all', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as SuggestionStatus | undefined;
    
    const [suggestions, counts, total] = await Promise.all([
      repos.suggestion.findAll({ status, limit, offset }),
      repos.suggestion.countByStatus(),
      repos.suggestion.count(status)
    ]);
    
    res.json({
      success: true,
      suggestions,
      counts,
      total,
      limit,
      offset
    });
  } catch (error) {
    logger.error('Erro ao buscar todas as sugestões', error);
    next(error);
  }
});

/**
 * GET /api/v2/suggestions/:id
 * Buscar sugestão por ID
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { id } = req.params;
    
    const suggestion = await repos.suggestion.findById(id);
    
    if (!suggestion) {
      return res.status(404).json({
        error: 'Sugestão não encontrada'
      });
    }
    
    // Verificar se é o autor ou admin
    const isAdmin = req.user!.role === 'ADMIN';
    const user = await repos.user.findByUsername(req.user!.username);
    
    if (!isAdmin && suggestion.authorId !== user?.id) {
      return res.status(403).json({
        error: 'Sem permissão para ver esta sugestão'
      });
    }
    
    res.json({
      success: true,
      suggestion
    });
  } catch (error) {
    logger.error('Erro ao buscar sugestão', error);
    next(error);
  }
});

/**
 * POST /api/v2/suggestions
 * Criar nova sugestão (qualquer usuário autenticado)
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    
    // Extrair e sanitizar dados
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    
    // Validações detalhadas
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Título e conteúdo são obrigatórios'
      });
    }
    
    if (title.length < MIN_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `O título deve ter pelo menos ${MIN_TITLE_LENGTH} caracteres`
      });
    }
    
    if (title.length > MAX_TITLE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `O título deve ter no máximo ${MAX_TITLE_LENGTH} caracteres`
      });
    }
    
    if (content.length < MIN_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `O conteúdo deve ter pelo menos ${MIN_CONTENT_LENGTH} caracteres`
      });
    }
    
    if (content.length > MAX_CONTENT_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `O conteúdo deve ter no máximo ${MAX_CONTENT_LENGTH} caracteres`
      });
    }
    
    // Verificar se usuário está autenticado
    if (!req.user || !req.user.username) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado'
      });
    }
    
    // Buscar ID do usuário
    const user = await repos.user.findByUsername(req.user.username);
    
    if (!user) {
      logger.warn('Usuário não encontrado ao criar sugestão', { username: req.user.username });
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }
    
    // Verificar limite de sugestões pendentes (evitar spam)
    const pendingCount = await repos.suggestion.countPendingByAuthor(user.id);
    
    if (pendingCount >= MAX_PENDING_SUGGESTIONS) {
      return res.status(429).json({
        success: false,
        error: `Você já possui ${MAX_PENDING_SUGGESTIONS} sugestões pendentes. Aguarde a análise das anteriores.`
      });
    }
    
    // Criar sugestão
    const suggestion = await repos.suggestion.create({
      title,
      content,
      authorId: user.id
    });
    
    logger.info('Sugestão criada', { 
      id: suggestion.id, 
      title: suggestion.title,
      author: req.user!.username 
    });
    
    res.status(201).json({
      success: true,
      suggestion
    });
  } catch (error) {
    logger.error('Erro ao criar sugestão', error);
    next(error);
  }
});

/**
 * PUT /api/v2/suggestions/:id/status
 * Atualizar status da sugestão (admin)
 */
router.put('/:id/status', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    
    // Validar status
    const validStatuses: SuggestionStatus[] = ['PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'IMPLEMENTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Status inválido'
      });
    }
    
    // Verificar se existe
    const existing = await repos.suggestion.findById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Sugestão não encontrada'
      });
    }
    
    const suggestion = await repos.suggestion.updateStatus(id, status, adminNotes);
    
    logger.info('Status da sugestão atualizado', { 
      id, 
      oldStatus: existing.status,
      newStatus: status,
      admin: req.user!.username 
    });
    
    res.json({
      success: true,
      suggestion
    });
  } catch (error) {
    logger.error('Erro ao atualizar status da sugestão', error);
    next(error);
  }
});

/**
 * DELETE /api/v2/suggestions/:id
 * Deletar sugestão (admin ou autor)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const repos = getRepos();
    const { id } = req.params;
    
    // Verificar se existe
    const existing = await repos.suggestion.findById(id);
    if (!existing) {
      return res.status(404).json({
        error: 'Sugestão não encontrada'
      });
    }
    
    // Verificar se é o autor ou admin
    const isAdmin = req.user!.role === 'ADMIN';
    const user = await repos.user.findByUsername(req.user!.username);
    
    if (!isAdmin && existing.authorId !== user?.id) {
      return res.status(403).json({
        error: 'Sem permissão para deletar esta sugestão'
      });
    }
    
    await repos.suggestion.delete(id);
    
    logger.info('Sugestão deletada', { 
      id, 
      title: existing.title,
      by: req.user!.username 
    });
    
    res.json({
      success: true,
      message: 'Sugestão deletada com sucesso'
    });
  } catch (error) {
    logger.error('Erro ao deletar sugestão', error);
    next(error);
  }
});

export { router as suggestionRoutes };
