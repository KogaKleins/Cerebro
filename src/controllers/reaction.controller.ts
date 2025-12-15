/**
 * Reaction Controller
 * 
 * Gerencia reações de mensagens com persistência no banco de dados.
 * Todas as reações são salvas para permitir recálculo de XP.
 */

import { Request, Response } from 'express';
import { getRepositories, getPrismaClient } from '../repositories';
import { getPointsEngine } from '../services/points-engine.service';
import logger from '../utils/logger';

const repositories = getRepositories();
const prismaClient = getPrismaClient();
const pointsEngine = getPointsEngine(prismaClient, logger);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const ReactionController = {
  /**
   * Adicionar ou atualizar reação a uma mensagem
   * POST /api/v2/reactions
   */
  async addReaction(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId, emoji, messageAuthor } = req.body;
      const userId = req.user?.username;

      if (!userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      if (!messageId || !emoji) {
        return res.status(400).json({ error: 'messageId e emoji são obrigatórios' });
      }

      // Salvar reação no banco
      const result = await repositories.reaction.addReaction({
        messageId,
        userId,
        emoji
      });

      if (!result.created) {
        // Reação já existia, não dá XP novamente
        return res.json({ 
          success: true, 
          reaction: result.reaction,
          xpAwarded: false,
          message: 'Reação já existente'
        });
      }

      // Reação nova - dar XP
      try {
        // XP para quem reagiu
        await pointsEngine.addMessageReactionPoints(userId, messageId, emoji);

        // XP para quem recebeu a reação (autor da mensagem)
        if (messageAuthor && messageAuthor !== userId) {
          await pointsEngine.addReactionReceivedPoints(messageAuthor, messageId, emoji, userId);
        }
      } catch (xpError) {
        logger.warn('Erro ao adicionar XP por reação (pode já existir)', { 
          userId, 
          messageId, 
          emoji,
          error: xpError 
        });
      }

      logger.info('Reação adicionada', { userId, messageId, emoji });

      return res.json({ 
        success: true, 
        reaction: result.reaction,
        xpAwarded: true
      });

    } catch (error) {
      logger.error('Erro ao adicionar reação', { error });
      return res.status(500).json({ error: 'Erro interno ao adicionar reação' });
    }
  },

  /**
   * Remover reação de uma mensagem
   * DELETE /api/v2/reactions
   */
  async removeReaction(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId, emoji } = req.body;
      const userId = req.user?.username;

      if (!userId) {
        return res.status(401).json({ error: 'Não autenticado' });
      }

      if (!messageId || !emoji) {
        return res.status(400).json({ error: 'messageId e emoji são obrigatórios' });
      }

      // Remover reação do banco
      const removed = await repositories.reaction.removeReaction({
        messageId,
        userId,
        emoji
      });

      logger.info('Reação removida', { userId, messageId, emoji, wasRemoved: removed });

      return res.json({ 
        success: true, 
        removed
      });

    } catch (error) {
      logger.error('Erro ao remover reação', { error });
      return res.status(500).json({ error: 'Erro interno ao remover reação' });
    }
  },

  /**
   * Obter estatísticas de reações de um usuário
   * GET /api/v2/reactions/stats/:username
   */
  async getUserStats(req: AuthenticatedRequest, res: Response) {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({ error: 'username é obrigatório' });
      }

      // 🔧 CORREÇÃO: Buscar também o userId (UUID) para reações recebidas
      const user = await repositories.user.findByUsername(username);
      const authorId = user?.id;

      const stats = await repositories.reaction.getReactionStatsForUser(username, authorId);

      return res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Erro ao buscar estatísticas de reações', { error });
      return res.status(500).json({ error: 'Erro interno' });
    }
  },

  /**
   * Obter todas as reações de uma mensagem
   * GET /api/v2/reactions/message/:messageId
   */
  async getMessageReactions(req: AuthenticatedRequest, res: Response) {
    try {
      const { messageId } = req.params;

      if (!messageId) {
        return res.status(400).json({ error: 'messageId é obrigatório' });
      }

      const reactions = await repositories.reaction.getReactionsByMessage(messageId);

      return res.json({
        success: true,
        reactions
      });

    } catch (error) {
      logger.error('Erro ao buscar reações da mensagem', { error });
      return res.status(500).json({ error: 'Erro interno' });
    }
  }
};
