/**
 * Reaction Routes
 * 
 * Endpoints para gerenciar reações de mensagens
 */

import { Router } from 'express';
import { ReactionController } from '../controllers/reaction.controller';
import { authenticateToken } from '../utils/auth.utils';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// POST /api/v2/reactions - Adicionar reação
router.post('/', ReactionController.addReaction);

// DELETE /api/v2/reactions - Remover reação
router.delete('/', ReactionController.removeReaction);

// GET /api/v2/reactions/stats/:username - Estatísticas de reações do usuário
router.get('/stats/:username', ReactionController.getUserStats);

// GET /api/v2/reactions/message/:messageId - Reações de uma mensagem
router.get('/message/:messageId', ReactionController.getMessageReactions);

export default router;
