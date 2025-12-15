/**
 * 🧠 CÉREBRO - Achievement Routes
 * Rotas de conquistas (API v2)
 */

import { Router } from 'express';
import { authenticateToken } from '../utils/auth.utils';
import { AchievementController } from '../controllers/achievement.controller';
import { AchievementService } from '../services/achievement.service';
import { getRepositories } from '../repositories';

const router = Router();

// Inicializar dependências
const repos = getRepositories();
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

// GET /api/v2/achievements - Buscar todas conquistas
router.get('/', authenticateToken, achievementController.getAll);

// GET /api/v2/achievements/:username - Buscar conquistas por username
router.get('/:username', authenticateToken, achievementController.getByUsername);

// POST /api/v2/achievements/check/:username - Forçar verificação
router.post('/check/:username', authenticateToken, achievementController.checkAchievements);

// GET /api/v2/achievements/count/:username - Contar conquistas
router.get('/count/:username', authenticateToken, achievementController.countByUsername);

// 🆕 GET /api/v2/achievements/stats/:username - Buscar estatísticas para progresso de conquistas
// Esta rota retorna os dados REAIS do banco para calcular progresso correto
router.get('/stats/:username', authenticateToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    
    const user = await repos.user.findByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Buscar todas as estatísticas do banco de dados
    const [
      coffeeStats,
      messageCount,
      ratingsGiven,
      ratingStats,
      levelData,
      reactionStatsGiven,    // 🔧 CORREÇÃO: Separar stats de reações
      reactionStatsReceived, // 🔧 CORREÇÃO: Recebidas usa authorId (UUID)
      uniqueEmojis           // 🔧 CORREÇÃO: Emojis únicos usa username
    ] = await Promise.all([
      // Stats de café
      repos.coffee.getStatsByUser(user.id),
      // Contagem de mensagens
      repos.message.countByAuthor(user.id),
      // Avaliações dadas pelo usuário
      repos.rating.countRatingsGivenByUser(user.id),
      // Stats de avaliações recebidas (5 estrelas, média, etc)
      repos.rating.getRatingStatsForMaker(user.id),
      // Dados de nível (streak, etc)
      repos.level.findByUserId(user.id),
      // 🔧 CORREÇÃO: Reações dadas usa username (campo userId na tabela é username)
      repos.reaction.countReactionsGivenByUser(username),
      // 🔧 CORREÇÃO: Reações recebidas usa o UUID do usuário (authorId na Message)
      repos.reaction.countReactionsReceivedByUser(user.id),
      // Emojis únicos usa username
      repos.reaction.countUniqueEmojisUsedByUser(username)
    ]);
    
    // Calcular dias ativos (desde o cadastro)
    const createdAt = new Date(user.createdAt);
    const now = new Date();
    const daysActive = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // 🔧 NOVO: Calcular message burst para conquista speed-typer
    let messagesBurst = 0;
    try {
      const messages = await repos.message.findByAuthor(user.id, 500);
      if (messages.length >= 5) {
        const timestamps = messages
          .map(m => new Date(m.timestamp).getTime())
          .sort((a, b) => a - b);
        
        for (let i = 0; i < timestamps.length; i++) {
          let burst = 1;
          const windowStart = timestamps[i];
          
          for (let j = i + 1; j < timestamps.length; j++) {
            if (timestamps[j] - windowStart <= 60000) {
              burst++;
            } else {
              break;
            }
          }
          
          messagesBurst = Math.max(messagesBurst, burst);
          if (messagesBurst >= 5) break;
        }
      }
    } catch (e) {
      // Ignorar erro, manter messagesBurst = 0
    }
    
    // 🔧 CORREÇÃO CRÍTICA: Calcular streak de CAFÉ FEITO em tempo real
    // Streaks são apenas para cafés FEITOS (MADE), não TRAZIDOS (BROUGHT)!
    // Bug anterior: findByMaker retornava ambos os tipos.
    let coffeeStreak = 0;
    try {
      const coffees = await repos.coffee.findMadeByMaker(user.id, 1000);
      if (coffees && coffees.length > 0) {
        // Ordenar por data (mais recente primeiro)
        const sortedDates = coffees
          .map(c => new Date(c.timestamp))
          .sort((a, b) => b.getTime() - a.getTime());
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Verificar se último café foi hoje ou ontem
        const lastDate = new Date(sortedDates[0]);
        lastDate.setHours(0, 0, 0, 0);
        
        const daysDiff = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
          // Criar set de datas únicas
          const uniqueDays = new Set<string>();
          for (const date of sortedDates) {
            uniqueDays.add(date.toISOString().split('T')[0]);
          }
          
          // Contar dias consecutivos
          coffeeStreak = 1;
          let currentDate = new Date(lastDate);
          
          while (true) {
            currentDate.setDate(currentDate.getDate() - 1);
            const dayKey = currentDate.toISOString().split('T')[0];
            
            if (uniqueDays.has(dayKey)) {
              coffeeStreak++;
            } else {
              break;
            }
          }
        }
      }
    } catch (e) {
      // Ignorar erro, manter coffeeStreak = 0
    }
    
    // Montar resposta com todos os stats necessários para progresso de conquistas
    const stats = {
      // Café
      coffeeMade: coffeeStats.totalMade,
      coffeeBrought: coffeeStats.totalBrought,
      
      // Chat
      messagesSent: messageCount,
      
      // Avaliações dadas
      ratingsGiven: ratingsGiven,
      
      // Avaliações recebidas
      fiveStarsReceived: ratingStats.fiveStarCount || 0,
      totalRatingsReceived: ratingStats.totalRatings || 0,
      averageRating: ratingStats.averageRating || 0,
      
      // Tempo
      daysActive: daysActive,
      
      // 🔧 CORREÇÃO: Streak de CAFÉ calculado em tempo real
      // O streak do levelData é do daily login, não do café!
      currentStreak: coffeeStreak,
      bestStreak: levelData?.bestStreak || coffeeStreak, // Fallback para coffeeStreak atual
      
      // 🔧 CORREÇÃO: Reações agora com valores corretos
      reactionsReceived: reactionStatsReceived,
      reactionsGiven: reactionStatsGiven,
      uniqueEmojis: uniqueEmojis,
      
      // 🔧 NOVO: Message burst para conquista speed-typer
      messagesBurst: messagesBurst,
    };
    
    res.json({
      success: true,
      username,
      stats
    });
  } catch (error) {
    next(error);
  }
});

