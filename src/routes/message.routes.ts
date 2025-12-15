/**
 * 🧠 CÉREBRO - Message Routes
 * Rotas de mensagens (API v2)
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../utils/auth.utils';
import { sanitizeString } from '../utils/auth.utils';
import { logger } from '../utils/logger';
import { getRepositories } from '../repositories';
import { AuthRequest } from '../types';
import { NotFoundError, ValidationError } from '../utils/errors';

const router = Router();
const repos = getRepositories();

/**
 * GET /api/v2/messages
 * Buscar mensagens recentes
 */
router.get('/', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const messages = await repos.message.findRecent(100);
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/messages
 * Criar nova mensagem
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new ValidationError('Texto da mensagem é obrigatório');
    }
    // Buscar usuário
    const user = await repos.user.findByUsername(req.user!.username);
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    const message = await repos.message.create({
      authorId: user.id,
      text: sanitizeString(text)
    });

    // --- Gamificação: Creditar XP e verificar conquistas ---
    try {
      // ✅ CORREÇÃO: Usar Points Engine para auditoria centralizada
      const { getPointsEngine } = await import('../services/points-engine.service');
      const pointsEngine = getPointsEngine(repos.prisma, logger);
      
      const result = await pointsEngine.addPoints(user.id, 'message', {
        amount: 10, // XP padrão por mensagem
        reason: 'Enviou mensagem no chat',
        sourceId: message.id,
        metadata: {
          messageId: message.id,
          text: text.substring(0, 100) // Primeiros 100 chars
        }
      });
      
      logger.info('✅ XP creditado por mensagem', {
        userId: user.id,
        messageId: message.id,
        xpAdded: result.message,
        newBalance: result.newBalance,
        newLevel: result.level
      });
    } catch (e) {
      logger.warn('⚠️ Erro ao creditar XP por mensagem', { userId: user.id, error: e });
    }

    logger.info(`Message created by ${req.user!.username}`);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/messages/:messageId/react
 * Adicionar reação a uma mensagem (novo endpoint)
 * 🆕 CORREÇÃO #3: Integrar reações com Points Engine
 */
router.post('/:messageId/react', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body; // ex: "👍", "❤️", "like", "love"
    
    if (!reaction || typeof reaction !== 'string') {
      throw new ValidationError('Reação é obrigatória');
    }

    const message = await repos.message.findById(messageId);
    if (!message) {
      throw new NotFoundError('Mensagem');
    }

    const reactor = await repos.user.findByUsername(req.user!.username);
    if (!reactor) {
      throw new NotFoundError('Usuário');
    }

    // Creditar XP ao REATOR (quem reagiu)
    try {
      const { getPointsEngine } = await import('../services/points-engine.service');
      const pointsEngine = getPointsEngine(repos.prisma, logger);
      
      await pointsEngine.addMessageReactionPoints(
        reactor.id,
        messageId,
        reaction
      );
    } catch (xpError) {
      logger.warn(`Erro ao creditar XP por reação: ${xpError}`);
      // Continua mesmo se falhar XP
    }

    // Creditar XP ao AUTOR da mensagem (quem recebeu reação)
    if (message.authorId !== reactor.id) {
      try {
        const { getPointsEngine } = await import('../services/points-engine.service');
        const pointsEngine = getPointsEngine(repos.prisma, logger);
        
        await pointsEngine.addReactionReceivedPoints(
          message.authorId,
          messageId,
          reaction,
          reactor.id
        );
      } catch (xpError) {
        logger.warn(`Erro ao creditar XP ao autor da mensagem: ${xpError}`);
        // Continua mesmo se falhar XP
      }
    }

    logger.info(`Reação adicionada: ${reaction} na mensagem ${messageId} por ${req.user!.username}`);
    res.json({ success: true, reaction });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/messages/:messageId
 * Deletar mensagem (soft delete)
 */
router.delete('/:messageId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { messageId } = req.params;
    
    const message = await repos.message.softDelete(messageId);
    
    logger.info(`Message ${messageId} deleted by ${req.user!.username}`);
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

export { router as messageRoutes };
