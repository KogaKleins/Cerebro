/**
 * 🧠 CÉREBRO - Legacy Routes
 * Rotas de compatibilidade com API v1 (DEPRECADAS)
 * TODO: Migrar frontend para API v2 e remover este arquivo
 */

import { Router, Response, NextFunction } from 'express';
import { authenticateToken } from '../utils/auth.utils';
import { sanitizeString } from '../utils/auth.utils';
import { getRepositories } from '../repositories';
import { AuthRequest } from '../types';
import { SocketService } from '../services/socket.service';
import { AchievementController } from '../controllers/achievement.controller';
import { AchievementService } from '../services/achievement.service';
import { validate } from '../middleware/validation.middleware';
import { legacyCoffeeSchema, legacyMessageSchema, legacyRatingSchema } from '../validators/legacy.validator';
import { logger } from '../utils/logger';

/**
 * 🔧 Normaliza um nome para comparação consistente
 * Remove acentos, converte para minúsculas e remove espaços extras
 */
function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
}

// Função para criar rotas legadas com socketService injetado
export function createLegacyRoutes(socketService: SocketService) {
  const router = Router();
  const repos = getRepositories();
  
  // Inicializar achievement controller para rota de compatibilidade
  // 🆕 Incluir prisma e ratingRepo para verificar conquistas de 5 estrelas
  const achievementService = new AchievementService(
    repos.coffee, 
    repos.achievement, 
    repos.level, 
    repos.setting, 
    repos.user,
    repos.prisma,
    repos.rating  // 🆕 CRÍTICO: Necessário para checkRatingAchievements
  );
  const achievementController = new AchievementController(achievementService, repos.user);
  
  // ============================================
  // COFFEE MADE
  // ============================================
  
  router.get('/coffee-made', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffees = await repos.coffee.findRecent(100);
      const formatted = coffees
        .filter(c => c.type === 'MADE')
        .map(c => ({
          id: c.id,
          name: c.maker.name,
          note: c.description || '',
          date: c.timestamp.toISOString(),
          type: 'made'
        }));
      res.json(formatted);
    } catch (error) {
      next(error);
    }
  });

  router.post('/coffee-made', authenticateToken, validate(legacyCoffeeSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, note } = req.body;
      
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      const coffee = await repos.coffee.create({
        type: 'MADE',
        makerId: user.id,
        description: note || ''
      });
      
      // 🆕 CORREÇÃO: Adicionar pontos via Points Engine
      try {
        const { getPointsEngine } = await import('../services/points-engine.service');
        const pointsEngine = getPointsEngine(repos.prisma, logger);
        await pointsEngine.addPoints(user.id, 'coffee-made', {
          amount: 10,
          reason: 'Fez café',
          sourceId: `coffee-made-${coffee.id}`,
          metadata: { coffeeId: coffee.id, type: 'MADE' }
        });
        
        // Verificar conquistas após fazer café
        achievementService.checkCoffeeAchievements(user.id).catch(err => {
          logger.error('Error checking coffee achievements (legacy made)', err);
        });
        // 🔧 CORREÇÃO: Passar new Date() para verificar conquistas do café ATUAL
        achievementService.checkSpecialTimeAchievements(user.id, new Date()).catch(err => {
          logger.error('Error checking time achievements (legacy made)', err);
        });
        // 🆕 Verificar conquistas de STREAK
        achievementService.checkStreakAchievements(user.id).catch(err => {
          logger.error('Error checking streak achievements (legacy made)', err);
        });
      } catch (pointsError) {
        logger.error('Erro ao adicionar pontos (legacy coffee-made)', { error: pointsError });
      }
      
      socketService.notifyAll(`${name || user.name} fez café! ☕`, 'info');
      
      res.json({ success: true, data: { id: coffee.id, name, note, date: coffee.timestamp } });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // COFFEE BROUGHT
  // ============================================

  router.get('/coffee-brought', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffees = await repos.coffee.findRecent(100);
      const formatted = coffees
        .filter(c => c.type === 'BROUGHT')
        .map(c => ({
          id: c.id,
          name: c.maker.name,
          note: c.description || '',
          date: c.timestamp.toISOString(),
          type: 'brought'
        }));
      res.json(formatted);
    } catch (error) {
      next(error);
    }
  });

  router.post('/coffee-brought', authenticateToken, validate(legacyCoffeeSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, note, specialItem } = req.body;
      
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      // 🆕 Descrição inclui o tipo de item especial se fornecido
      const description = specialItem 
        ? `[${specialItem}] ${note || ''}`
        : (note || '');
      
      const coffee = await repos.coffee.create({
        type: 'BROUGHT',
        makerId: user.id,
        description
      });
      
      // 🆕 CORREÇÃO: Adicionar pontos via Points Engine
      try {
        const { getPointsEngine } = await import('../services/points-engine.service');
        const pointsEngine = getPointsEngine(repos.prisma, logger);
        
        // 🆕 Se for item especial, usar XP do item específico
        if (specialItem) {
          // Buscar XP configurado para o item especial
          const xpSetting = await repos.prisma.setting.findUnique({
            where: { key: 'xp-config' }
          });
          const xpConfig = xpSetting?.value as Record<string, { xp: number }> || {};
          
          // XP padrão para itens especiais
          const DEFAULT_ITEM_XP: Record<string, number> = {
            'filtro-cafe': 30,
            'bolo': 250,
            'bolo-supreme': 400,
            'bolacha': 25,
            'bolacha-recheada': 35,
            'biscoito': 50,
            'sonho': 75
          };
          
          const xpAmount = xpConfig[specialItem]?.xp || DEFAULT_ITEM_XP[specialItem] || 50;
          
          await pointsEngine.addPoints(user.id, 'coffee-brought', {
            amount: xpAmount,
            reason: `Trouxe item especial: ${specialItem}`,
            sourceId: `special-item-${specialItem}-${coffee.id}`,
            metadata: { coffeeId: coffee.id, type: 'BROUGHT', specialItem }
          });
          
          socketService.notifyAll(`${name || user.name} trouxe ${specialItem}! 🎁`, 'info');
        } else {
          // XP normal para café trazido
          await pointsEngine.addPoints(user.id, 'coffee-brought', {
            amount: 75, // XP padrão para coffee-brought
            reason: 'Trouxe café',
            sourceId: `coffee-brought-${coffee.id}`,
            metadata: { coffeeId: coffee.id, type: 'BROUGHT' }
          });
          
          socketService.notifyAll(`${name || user.name} trouxe café! 🎁`, 'info');
        }
        
        // Verificar conquistas após trazer café
        achievementService.checkCoffeeAchievements(user.id).catch(err => {
          logger.error('Error checking coffee achievements (legacy brought)', err);
        });
        
        // 🆕 CORREÇÃO: Verificar conquistas de horário especial (weekend-warrior, early-bird, etc)
        achievementService.checkSpecialTimeAchievements(user.id).catch(err => {
          logger.error('Error checking time achievements (legacy brought)', err);
        });
        
        // 🆕 CORREÇÃO: Verificar conquistas de STREAK (dias consecutivos)
        achievementService.checkStreakAchievements(user.id).catch(err => {
          logger.error('Error checking streak achievements (legacy brought)', err);
        });
      } catch (pointsError) {
        logger.error('Erro ao adicionar pontos (legacy coffee-brought)', { error: pointsError });
      }
      
      res.json({ success: true, data: { id: coffee.id, name, note, specialItem, date: coffee.timestamp } });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // CHAT MESSAGES
  // ============================================

  router.get('/chat-messages', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const messages = await repos.message.findRecent(100);
      const formatted = messages.map(m => {
        // 🔧 CORREÇÃO: Converter reactions do banco para formato { username: emoji }
        const reactions: Record<string, string> = {};
        if ((m as any).reactions && Array.isArray((m as any).reactions)) {
          (m as any).reactions.forEach((r: any) => {
            reactions[r.userId] = r.emoji;
          });
        }
        
        // 🔧 CORREÇÃO: Reconstruir replyTo do banco de dados
        const replyTo = (m as any).replyToId ? {
          id: (m as any).replyToId,
          author: (m as any).replyToAuthor || 'Usuário',
          text: (m as any).replyToText || ''
        } : null;
        
        return {
          id: m.id,
          author: m.author.name,
          username: m.author.username, // 🔧 CORREÇÃO: Adicionar username para matching no frontend
          text: m.text,
          timestamp: m.timestamp.toISOString(),
          reactions, // 🔧 CORREÇÃO: Agora retorna reações do banco!
          replyTo,   // 🔧 CORREÇÃO: Agora retorna replyTo do banco!
          edited: m.edited
        };
      });
      
      // 🔧 CORREÇÃO: Retornar em ordem cronológica (mais antigo primeiro)
      // O findRecent retorna em ordem desc, então invertemos
      res.json(formatted.reverse());
    } catch (error) {
      next(error);
    }
  });

  router.post('/chat-messages', authenticateToken, validate(legacyMessageSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { text } = req.body;
      
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      const message = await repos.message.create({
        authorId: user.id,
        text: sanitizeString(text)
      });
      
      // ✅ Creditar XP por mensagem usando Points Engine
      // Busca configuração de XP do banco ou usa padrão de 1 XP
      let xpGained = 0;
      try {
        const { getPointsEngine } = await import('../services/points-engine.service');
        const pointsEngine = getPointsEngine(repos.prisma, logger);
        
        // Buscar configuração de XP para mensagem
        const xpSetting = await repos.prisma.setting.findUnique({
          where: { key: 'xp-config' }
        });
        
        // Valor padrão de 1 XP por mensagem
        let messageXP = 1;
        if (xpSetting && xpSetting.value) {
          const config = xpSetting.value as Record<string, { xp: number }>;
          if (config['message-sent'] && typeof config['message-sent'].xp === 'number') {
            messageXP = config['message-sent'].xp;
          }
        }
        
        await pointsEngine.addPoints(user.id, 'message', {
          amount: messageXP,
          reason: 'Enviou mensagem no chat',
          sourceId: message.id,
          metadata: { messageId: message.id }
        });
        
        xpGained = messageXP;
        logger.info('✅ XP creditado por mensagem', { userId: user.id, messageId: message.id, xp: messageXP });
      } catch (xpError) {
        logger.warn('⚠️ Erro ao creditar XP por mensagem', { userId: user.id, error: xpError });
      }
      
      // Notificar via WebSocket (incluindo XP ganho)
      socketService.broadcastChatMessage({
        id: message.id,
        author: user.name,
        text: message.text,
        timestamp: message.timestamp.toISOString(),
        xpGained: xpGained // 🆕 Enviar XP ganho para o frontend exibir
      });
      
      res.json({ success: true, data: message, xpGained });
    } catch (error) {
      next(error);
    }
  });

  // DELETE mensagem do chat (ADMIN)
  router.delete('/chat-messages/:messageId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Verificar se é admin
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar mensagens' });
      }
      
      const { messageId } = req.params;
      await repos.message.softDelete(messageId);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // PUT para limpar todas as mensagens (ADMIN)
  router.put('/chat-messages', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Verificar se é admin
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ação' });
      }
      
      // Se array vazio, deletar todas as mensagens
      if (Array.isArray(req.body) && req.body.length === 0) {
        await repos.message.deleteAll();
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // RATINGS
  // ============================================

  router.get('/ratings', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffees = await repos.coffee.findRecent(100);
      const ratingsObj: Record<string, any> = {};
      
      for (const coffee of coffees) {
        if (coffee.ratings && coffee.ratings.length > 0) {
          const totalStars = coffee.ratings.reduce((sum, r) => sum + r.rating, 0);
          ratingsObj[coffee.id] = {
            coffeeId: coffee.id,
            makerName: coffee.maker.name,
            totalStars,
            raters: coffee.ratings.map(r => ({
              name: (r as any).user?.name || 'Anônimo',
              stars: r.rating
            })),
            average: totalStars / coffee.ratings.length
          };
        }
      }
      
      res.json(ratingsObj);
    } catch (error) {
      next(error);
    }
  });

  router.put('/ratings/:coffeeId', authenticateToken, validate(legacyRatingSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { coffeeId } = req.params;
      const { raters } = req.body;
      
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      // 🔒 CORREÇÃO: Buscar o café ANTES de processar rating
      const coffee = await repos.coffee.findById(coffeeId);
      if (!coffee) {
        return res.status(404).json({ error: 'Café não encontrado' });
      }

      // 🔒 CORREÇÃO CRÍTICA: Verificar se está avaliando o próprio café
      if (coffee.makerId === user.id) {
        logger.warn('Tentativa de auto-avaliação bloqueada', { userId: user.id, coffeeId });
        return res.status(400).json({ error: 'Você não pode avaliar seu próprio café' });
      }
      
      // 🔒 CORREÇÃO: Verificar se usuário já avaliou este café (bloquear re-avaliação)
      const existingRating = await repos.rating.findOne(coffeeId, user.id);
      if (existingRating) {
        logger.warn('Tentativa de re-avaliação bloqueada', { userId: user.id, coffeeId });
        return res.status(400).json({ error: 'Você já avaliou este café' });
      }
      
      // 🔧 CORREÇÃO: Usar normalizeName para comparação consistente (remove acentos)
      const currentUserRating = raters?.find((r: any) => 
        normalizeName(r.name) === normalizeName(user.name)
      );
      
      if (currentUserRating) {
        await repos.rating.upsert({
          coffeeId,
          userId: user.id,
          rating: currentUserRating.stars
        });
        
        // 🆕 CORREÇÃO CRÍTICA: Verificar conquistas após rating
        // Já temos o café carregado acima
        if (coffee.makerId) {
          // Importar Points Engine para dar bônus de 5 estrelas
          const { getPointsEngine } = await import('../services/points-engine.service');
          const pointsEngine = getPointsEngine(repos.prisma, logger);
          
          // Se foi 5 estrelas, dar bônus ao autor
          if (currentUserRating.stars === 5) {
            try {
              await pointsEngine.addPoints(coffee.makerId, 'rating', {
                amount: 30,
                reason: `Recebeu avaliação ⭐⭐⭐⭐⭐ no café ${coffeeId}`,
                sourceId: `coffee-${coffeeId}-5star-${user.id}`,
                metadata: { 
                  coffeeId, 
                  ratedBy: user.id,
                  ratedByUsername: user.username,
                  rating: 5
                }
              });
            } catch (pointsError) {
              logger.error('Erro ao adicionar bônus de 5 estrelas (legacy)', { coffeeId, error: pointsError });
            }
          } else if (currentUserRating.stars >= 4) {
            try {
              await pointsEngine.addPoints(coffee.makerId, 'rating', {
                amount: 15,
                reason: `Recebeu avaliação ⭐⭐⭐⭐ no café ${coffeeId}`,
                sourceId: `coffee-${coffeeId}-4star-${user.id}`,
                metadata: { coffeeId, ratedBy: user.id, rating: 4 }
              });
            } catch (pointsError) {
              logger.error('Erro ao adicionar bônus de 4 estrelas (legacy)', { coffeeId, error: pointsError });
            }
          }
          
          // Verificar conquistas do autor (café + rating)
          achievementService.checkCoffeeAchievements(coffee.makerId).catch(err => {
            logger.error('Error checking coffee achievements (legacy)', err);
          });
          achievementService.checkRatingAchievements(coffee.makerId).catch(err => {
            logger.error('Error checking rating achievements (legacy)', err);
          });
          
          logger.info('✅ Rating legacy processado com conquistas', {
            coffeeId,
            makerId: coffee.makerId,
            rating: currentUserRating.stars,
            ratedBy: user.username
          });
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // PUT para limpar todas as avaliações (ADMIN)
  router.put('/ratings', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Verificar se é admin
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ação' });
      }
      
      // Se array vazio, deletar todas as avaliações
      if (Array.isArray(req.body) && req.body.length === 0) {
        await repos.rating.deleteAll();
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // DELETE avaliação específica (ADMIN)
  router.delete('/ratings/:ratingId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar avaliações' });
      }
      
      const { ratingId } = req.params;
      // O ratingId aqui é o coffeeId - deletar todas as avaliações daquele café
      await repos.prisma.rating.deleteMany({
        where: { coffeeId: ratingId }
      });
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ============================================
  // ACHIEVEMENTS (compatibilidade)
  // ============================================

  router.get('/achievements', authenticateToken, achievementController.getAll);

  // ============================================
  // COFFEE HISTORY
  // ============================================

  router.get('/coffee-history', authenticateToken, async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const coffees = await repos.coffee.findRecent(50);
      const formatted = coffees.map(c => ({
        id: c.id,
        name: c.maker.name,
        type: c.type.toLowerCase(),
        date: c.timestamp.toISOString(),
        note: c.description || ''
      }));
      res.json(formatted);
    } catch (error) {
      next(error);
    }
  });

  router.post('/coffee-history', authenticateToken, async (_req: AuthRequest, res: Response) => {
    // Esta rota apenas confirma recebimento (histórico é gerenciado automaticamente)
    res.json({ success: true });
  });

  // DELETE café específico (ADMIN)
  router.delete('/coffee-made/:coffeeId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar registros' });
      }
      
      const { coffeeId } = req.params;
      await repos.coffee.delete(coffeeId);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/coffee-brought/:coffeeId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar registros' });
      }
      
      const { coffeeId } = req.params;
      await repos.coffee.delete(coffeeId);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/coffee-history/:coffeeId', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem deletar registros' });
      }
      
      const { coffeeId } = req.params;
      await repos.coffee.delete(coffeeId);
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // PUT para limpar todos os cafés (ADMIN)
  router.put('/coffee-made', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ação' });
      }
      
      if (Array.isArray(req.body) && req.body.length === 0) {
        await repos.coffee.deleteByType('MADE');
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/coffee-brought', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ação' });
      }
      
      if (Array.isArray(req.body) && req.body.length === 0) {
        await repos.coffee.deleteByType('BROUGHT');
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.put('/coffee-history', authenticateToken, async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await repos.user.findByUsername(req.user!.username);
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Apenas administradores podem executar esta ação' });
      }
      
      if (Array.isArray(req.body) && req.body.length === 0) {
        await repos.coffee.deleteAll();
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