// 🆕 POST /api/v2/achievements/recalculate/:username - Recalcular conquistas retroativamente (ADMIN)
// Útil para corrigir usuários que perderam conquistas
router.post('/recalculate/:username', authenticateToken, async (req, res, next) => {
  try {
    const { username } = req.params;
    const requester = await repos.user.findByUsername((req as any).user?.username);
    
    // Verificar se é admin
    if (!requester || requester.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem recalcular conquistas' });
    }
    
    const user = await repos.user.findByUsername(username);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Recalcular TODOS os tipos de conquistas
    const beforeCount = await achievementService.countUserAchievements(user.id);
    
    // 1. Conquistas de café (feitos + trazidos)
    await achievementService.checkCoffeeAchievements(user.id);
    
    // 2. Conquistas de rating (5 estrelas RECEBIDAS)
    await achievementService.checkRatingAchievements(user.id);
    
    // 3. Conquistas de avaliações DADAS
    await achievementService.checkRatingsGivenAchievements(user.id);
    
    // 4. Conquistas de horário especial (monday-hero, friday-finisher, etc)
    await achievementService.checkSpecialTimeAchievements(user.id);
    
    // 5. Conquistas de veterano (tempo no sistema)
    await achievementService.checkVeteranAchievements(user.id);
    
    // 6. 🆕 Conquistas de MENSAGENS
    const messageCount = await repos.message.countByAuthor(user.id);
    await achievementService.checkMessageAchievements(user.id, messageCount);
    
    // 7. 🆕 Conquistas de STREAK (sequência de dias com café)
    await achievementService.checkStreakAchievements(user.id);
    
    // 8. 🔧 CORREÇÃO CRÍTICA: Conquistas de REAÇÕES (viral, popular, reactor)
    // ANTES: Não passava parâmetros - reações NUNCA eram verificadas!
    // AGORA: Busca contagens do banco e passa corretamente
    const reactionsGiven = await repos.reaction.countReactionsGivenByUser(user.username);
    const reactionsReceived = await repos.reaction.countReactionsReceivedByUser(user.id);
    await achievementService.checkReactionAchievements(user.id, reactionsGiven, reactionsReceived);
    
    // 9. 🆕 Conquistas de EMOJIS únicos
    await achievementService.checkEmojiAchievements(user.id);
    
    const afterCount = await achievementService.countUserAchievements(user.id);
    const newAchievements = afterCount - beforeCount;
    
    res.json({
      success: true,
      message: `Recálculo COMPLETO concluído para ${username}`,
      beforeCount,
      afterCount,
      newAchievements,
      stats: {
        messageCount
      },
      allAchievements: await achievementService.getUserAchievements(user.id)
    });
  } catch (error) {
    next(error);
  }
});

export { router as achievementRoutes };

// 🆕 POST /api/v2/achievements/recalculate-all - Recalcular conquistas de TODOS os usuários (ADMIN)
router.post('/recalculate-all', authenticateToken, async (req, res, next) => {
  try {
    const requester = await repos.user.findByUsername((req as any).user?.username);
    
    // Verificar se é admin
    if (!requester || requester.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Apenas administradores podem recalcular conquistas' });
    }
    
    // Buscar todos os usuários
    const users = await repos.user.findAll();
    const results: any[] = [];
    
    for (const user of users) {
      try {
        const beforeCount = await achievementService.countUserAchievements(user.id);
        
        // Verificar TODAS as conquistas
        await achievementService.checkCoffeeAchievements(user.id);
        await achievementService.checkRatingAchievements(user.id);
        await achievementService.checkRatingsGivenAchievements(user.id);
        await achievementService.checkSpecialTimeAchievements(user.id);
        await achievementService.checkVeteranAchievements(user.id);
        
        const messageCount = await repos.message.countByAuthor(user.id);
        await achievementService.checkMessageAchievements(user.id, messageCount);
        
        // 🔧 CORREÇÃO CRÍTICA: Verificar conquistas de STREAK, REAÇÕES e EMOJIS
        await achievementService.checkStreakAchievements(user.id);
        
        // Buscar contagens de reações para verificação correta
        const reactionsGiven = await repos.reaction.countReactionsGivenByUser(user.username);
        const reactionsReceived = await repos.reaction.countReactionsReceivedByUser(user.id);
        await achievementService.checkReactionAchievements(user.id, reactionsGiven, reactionsReceived);
        
        // Verificar emojis únicos
        await achievementService.checkEmojiAchievements(user.id);
        
        const afterCount = await achievementService.countUserAchievements(user.id);
        
        results.push({
          username: user.username,
          beforeCount,
          afterCount,
          newAchievements: afterCount - beforeCount,
          messageCount
        });
      } catch (err) {
        results.push({
          username: user.username,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
    
    const totalNew = results.reduce((sum, r) => sum + (r.newAchievements || 0), 0);
    
    res.json({
      success: true,
      message: `Recálculo COMPLETO de ${users.length} usuários`,
      totalNewAchievements: totalNew,
      results
    });
  } catch (error) {
    next(error);
  }
});
