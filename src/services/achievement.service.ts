/**
 * 🧠 CÉREBRO - Achievement Service
 * Lógica de negócio para conquistas
 */

import { CoffeeRepository } from '../repositories/coffee.repository';
import { AchievementRepository } from '../repositories/achievement.repository';
import { LevelRepository } from '../repositories/level.repository';
import { SettingRepository } from '../repositories/setting.repository';
import { UserRepository } from '../repositories/user.repository';
import { RatingRepository } from '../repositories/rating.repository';
import { logger } from '../utils/logger';
import { calculateLevel, calculateCurrentLevelXP } from '../utils/level.utils';
import { getPointsEngine } from './points-engine.service';
import { PrismaClient } from '@prisma/client';

export class AchievementService {
    /**
     * Processa múltiplas conquistas desbloqueadas usando PointsEngine para auditoria
     * 🔧 CORREÇÃO: Agora usa PointsEngine para garantir que XP seja auditado corretamente
     */
    async processUserAchievementsAndXP(userId: string, achievements: Array<{ type: string; title: string; description: string }>): Promise<void> {
      // VALIDAÇÃO: garantir que todos os repositórios necessários existem
      if (!(this.achievementRepo && this.userRepo)) {
        logger.error('ERRO CRÍTICO: Repositórios não inicializados', { userId });
        throw new Error('Repositórios não inicializados para processar conquistas');
      }

      try {
        // Obter dados do usuário
        const user = await this.userRepo.findById(userId);
        if (!user || !user.username) {
          logger.error('Usuário não encontrado', { userId });
          throw new Error(`Usuário ${userId} não encontrado`);
        }

        const username = user.username;
        let achievementsProcessed = 0;

        // 🔧 CORREÇÃO: Usar unlockAchievement que já integra com PointsEngine
        // Isso garante que TODAS as conquistas passem pelo audit system
        for (const ach of achievements) {
          try {
            await this.unlockAchievement(userId, ach.type, ach.title, ach.description);
            achievementsProcessed++;
          } catch (err) {
            logger.warn(`Falha ao processar conquista ${ach.type}`, { userId, error: String(err) });
          }
        }

        logger.info('Conquistas processadas com sucesso via PointsEngine', {
          userId,
          username,
          achievementsProcessed,
          total: achievements.length
        });
      } catch (error) {
        logger.error('ERRO ao processar conquistas e XP', { userId, error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }
  constructor(
    private coffeeRepo: CoffeeRepository,
    private achievementRepo: AchievementRepository,
    private levelRepo?: LevelRepository,
    private settingRepo?: SettingRepository,
    private userRepo?: UserRepository,
    private prisma?: PrismaClient,
    private ratingRepo?: RatingRepository
  ) {}
  
  /**
   * Verifica e desbloqueia conquistas relacionadas a cafés
   * ⚠️ VALIDAÇÃO CRÍTICA: Garante que userId é válido antes de qualquer operação
   * 🔧 CORRIGIDO: Requisitos corretos conforme definitions.js
   */
  async checkCoffeeAchievements(userId: string): Promise<void> {
    try {
      // 🔒 VALIDAÇÃO #1: UserId não pode ser vazio ou inválido
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        logger.error('❌ ERRO: userId inválido em checkCoffeeAchievements', { userId });
        throw new Error(`userId inválido: ${userId}`);
      }

      // 🔒 VALIDAÇÃO #2: Usuário deve existir no banco de dados
      const user = await this.userRepo?.findById(userId);
      if (!user) {
        logger.error('❌ ERRO: Usuário não encontrado em checkCoffeeAchievements', { userId });
        throw new Error(`Usuário ${userId} não encontrado no banco de dados`);
      }

      logger.info('✅ Iniciando verificação de conquistas de café', { userId, username: user.username });

      // 🔒 VALIDAÇÃO #3: Obter estatísticas do USUÁRIO CORRETO
      const stats = await this.coffeeRepo.getStatsByUser(userId);
      
      if (!stats) {
        logger.warn('⚠️ Nenhuma estatística de café encontrada', { userId });
        return;
      }

      logger.info('📊 Estatísticas de café carregadas', { 
        userId, 
        totalMade: stats.totalMade, 
        totalBrought: stats.totalBrought,
        avgRating: stats.avgRating 
      });
      
      // ═══════════════════════════════════════════════════════════════
      // ☕ CONQUISTAS DE CAFÉ FEITO
      // Requisitos corretos conforme definitions.js
      // ═══════════════════════════════════════════════════════════════
      
      // 1 café - Primeiro Café
      if (stats.totalMade >= 1) {
        await this.unlockAchievement(userId, 'first-coffee', 'Primeiro Café', 'Fez seu primeiro café');
      }
      
      // 10 cafés - Amante do Café
      if (stats.totalMade >= 10) {
        await this.unlockAchievement(userId, 'coffee-lover', 'Amante do Café', 'Fez 10 cafés');
      }
      
      // 25 cafés - Barista Jr.
      if (stats.totalMade >= 25) {
        await this.unlockAchievement(userId, 'barista-junior', 'Barista Jr.', 'Fez 25 cafés');
      }
      
      // 50 cafés - Barista Sênior
      if (stats.totalMade >= 50) {
        await this.unlockAchievement(userId, 'barista-senior', 'Barista Sênior', 'Fez 50 cafés');
      }
      
      // 100 cafés - Mestre do Café
      if (stats.totalMade >= 100) {
        await this.unlockAchievement(userId, 'coffee-master', 'Mestre do Café', 'Fez 100 cafés');
      }
      
      // 250 cafés - Lenda do Café
      if (stats.totalMade >= 250) {
        await this.unlockAchievement(userId, 'coffee-legend', 'Lenda do Café', 'Fez 250 cafés');
      }
      
      // 500 cafés - Deus do Café
      if (stats.totalMade >= 500) {
        await this.unlockAchievement(userId, 'coffee-god', 'Deus do Café', 'Fez 500 cafés');
      }
      
      // ═══════════════════════════════════════════════════════════════
      // 🛒 CONQUISTAS DE CAFÉ TRAZIDO
      // ═══════════════════════════════════════════════════════════════
      
      // 1 vez - Primeiro Suprimento
      if (stats.totalBrought >= 1) {
        await this.unlockAchievement(userId, 'first-supply', 'Primeiro Suprimento', 'Trouxe café pela primeira vez');
      }
      
      // 5 vezes - Fornecedor
      if (stats.totalBrought >= 5) {
        await this.unlockAchievement(userId, 'supplier', 'Fornecedor', 'Trouxe café 5 vezes');
      }
      
      // 15 vezes - Generoso
      if (stats.totalBrought >= 15) {
        await this.unlockAchievement(userId, 'generous', 'Generoso', 'Trouxe café 15 vezes');
      }
      
      // 30 vezes - Benfeitor
      if (stats.totalBrought >= 30) {
        await this.unlockAchievement(userId, 'benefactor', 'Benfeitor', 'Trouxe café 30 vezes');
      }
      
      // 50 vezes - Filantropo do Café
      if (stats.totalBrought >= 50) {
        await this.unlockAchievement(userId, 'philanthropist', 'Filantropo do Café', 'Trouxe café 50 vezes');
      }
      
      // ═══════════════════════════════════════════════════════════════
      // 💎 CONQUISTAS DE QUALIDADE (movidas para checkRatingAchievements)
      // ═══════════════════════════════════════════════════════════════
      
      // NOTA: Conquistas 'top-rated' e 'perfect-score' agora são verificadas
      // em checkRatingAchievements() para usar contagem real de avaliações
      // ao invés de contagem de cafés feitos.
      
      logger.info('✅ Verificação de conquistas de café concluída', { userId, username: user.username });
      
    } catch (error) {
      // 🔒 Log CRÍTICO de erro com userId para auditoria
      logger.error('❌ ERRO CRÍTICO em checkCoffeeAchievements', { 
        userId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Não lançar erro - conquistas são não-críticas
    }
  }

  /**
   * 🆕 Verifica e desbloqueia conquistas relacionadas a RATINGS recebidos (5 estrelas)
   * Chamado quando alguém avalia um café com 5 estrelas
   * ⚠️ CRÍTICO: Este método estava FALTANDO - conquistas de 5 estrelas não eram verificadas!
   */
  async checkRatingAchievements(userId: string): Promise<void> {
    try {
      // 🔒 VALIDAÇÃO #1: UserId não pode ser vazio
      if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
        logger.error('❌ ERRO: userId inválido em checkRatingAchievements', { userId });
        return;
      }

      // 🔒 VALIDAÇÃO #2: Verificar se temos o repositório de ratings
      if (!this.ratingRepo) {
        logger.warn('⚠️ RatingRepository não inicializado, criando...');
        if (this.prisma) {
          const { RatingRepository } = await import('../repositories/rating.repository');
          this.ratingRepo = new RatingRepository(this.prisma);
        } else {
          logger.error('❌ ERRO: Prisma não disponível para criar RatingRepository');
          return;
        }
      }

      // 🔒 VALIDAÇÃO #3: Usuário deve existir
      const user = await this.userRepo?.findById(userId);
      if (!user) {
        logger.error('❌ ERRO: Usuário não encontrado em checkRatingAchievements', { userId });
        return;
      }

      logger.info('⭐ Verificando conquistas de rating', { userId, username: user.username });

      // 📊 Obter estatísticas de ratings recebidos
      const ratingStats = await this.ratingRepo.getRatingStatsForMaker(userId);
      
      logger.info('📊 Estatísticas de rating carregadas', {
        userId,
        username: user.username,
        fiveStarCount: ratingStats.fiveStarCount,
        totalRatings: ratingStats.totalRatings,
        averageRating: ratingStats.averageRating
      });

      // ═══════════════════════════════════════════════════════════════
      // 🌟 CONQUISTAS DE 5 ESTRELAS RECEBIDAS
      // ═══════════════════════════════════════════════════════════════
      
      // 1️⃣ Primeira 5 estrelas recebida
      if (ratingStats.fiveStarCount >= 1) {
        await this.unlockAchievement(
          userId,
          'five-stars',
          '5 Estrelas',
          'Recebeu uma avaliação 5 estrelas'
        );
      }

      // 2️⃣ 10 avaliações 5 estrelas
      if (ratingStats.fiveStarCount >= 10) {
        await this.unlockAchievement(
          userId,
          'five-stars-master',
          'Colecionador de Estrelas',
          'Recebeu 10 avaliações 5 estrelas'
        );
      }

      // 3️⃣ 25 avaliações 5 estrelas (lendário)
      if (ratingStats.fiveStarCount >= 25) {
        await this.unlockAchievement(
          userId,
          'five-stars-legend',
          'Constelação',
          'Recebeu 25 avaliações 5 estrelas'
        );
      }

      // 🆕 50 avaliações 5 estrelas (Via Láctea)
      if (ratingStats.fiveStarCount >= 50) {
        await this.unlockAchievement(
          userId,
          'galaxy-of-stars',
          'Galáxia de Estrelas',
          'Recebeu 50 avaliações 5 estrelas'
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // 💎 CONQUISTAS DE MÉDIA DE AVALIAÇÃO
      // ═══════════════════════════════════════════════════════════════

      // 4️⃣ Top-rated: Média >= 4.5 com pelo menos 5 avaliações
      // 🔧 CRITÉRIO UNIFICADO: Considera tanto média quanto quantidade
      if (ratingStats.averageRating >= 4.5 && ratingStats.totalRatings >= 5) {
        await this.unlockAchievement(
          userId,
          'top-rated',
          'Mais Bem Avaliado',
          'Média de avaliação acima de 4.5 com pelo menos 5 avaliações'
        );
      }

      // 5️⃣ Média perfeita 5.0 (com mínimo de 10 avaliações) - PLATINA
      if (ratingStats.averageRating === 5.0 && ratingStats.totalRatings >= 10) {
        await this.unlockAchievement(
          userId,
          'perfect-score',
          'Perfeição',
          'Mantém média 5.0 com pelo menos 10 avaliações'
        );
      }

      // ═══════════════════════════════════════════════════════════════
      // 🔮 CONQUISTAS SECRETAS DE MÚLTIPLAS 5 ESTRELAS NO MESMO CAFÉ
      // ═══════════════════════════════════════════════════════════════

      // Buscar cafés com múltiplas avaliações 5 estrelas
      const coffeesWithMultipleFiveStars = await this.ratingRepo.getCoffeesWithMultipleFiveStars(userId, 2);
      
      // 6️⃣ double-rainbow: 2+ avaliações 5 estrelas no mesmo café (SECRETO)
      if (coffeesWithMultipleFiveStars.length > 0) {
        await this.unlockAchievement(
          userId,
          'double-rainbow',
          'Arco-Íris Duplo',
          'Recebeu duas avaliações 5 estrelas no mesmo café'
        );
      }

      // 7️⃣ unanimous: 5+ avaliações 5 estrelas no mesmo café (SECRETO PLATINA)
      const coffeesWithFiveFiveStars = coffeesWithMultipleFiveStars.filter(c => c.count >= 5);
      if (coffeesWithFiveFiveStars.length > 0) {
        await this.unlockAchievement(
          userId,
          'unanimous',
          'Unanimidade',
          'Recebeu 5 avaliações 5 estrelas no mesmo café - A perfeição absoluta!'
        );
      }

      logger.info('✅ Verificação de conquistas de rating concluída', {
        userId,
        username: user.username,
        fiveStarCount: ratingStats.fiveStarCount,
        coffeesWithDoubleFiveStars: coffeesWithMultipleFiveStars.length,
        coffeesWithUnanimous: coffeesWithFiveFiveStars.length
      });

    } catch (error) {
      logger.error('❌ ERRO em checkRatingAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      // Não lançar erro - conquistas são não-críticas
    }
  }
  
  /**
   * Desbloqueia uma conquista se ainda não foi desbloqueada
   */
  private async unlockAchievement(
    userId: string, 
    type: string, 
    title: string, 
    description: string
  ): Promise<void> {
    try {
      // 1. Validar entrada
      if (!userId || !type) {
        logger.error('Parâmetros inválidos para unlock', { userId, type });
        return;
      }

      // 2. Tentar criar a conquista de forma idempotente
      const createdResult = await this.achievementRepo.createIfNotExists({
        userId,
        type,
        title,
        description
      });

      if (!createdResult) {
        logger.warn('Falha ao criar ou buscar conquista', { userId, type });
        return;
      }

      const { created } = createdResult;
      
      // Se a conquista já existia, não faz nada
      if (!created) {
        logger.debug('Conquista já estava desbloqueada', { userId, type });
        return;
      }

      logger.info('✅ Conquista desbloqueada com sucesso', { userId, type, title });

      // 3. Creditar XP associado à conquista via Points Engine (centralizado)
      // O Points Engine garante auditoria e previne duplicação
      if (!this.prisma) {
        logger.error('Prisma não inicializado, não é possível creditcar XP', { userId, type });
        return;
      }

      try {
        const pointsEngine = getPointsEngine(this.prisma, logger);
        
        // 🆕 MAPA COMPLETO DE RARIDADES - Inclui TODAS as conquistas do sistema
        // IMPORTANTE: Manter sincronizado com js/achievements/definitions.js
        const ACHIEVEMENT_RARITY_MAP: Record<string, 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'> = {
          // ═══════════════════════════════════════════════════════════════
          // ☕ Coffee making achievements
          // ═══════════════════════════════════════════════════════════════
          'first-coffee': 'common',       // 1 café
          'coffee-lover': 'common',       // 10 cafés
          'barista-junior': 'rare',       // 25 cafés
          'barista-senior': 'epic',       // 50 cafés
          'coffee-master': 'legendary',   // 100 cafés
          'coffee-legend': 'legendary',   // 250 cafés (platinum no front, mas só temos até legendary aqui)
          'coffee-god': 'legendary',      // 500 cafés (platinum no front)
          
          // ═══════════════════════════════════════════════════════════════
          // 🛒 Supply achievements (café trazido)
          // ═══════════════════════════════════════════════════════════════
          'first-supply': 'common',       // 1 vez
          'supplier': 'common',           // 5 vezes
          'generous': 'rare',             // 15 vezes
          'benefactor': 'epic',           // 30 vezes
          'philanthropist': 'legendary',  // 50 vezes
          'supply-king': 'legendary',     // 100 vezes (platinum no front)
          'supply-legend': 'legendary',   // 200 vezes (platinum no front)
          
          // ═══════════════════════════════════════════════════════════════
          // ⭐ Rating achievements (5 estrelas RECEBIDAS)
          // ═══════════════════════════════════════════════════════════════
          'five-stars': 'common',           // 1ª 5 estrelas
          'five-stars-master': 'epic',      // 10x 5 estrelas
          'five-stars-legend': 'legendary', // 25x 5 estrelas
          'galaxy-of-stars': 'legendary',   // 50x 5 estrelas (platinum no front)
          'top-rated': 'epic',              // Média >= 4.5
          'perfect-score': 'legendary',     // Média 5.0 com 10+ avaliações
          'perfect-rating': 'legendary',    // Alias legado
          'double-rainbow': 'epic',         // 2x 5 estrelas mesmo café (secret)
          'unanimous': 'legendary',         // 5x 5 estrelas mesmo café (secret)
          
          // ═══════════════════════════════════════════════════════════════
          // ⭐ Rating achievements (avaliações DADAS)
          // ═══════════════════════════════════════════════════════════════
          'first-rate': 'common',         // 1ª avaliação dada
          'taste-expert': 'rare',         // 20 avaliações dadas
          'sommelier': 'epic',            // 50 avaliações dadas
          'critic-master': 'legendary',   // 100 avaliações dadas
          'diversity-champion': 'rare',   // 10 makers diferentes avaliados
          
          // ═══════════════════════════════════════════════════════════════
          // 💬 Chat achievements
          // ═══════════════════════════════════════════════════════════════
          'first-message': 'common',      // 1ª mensagem
          'chatterbox': 'common',         // 50 mensagens
          'social-butterfly': 'rare',     // 200 mensagens
          'communicator': 'epic',         // 500 mensagens
          'influencer': 'legendary',      // 1000 mensagens
          'viral': 'epic',                // 50 reações recebidas
          'popular': 'legendary',         // 200 reações recebidas
          
          // ═══════════════════════════════════════════════════════════════
          // ✨ Special & Time-based achievements
          // ═══════════════════════════════════════════════════════════════
          'early-bird': 'rare',           // Café antes das 7h
          'night-owl': 'rare',            // Café após 20h
          'weekend-warrior': 'rare',      // Café no fim de semana
          'monday-hero': 'rare',          // Café segunda de manhã
          'friday-finisher': 'rare',      // Último café da semana
          'night-shift': 'epic',          // Café após meia-noite (secret)
          'early-legend': 'legendary',    // 5x café antes das 6h
          'first-of-the-day': 'epic',     // 10x primeiro café do dia
          'last-of-the-day': 'epic',      // 10x último café do dia
          'comeback-king': 'rare',        // Voltou após 30+ dias (secret)
          
          // ═══════════════════════════════════════════════════════════════
          // 🔥 Streak achievements
          // ═══════════════════════════════════════════════════════════════
          'streak-3': 'common',           // 3 dias seguidos
          'streak-7': 'rare',             // 7 dias seguidos
          'streak-14': 'epic',            // 14 dias seguidos
          'streak-30': 'legendary',       // 30 dias seguidos
          'streak-60': 'legendary',       // 60 dias seguidos (platinum no front)
          'coffee-streak-master': 'legendary', // 100 dias seguidos (platinum no front)
          'perfect-month': 'legendary',   // Todos os dias úteis do mês (secret)
          
          // ═══════════════════════════════════════════════════════════════
          // 🏆 Milestone achievements
          // ═══════════════════════════════════════════════════════════════
          'veteran': 'rare',              // 30 dias no sistema
          'ancient': 'epic',              // 90 dias no sistema
          'founding-member': 'legendary', // 180 dias no sistema
          'community-pillar': 'legendary', // 365 dias no sistema (platinum no front)
          'eternal-legend': 'legendary',  // 730 dias no sistema (platinum no front)
          'all-rounder': 'epic',          // Conquista de todas categorias
          'perfectionist': 'legendary',   // 75% das conquistas
          'completionist': 'legendary',   // 100% das conquistas
          
          // ═══════════════════════════════════════════════════════════════
          // 🎮 Fun & Secret achievements
          // 🔧 REMOVIDO: emoji-master e emoji-legend (sistema só tem 8 emojis)
          // ═══════════════════════════════════════════════════════════════
          'reactor': 'rare',              // 100 reações dadas
          'reaction-god': 'legendary',    // 500 reações dadas
          'speed-typer': 'rare',          // 5 msgs em 1 minuto (secret)
          'coffee-duo': 'rare',           // Café junto com outro no mesmo dia (secret)
          'triple-threat': 'legendary',   // Fez, trouxe e avaliou no mesmo dia (secret)
          'silent-hero': 'epic',          // 10x trouxe café sem pedir reconhecimento (secret)
        };

        const rarity = ACHIEVEMENT_RARITY_MAP[type] || 'common';

        // Usar Points Engine para adicionar XP (com auditoria completa)
        const xpResult = await pointsEngine.addAchievementPoints(userId, type, rarity);
        
        if (xpResult.success) {
          logger.info('✅ XP creditado para conquista', {
            userId,
            type,
            rarity,
            xpAdded: xpResult.message,
            newBalance: xpResult.newBalance,
            newLevel: xpResult.level
          });
        } else {
          logger.error('❌ Falha ao creditcar XP para conquista', {
            userId,
            type,
            rarity,
            message: xpResult.message
          });
        }
        
      } catch (xpError) {
        logger.error('❌ Erro CRÍTICO ao creditcar XP para conquista', {
          userId,
          type,
          error: xpError instanceof Error ? xpError.message : String(xpError)
        });
        // NÃO lançar erro aqui - a conquista já foi desbloqueada
        // O importante é que o usuário ganhou a conquista, XP é secundário
      }
    } catch (error) {
      logger.error('❌ Erro CRÍTICO ao desbloquear conquista', {
        userId,
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      // NÃO relançar erro - conquistas são não-críticas
    }
  }
  
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🌟 CHECK RATINGS GIVEN ACHIEVEMENTS
   * Verifica conquistas baseadas em AVALIAÇÕES DADAS pelo usuário
   * 
   * 🔧 CORREÇÃO: Usar fallback para prisma se ratingRepo não estiver disponível
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkRatingsGivenAchievements(userId: string): Promise<void> {
    try {
      const user = await this.userRepo?.findById(userId);
      if (!user) {
        logger.warn('Usuário não encontrado para avaliações', { userId });
        return;
      }

      // Contar quantas avaliações o usuário DEU (não recebeu)
      // Usar ratingRepo se disponível, senão usar prisma diretamente
      let ratingsGiven: number;
      
      if (this.ratingRepo) {
        ratingsGiven = await this.ratingRepo.countRatingsGivenByUser(userId);
      } else if (this.prisma) {
        ratingsGiven = await this.prisma.rating.count({
          where: { userId: userId }
        });
      } else {
        logger.warn('Nem ratingRepo nem prisma disponíveis para checkRatingsGivenAchievements');
        return;
      }

      logger.info('📊 Verificando conquistas de avaliações DADAS', {
        userId,
        username: user.username,
        ratingsGiven
      });

      // first-rate: Primeira avaliação dada (1)
      if (ratingsGiven >= 1) {
        await this.unlockAchievement(
          userId,
          'first-rate',
          'Crítico',  // 🔧 CORREÇÃO: Nome correto conforme definitions.js
          'Avaliou seu primeiro café'
        );
      }

      // taste-expert: 20 avaliações dadas
      if (ratingsGiven >= 20) {
        await this.unlockAchievement(
          userId,
          'taste-expert',
          'Especialista',  // 🔧 CORREÇÃO: Nome correto
          'Avaliou 20 cafés'
        );
      }

      // sommelier: 50 avaliações dadas
      if (ratingsGiven >= 50) {
        await this.unlockAchievement(
          userId,
          'sommelier',
          'Sommelier de Café',
          'Avaliou 50 cafés com precisão'
        );
      }
      
      // critic-master: 100 avaliações dadas
      if (ratingsGiven >= 100) {
        await this.unlockAchievement(
          userId,
          'critic-master',
          'Mestre Crítico',
          'Avaliou 100 cafés - Paladar refinadíssimo'
        );
      }

      logger.info('✅ Conquistas de avaliações dadas verificadas', {
        username: user.username,
        ratingsGiven
      });

    } catch (error) {
      logger.error('❌ ERRO em checkRatingsGivenAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 💬 CHECK MESSAGE ACHIEVEMENTS
   * Verifica conquistas baseadas em MENSAGENS enviadas no chat
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkMessageAchievements(userId: string, messageCount?: number): Promise<void> {
    if (!this.userRepo) {
      logger.warn('userRepo não inicializado para checkMessageAchievements');
      return;
    }

    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        logger.warn('Usuário não encontrado', { userId });
        return;
      }

      // Se messageCount não foi passado, buscar diretamente do banco de mensagens
      let msgCount = messageCount;
      if (msgCount === undefined) {
        if (this.prisma) {
          // Contar mensagens não deletadas do usuário
          msgCount = await this.prisma.message.count({
            where: {
              authorId: userId,
              deletedAt: null
            }
          });
        } else {
          msgCount = (user as any).messageCount ?? 0;
        }
      }

      logger.info('💬 Verificando conquistas de mensagens', {
        userId,
        username: user.username,
        messageCount: msgCount
      });

      // 🔧 CORREÇÃO: Garantir que msgCount é um número
      const safeCount = msgCount ?? 0;

      // first-message: Primeira mensagem (1)
      if (safeCount >= 1) {
        await this.unlockAchievement(
          userId,
          'first-message',
          'Primeira Palavra',
          'Enviou sua primeira mensagem no chat'
        );
      }

      // chatterbox: 50 mensagens
      if (safeCount >= 50) {
        await this.unlockAchievement(
          userId,
          'chatterbox',
          'Tagarela',
          'Enviou 50 mensagens no chat'
        );
      }

      // social-butterfly: 200 mensagens
      if (safeCount >= 200) {
        await this.unlockAchievement(
          userId,
          'social-butterfly',
          'Borboleta Social',
          'Enviou 200 mensagens no chat'
        );
      }

      // communicator: 500 mensagens
      if (safeCount >= 500) {
        await this.unlockAchievement(
          userId,
          'communicator',
          'Comunicador',
          'Enviou 500 mensagens no chat'
        );
      }

      // influencer: 1000 mensagens
      if (safeCount >= 1000) {
        await this.unlockAchievement(
          userId,
          'influencer',
          'Influenciador',
          'Enviou 1000 mensagens no chat - uma lenda!'
        );
      }

      // 🔧 CORREÇÃO: speed-typer - 5 mensagens em 1 minuto (conquista secreta)
      // Verifica se usuário já enviou 5+ mensagens em um intervalo de 1 minuto
      if (this.prisma) {
        try {
          const messageBurst = await this.calculateMessageBurst(userId);
          if (messageBurst >= 5) {
            await this.unlockAchievement(
              userId,
              'speed-typer',
              'Digitador Veloz',
              'Enviou 5 mensagens em 1 minuto'
            );
          }
        } catch (burstError) {
          logger.warn('Erro ao verificar speed-typer', { userId, error: String(burstError) });
        }
      }

      logger.info('✅ Conquistas de mensagens verificadas', {
        username: user.username,
        messageCount: msgCount
      });

    } catch (error) {
      logger.error('❌ ERRO em checkMessageAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⏰ CHECK VETERAN ACHIEVEMENTS  
   * Verifica conquistas baseadas em TEMPO no sistema
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkVeteranAchievements(userId: string): Promise<void> {
    if (!this.userRepo) {
      logger.warn('userRepo não inicializado para checkVeteranAchievements');
      return;
    }

    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        logger.warn('Usuário não encontrado', { userId });
        return;
      }

      // Calcular dias desde a criação da conta
      const createdAt = user.createdAt ? new Date(user.createdAt) : null;
      if (!createdAt) {
        logger.warn('Usuário sem data de criação', { userId });
        return;
      }

      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdAt.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      logger.info('⏰ Verificando conquistas de veterano', {
        userId,
        username: user.username,
        daysInSystem: diffDays,
        createdAt: createdAt.toISOString()
      });

      // veteran: 30 dias no sistema
      if (diffDays >= 30) {
        await this.unlockAchievement(
          userId,
          'veteran',
          'Veterano',
          'Está no sistema há 30 dias'
        );
      }

      // ancient: 90 dias no sistema
      if (diffDays >= 90) {
        await this.unlockAchievement(
          userId,
          'ancient',
          'Ancião',
          'Está no sistema há 90 dias'
        );
      }

      // founding-member: 180 dias no sistema
      if (diffDays >= 180) {
        await this.unlockAchievement(
          userId,
          'founding-member',
          'Membro Fundador',
          'Está no sistema há 180 dias - um verdadeiro pioneiro!'
        );
      }
      
      // 🔧 CORREÇÃO: Adicionando conquistas de longa permanência que estavam faltando
      
      // community-pillar: 365 dias no sistema (1 ano)
      if (diffDays >= 365) {
        await this.unlockAchievement(
          userId,
          'community-pillar',
          'Pilar da Comunidade',
          'Está no sistema há 365 dias - Um ano de café!'
        );
      }
      
      // eternal-legend: 730 dias no sistema (2 anos)
      if (diffDays >= 730) {
        await this.unlockAchievement(
          userId,
          'eternal-legend',
          'Lenda Eterna',
          'Está no sistema há mais de 2 anos - Veteraníssimo!'
        );
      }

      logger.info('✅ Conquistas de veterano verificadas', {
        username: user.username,
        daysInSystem: diffDays
      });

    } catch (error) {
      logger.error('❌ ERRO em checkVeteranAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⏰ CHECK SPECIAL TIME ACHIEVEMENTS  
   * Verifica conquistas baseadas em HORÁRIOS especiais
   * 
   * 🔧 CORREÇÃO: Agora verifica o HISTÓRICO COMPLETO de cafés do usuário
   * para determinar conquistas de horário, não apenas a data atual.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkSpecialTimeAchievements(userId: string, coffeeDate?: Date): Promise<void> {
    if (!this.userRepo) {
      logger.warn('userRepo não inicializado para checkSpecialTimeAchievements');
      return;
    }

    try {
      const user = await this.userRepo.findById(userId);
      if (!user) return;

      // Se foi passada uma data específica (novo café), verificar essa data
      if (coffeeDate) {
        const hour = coffeeDate.getHours();
        const dayOfWeek = coffeeDate.getDay(); // 0 = domingo, 6 = sábado

        logger.info('⏰ Verificando conquistas de horário para café específico', {
          userId,
          username: user.username,
          hour,
          dayOfWeek,
          coffeeDate: coffeeDate.toISOString()
        });

        // early-bird: Café antes das 7h
        if (hour < 7) {
          await this.unlockAchievement(userId, 'early-bird', 'Madrugador', 'Fez café antes das 7h da manhã');
        }

        // night-owl: Café após 20h
        if (hour >= 20) {
          await this.unlockAchievement(userId, 'night-owl', 'Coruja Noturna', 'Fez café após as 20h');
        }

        // weekend-warrior: Café no fim de semana (sábado=6 ou domingo=0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          await this.unlockAchievement(userId, 'weekend-warrior', 'Guerreiro de Fim de Semana', 'Fez café no fim de semana');
        }

        // monday-hero: Café segunda-feira de manhã (antes das 10h)
        if (dayOfWeek === 1 && hour < 10) {
          await this.unlockAchievement(userId, 'monday-hero', 'Herói de Segunda', 'Fez café numa segunda-feira de manhã');
        }
        
        // 🆕 friday-finisher: Café sexta-feira à tarde (após 14h)
        if (dayOfWeek === 5 && hour >= 14) {
          await this.unlockAchievement(userId, 'friday-finisher', 'Finalizador da Sexta', 'Fez o último café da semana na sexta-feira');
        }
      } else {
        // 🔧 CORREÇÃO: Sem data específica, verificar HISTÓRICO de cafés FEITOS
        // ⚠️ CRÍTICO: Usar findMadeByMaker, NÃO findByMaker!
        // Conquistas de horário especial só contam para cafés que o usuário FEZ,
        // não para cafés que ele TROUXE.
        logger.info('⏰ Verificando conquistas de horário via histórico de cafés FEITOS', {
          userId,
          username: user.username
        });

        // 🔒 CORREÇÃO: Buscar apenas cafés FEITOS (type=MADE)
        const userCoffees = await this.coffeeRepo.findMadeByMaker(userId, 1000);
        
        if (!userCoffees || userCoffees.length === 0) {
          logger.info('Usuário não tem cafés FEITOS no histórico', { userId });
          return;
        }

        let hasEarlyCoffee = false;
        let hasLateCoffee = false;
        let hasWeekendCoffee = false;
        let hasMondayCoffee = false;
        let hasFridayCoffee = false;

        for (const coffee of userCoffees) {
          const date = new Date(coffee.timestamp);
          const hour = date.getHours();
          const dayOfWeek = date.getDay();

          if (hour < 7) hasEarlyCoffee = true;
          if (hour >= 20) hasLateCoffee = true;
          if (dayOfWeek === 0 || dayOfWeek === 6) hasWeekendCoffee = true;
          if (dayOfWeek === 1 && hour < 10) hasMondayCoffee = true;
          if (dayOfWeek === 5 && hour >= 14) hasFridayCoffee = true;

          // Se já encontrou todas, pode parar
          if (hasEarlyCoffee && hasLateCoffee && hasWeekendCoffee && hasMondayCoffee && hasFridayCoffee) break;
        }

        // Desbloquear conquistas baseado no histórico real
        if (hasEarlyCoffee) {
          await this.unlockAchievement(userId, 'early-bird', 'Madrugador', 'Fez café antes das 7h da manhã');
        }
        if (hasLateCoffee) {
          await this.unlockAchievement(userId, 'night-owl', 'Coruja Noturna', 'Fez café após as 20h');
        }
        if (hasWeekendCoffee) {
          await this.unlockAchievement(userId, 'weekend-warrior', 'Guerreiro de Fim de Semana', 'Fez café no fim de semana');
        }
        if (hasMondayCoffee) {
          await this.unlockAchievement(userId, 'monday-hero', 'Herói de Segunda', 'Fez café numa segunda-feira de manhã');
        }
        if (hasFridayCoffee) {
          await this.unlockAchievement(userId, 'friday-finisher', 'Finalizador da Sexta', 'Fez o último café da semana na sexta-feira');
        }

        logger.info('✅ Conquistas de horário verificadas via histórico', {
          username: user.username,
          hasEarlyCoffee,
          hasLateCoffee,
          hasWeekendCoffee,
          hasMondayCoffee,
          hasFridayCoffee
        });
      }

      logger.info('✅ Conquistas de horário especial verificadas', {
        username: user.username
      });

    } catch (error) {
      logger.error('❌ ERRO em checkSpecialTimeAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * � CHECK STREAK ACHIEVEMENTS
   * Verifica conquistas baseadas em dias consecutivos fazendo café
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkStreakAchievements(userId: string): Promise<void> {
    try {
      const user = await this.userRepo?.findById(userId);
      if (!user) {
        logger.warn('Usuário não encontrado para streak', { userId });
        return;
      }

      // 🔧 CORREÇÃO CRÍTICA: Buscar apenas cafés FEITOS (MADE), não TRAZIDOS (BROUGHT)!
      // Streaks são para dias consecutivos FAZENDO café, não trazendo.
      // Bug anterior: findByMaker retornava BOTH types, dando streak a quem só trazia café.
      const coffees = await this.coffeeRepo.findMadeByMaker(userId, 1000);
      
      if (!coffees || coffees.length === 0) {
        logger.info('Usuário não tem cafés para calcular streak', { userId });
        return;
      }

      // Calcular streak atual
      const currentStreak = this.calculateStreak(coffees);

      logger.info('🔥 Verificando conquistas de streak', {
        userId,
        username: user.username,
        currentStreak
      });

      // streak-3: 3 dias seguidos
      if (currentStreak >= 3) {
        await this.unlockAchievement(userId, 'streak-3', 'Consistente', 'Fez café 3 dias seguidos');
      }

      // streak-7: 7 dias seguidos
      if (currentStreak >= 7) {
        await this.unlockAchievement(userId, 'streak-7', 'Dedicado', 'Fez café 7 dias seguidos');
      }

      // streak-14: 14 dias seguidos
      if (currentStreak >= 14) {
        await this.unlockAchievement(userId, 'streak-14', 'Duas Semanas', 'Fez café 14 dias seguidos');
      }

      // streak-30: 30 dias seguidos
      if (currentStreak >= 30) {
        await this.unlockAchievement(userId, 'streak-30', 'Imbatível', 'Fez café 30 dias seguidos');
      }

      // streak-60: 60 dias seguidos
      if (currentStreak >= 60) {
        await this.unlockAchievement(userId, 'streak-60', 'Máquina de Café', 'Fez café 60 dias seguidos');
      }
      
      // 🔧 CORREÇÃO: Adicionando conquista de streak de 100 dias que estava faltando
      // coffee-streak-master: 100 dias seguidos
      if (currentStreak >= 100) {
        await this.unlockAchievement(userId, 'coffee-streak-master', 'Senhor das Sequências', 'Alcançou uma sequência de 100 dias');
      }

      logger.info('✅ Conquistas de streak verificadas', {
        username: user.username,
        currentStreak
      });

    } catch (error) {
      logger.error('❌ ERRO em checkStreakAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 🔧 CORRIGIDO: Calcula a streak atual de dias consecutivos
   * 
   * IMPORTANTE: Finais de semana (sábado e domingo) são IGNORADOS!
   * - Se o último café foi sexta-feira e hoje é segunda, a streak continua
   * - Se faltou um dia ÚTIL, a streak quebra
   * - Sábado e domingo não contam para nada
   */
  private calculateStreak(coffees: any[]): number {
    if (!coffees || coffees.length === 0) return 0;

    // Helper: verifica se é dia útil (segunda a sexta)
    const isWeekday = (date: Date): boolean => {
      const day = date.getDay();
      return day !== 0 && day !== 6; // 0 = domingo, 6 = sábado
    };

    // Helper: retorna o dia útil anterior
    const getPreviousWorkday = (date: Date): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() - 1);
      while (!isWeekday(result)) {
        result.setDate(result.getDate() - 1);
      }
      return result;
    };

    // Helper: retorna o último dia útil (hoje se for dia útil, ou sexta anterior)
    const getLastWorkday = (date: Date): Date => {
      const result = new Date(date);
      result.setHours(0, 0, 0, 0);
      while (!isWeekday(result)) {
        result.setDate(result.getDate() - 1);
      }
      return result;
    };

    // Ordenar por data (mais recente primeiro) e filtrar apenas dias úteis
    const workdayCoffees = coffees
      .map(c => {
        const date = new Date(c.timestamp);
        date.setHours(0, 0, 0, 0);
        return date;
      })
      .filter(date => isWeekday(date))
      .sort((a, b) => b.getTime() - a.getTime());

    if (workdayCoffees.length === 0) return 0;

    // Criar set de datas únicas de dias úteis
    const uniqueWorkdays = new Set<string>();
    for (const date of workdayCoffees) {
      const dayKey = date.toISOString().split('T')[0];
      uniqueWorkdays.add(dayKey);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastWorkday = getLastWorkday(today);
    const lastWorkdayKey = lastWorkday.toISOString().split('T')[0];

    // Verificar se fez café no último dia útil
    const lastCoffeeDate = workdayCoffees[0];
    const lastCoffeeKey = lastCoffeeDate.toISOString().split('T')[0];

    // Se o último café não foi no último dia útil, verificar se foi no anterior
    if (lastCoffeeKey !== lastWorkdayKey) {
      const prevWorkday = getPreviousWorkday(lastWorkday);
      const prevWorkdayKey = prevWorkday.toISOString().split('T')[0];
      
      // Se não foi nem no dia útil anterior, streak quebrada
      if (lastCoffeeKey !== prevWorkdayKey) {
        // Verificar quantos dias úteis se passaram
        const daysDiff = Math.floor((lastWorkday.getTime() - lastCoffeeDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Se passou mais de 3 dias (considerando um possível final de semana), streak quebrada
        if (daysDiff > 3) {
          return 0;
        }
      }
    }

    // Contar dias úteis consecutivos
    let streak = 0;
    let currentDate = new Date(lastCoffeeDate);

    // Contar o primeiro dia
    if (uniqueWorkdays.has(currentDate.toISOString().split('T')[0])) {
      streak = 1;
    }

    // Contar dias anteriores
    while (true) {
      currentDate = getPreviousWorkday(currentDate);
      const dayKey = currentDate.toISOString().split('T')[0];
      
      if (uniqueWorkdays.has(dayKey)) {
        streak++;
      } else {
        break;
      }
      
      // Limite de segurança
      if (streak > 500) break;
    }

    return streak;
  }

  /**
   * 🔧 NOVO: Calcula o maior burst de mensagens em 1 minuto
   * Usado para a conquista speed-typer
   */
  private async calculateMessageBurst(userId: string): Promise<number> {
    if (!this.prisma) return 0;

    // Buscar últimas 200 mensagens do usuário ordenadas por timestamp
    const messages = await this.prisma.message.findMany({
      where: {
        authorId: userId,
        deletedAt: null
      },
      orderBy: { timestamp: 'asc' },
      take: 500, // Verificar nas últimas 500 mensagens
      select: { timestamp: true }
    });

    if (messages.length < 5) return messages.length;

    // Calcular maior burst em janela de 1 minuto
    let maxBurst = 0;
    const timestamps = messages.map(m => new Date(m.timestamp).getTime());

    for (let i = 0; i < timestamps.length; i++) {
      let burst = 1;
      const windowStart = timestamps[i];
      
      for (let j = i + 1; j < timestamps.length; j++) {
        if (timestamps[j] - windowStart <= 60000) { // 1 minuto = 60000ms
          burst++;
        } else {
          break;
        }
      }
      
      maxBurst = Math.max(maxBurst, burst);
      
      // Se já encontrou 5+, não precisa continuar
      if (maxBurst >= 5) break;
    }

    return maxBurst;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔧 CHECK EMOJI ACHIEVEMENTS - REMOVIDO
   * 
   * MOTIVO DA REMOÇÃO:
   * - Sistema só tem 8 emojis de reação disponíveis (😮👍🔥❤️😂😢☕👀)
   * - Conquistas de "emojis únicos" eram MUITO fáceis (usar todos = 2000 XP grátis)
   * - Não faz sentido dar XP épico (1500) por usar 8 emojis diferentes
   * 
   * ALTERNATIVA: Conquistas de QUANTIDADE de reações já existem:
   * - reactor: 100 reações dadas (rare)
   * - reaction-god: 500 reações dadas (legendary)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkEmojiAchievements(userId: string): Promise<void> {
    // 🔧 DESABILITADO: Conquistas de emoji foram removidas
    // Motivo: Sistema só tem 8 emojis, variedade era muito fácil
    logger.debug('checkEmojiAchievements desabilitado - conquistas de emoji removidas', { userId });
    return;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 💬 CHECK REACTION ACHIEVEMENTS
   * Verifica conquistas baseadas em reações dadas e recebidas no chat
   * 
   * 🔧 CORREÇÃO: Se parâmetros não forem passados, busca do banco automaticamente
   * Isso garante que as conquistas SEMPRE serão verificadas corretamente
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkReactionAchievements(userId: string, reactionsGiven?: number, reactionsReceived?: number): Promise<void> {
    try {
      const user = await this.userRepo?.findById(userId);
      if (!user) {
        logger.warn('Usuário não encontrado para reações', { userId });
        return;
      }

      // 🔧 CORREÇÃO CRÍTICA: Buscar contagens do banco se não fornecidas
      // Isso evita bugs onde conquistas não são verificadas por falta de parâmetros
      let givenCount = reactionsGiven;
      let receivedCount = reactionsReceived;
      
      if (this.prisma) {
        // Buscar reações DADAS (userId na tabela é username, não UUID!)
        if (givenCount === undefined) {
          givenCount = await this.prisma.messageReaction.count({
            where: { userId: user.username }
          });
        }
        
        // Buscar reações RECEBIDAS (mensagens do usuário que receberam reação)
        if (receivedCount === undefined) {
          receivedCount = await this.prisma.messageReaction.count({
            where: {
              message: { authorId: userId }
            }
          });
        }
      }

      logger.info('💬 Verificando conquistas de reações', {
        userId,
        username: user.username,
        reactionsGiven: givenCount,
        reactionsReceived: receivedCount
      });

      // Conquistas de reações DADAS
      if (givenCount !== undefined && givenCount > 0) {
        // reactor: 100 reações dadas
        if (givenCount >= 100) {
          await this.unlockAchievement(userId, 'reactor', 'Reator Nuclear', 'Reagiu a 100 mensagens');
        }
        
        // reaction-god: 500 reações dadas
        if (givenCount >= 500) {
          await this.unlockAchievement(userId, 'reaction-god', 'Deus das Reações', 'Reagiu a 500 mensagens - O engajamento personificado!');
        }
      }

      // Conquistas de reações RECEBIDAS
      if (receivedCount !== undefined && receivedCount > 0) {
        // viral: 50 reações recebidas
        if (receivedCount >= 50) {
          await this.unlockAchievement(userId, 'viral', 'Viral', 'Recebeu 50 reações em suas mensagens');
        }

        // popular: 200 reações recebidas
        if (receivedCount >= 200) {
          await this.unlockAchievement(userId, 'popular', 'Popular', 'Recebeu 200 reações em suas mensagens');
        }
      }

      logger.info('✅ Conquistas de reações verificadas', {
        username: user.username,
        reactionsGiven: givenCount,
        reactionsReceived: receivedCount
      });

    } catch (error) {
      logger.error('❌ ERRO em checkReactionAchievements', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * �🔄 CHECK ALL ACHIEVEMENTS FOR USER
   * Método mestre que verifica TODAS as conquistas de um usuário
   * ⚠️ NOTA: Para conquistas de mensagens, é necessário passar a contagem
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async checkAllAchievementsForUser(
    userId: string, 
    options?: {
      messageCount?: number;
      reactionsGiven?: number;
      reactionsReceived?: number;
    }
  ): Promise<void> {
    logger.info('🔄 Iniciando verificação COMPLETA de conquistas', { userId, options });

    try {
      // 1. Conquistas de café (feitos + trazidos)
      await this.checkCoffeeAchievements(userId);
      
      // 2. Conquistas de avaliações recebidas (5 estrelas)
      await this.checkRatingAchievements(userId);
      
      // 3. Conquistas de avaliações dadas
      await this.checkRatingsGivenAchievements(userId);
      
      // 4. Conquistas de veterano (tempo no sistema)
      await this.checkVeteranAchievements(userId);
      
      // 5. Conquistas de horário especial
      await this.checkSpecialTimeAchievements(userId);
      
      // 6. 🔧 ADICIONADO: Conquistas de streak (dias consecutivos)
      await this.checkStreakAchievements(userId);
      
      // 7. Conquistas de mensagens (se a contagem foi fornecida)
      if (options?.messageCount !== undefined) {
        await this.checkMessageAchievements(userId, options.messageCount);
      }
      
      // 8. 🔧 ADICIONADO: Conquistas de reações (se contagens fornecidas)
      if (options?.reactionsGiven !== undefined || options?.reactionsReceived !== undefined) {
        await this.checkReactionAchievements(userId, options.reactionsGiven, options.reactionsReceived);
      }
      
      // 9. 🆕 ADICIONADO: Conquistas de emojis únicos
      await this.checkEmojiAchievements(userId);
      
      logger.info('✅ Verificação COMPLETA de conquistas finalizada', { userId });
    } catch (error) {
      logger.error('❌ ERRO na verificação completa de conquistas', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Busca todas as conquistas de um usuário
   */
  async getUserAchievements(userId: string) {
    return this.achievementRepo.findByUser(userId);
  }
  
  /**
   * Conta quantas conquistas um usuário tem
   */
  async countUserAchievements(userId: string): Promise<number> {
    return this.achievementRepo.countByUser(userId);
  }

  /**
   * Busca todas as conquistas agrupadas por usuário (evita N+1)
   */
  async getAllAchievementsGrouped(): Promise<Record<string, any[]>> {
    const grouped = await this.achievementRepo.findAllGroupedByUser();
    const result: Record<string, any[]> = {};
    
    grouped.forEach((achievements, username) => {
      result[username] = achievements.map(a => ({
        id: a.type,
        type: a.type,
        title: a.title,
        description: a.description,
        unlockedAt: a.unlockedAt
      }));
    });
    
    return result;
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * 🔄 RECALCULA COMPLETAMENTE O XP DE UM USUÁRIO
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * Baseado em TODAS as fontes de XP persistidas no banco:
   * 1. ☕ Cafés FEITOS (coffee-made)
   * 2. 🛒 Cafés TRAZIDOS (coffee-brought) 
   * 3. 💬 Mensagens enviadas no chat
   * 4. ⭐ Avaliações DADAS
   * 5. 🌟 Avaliações 4-5 estrelas RECEBIDAS
   * 6. 🏆 Conquistas desbloqueadas
   * 7. 📅 Logins diários
   * 8. 💖 Reações dadas e recebidas
   * 
   * ⚠️ CRÍTICO: Este método NÃO REMOVE dados do banco!
   * Apenas recalcula o XP total baseado no que JÁ EXISTE.
   * 
   * Usando a config XP atual (customizada ou padrão)
   */
  async recalculateUserXP(userId: string): Promise<void> {
    if (!(this.levelRepo && this.settingRepo && this.userRepo && this.coffeeRepo)) {
      logger.error('Repositórios obrigatórios não inicializados para recalculateUserXP', { userId });
      return;
    }

    try {
      const user = await this.userRepo.findById(userId);
      if (!user) {
        logger.warn('Usuário não encontrado para recálculo de XP', { userId });
        return;
      }

      const username = user.username;
      logger.info(`🔄 Iniciando recálculo COMPLETO de XP para ${username}`, { userId });

      // 1. Buscar config XP customizada do banco
      const customConfig: any = await this.settingRepo.getXPConfig();
      
      // Helper para obter XP de uma ação
      const getXP = (actionKey: string, defaultValue: number): number => {
        if (customConfig && customConfig[actionKey] && typeof customConfig[actionKey].xp === 'number') {
          return customConfig[actionKey].xp;
        }
        return defaultValue;
      };

      let totalXP = 0;
      const history: any[] = [];

      // ═══════════════════════════════════════════════════════════════
      // ☕ 2. XP de CAFÉS FEITOS
      // ═══════════════════════════════════════════════════════════════
      const coffeeStats = await this.coffeeRepo.getStatsByUser(userId);
      
      if (coffeeStats.totalMade > 0) {
        const xpPerCoffee = getXP('coffee-made', 50);
        const coffeeXP = coffeeStats.totalMade * xpPerCoffee;
        totalXP += coffeeXP;
        history.push({ 
          action: 'coffee-made', 
          count: coffeeStats.totalMade,
          xp: coffeeXP, 
          timestamp: new Date().toISOString() 
        });
        logger.debug(`  ☕ Cafés feitos: ${coffeeStats.totalMade} x ${xpPerCoffee} = ${coffeeXP} XP`);
      }

      // ═══════════════════════════════════════════════════════════════
      // 🛒 3. XP de CAFÉS TRAZIDOS
      // ═══════════════════════════════════════════════════════════════
      if (coffeeStats.totalBrought > 0) {
        const xpPerBrought = getXP('coffee-brought', 75);
        const broughtXP = coffeeStats.totalBrought * xpPerBrought;
        totalXP += broughtXP;
        history.push({ 
          action: 'coffee-brought', 
          count: coffeeStats.totalBrought,
          xp: broughtXP, 
          timestamp: new Date().toISOString() 
        });
        logger.debug(`  🛒 Cafés trazidos: ${coffeeStats.totalBrought} x ${xpPerBrought} = ${broughtXP} XP`);
      }

      // ═══════════════════════════════════════════════════════════════
      // 💬 4. XP de MENSAGENS ENVIADAS
      // ═══════════════════════════════════════════════════════════════
      if (this.prisma) {
        try {
          const messageCount = await this.prisma.message.count({
            where: { authorId: userId }
          });
          
          if (messageCount > 0) {
            const xpPerMessage = getXP('message-sent', 1);
            const messageXP = messageCount * xpPerMessage;
            totalXP += messageXP;
            history.push({ 
              action: 'message-sent', 
              count: messageCount,
              xp: messageXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  💬 Mensagens: ${messageCount} x ${xpPerMessage} = ${messageXP} XP`);
          }
        } catch (e) {
          logger.warn('Erro ao contar mensagens para recálculo', { userId, error: e });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // ⭐ 5. XP de AVALIAÇÕES DADAS
      // ═══════════════════════════════════════════════════════════════
      if (this.ratingRepo) {
        try {
          const ratingsGiven = await this.ratingRepo.countRatingsGivenByUser(userId);
          
          if (ratingsGiven > 0) {
            const xpPerRating = getXP('rating-given', 15);
            const ratingXP = ratingsGiven * xpPerRating;
            totalXP += ratingXP;
            history.push({ 
              action: 'rating-given', 
              count: ratingsGiven,
              xp: ratingXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  ⭐ Avaliações dadas: ${ratingsGiven} x ${xpPerRating} = ${ratingXP} XP`);
          }
        } catch (e) {
          logger.warn('Erro ao contar avaliações dadas para recálculo', { userId, error: e });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 🌟 6. XP de AVALIAÇÕES 4-5 ESTRELAS RECEBIDAS
      // ═══════════════════════════════════════════════════════════════
      if (this.ratingRepo) {
        try {
          const ratingStats = await this.ratingRepo.getRatingStatsForMaker(userId);
          const fiveStarXP = getXP('five-star-received', 30);
          const fourStarXP = getXP('four-star-received', 15);
          
          let receivedXP = 0;
          
          if (ratingStats.fiveStarCount > 0) {
            const fiveXP = ratingStats.fiveStarCount * fiveStarXP;
            receivedXP += fiveXP;
            history.push({ 
              action: 'five-star-received', 
              count: ratingStats.fiveStarCount,
              xp: fiveXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  🌟 5 estrelas: ${ratingStats.fiveStarCount} x ${fiveStarXP} = ${fiveXP} XP`);
          }
          
          // Calcular 4 estrelas (totalRatings - 5 estrelas - outras)
          // Para simplificar, vamos buscar diretamente
          const fourStarCount = await this.prisma?.rating.count({
            where: {
              coffee: { makerId: userId },
              rating: 4
            }
          }) || 0;
          
          if (fourStarCount > 0) {
            const fourXP = fourStarCount * fourStarXP;
            receivedXP += fourXP;
            history.push({ 
              action: 'four-star-received', 
              count: fourStarCount,
              xp: fourXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  ⭐ 4 estrelas: ${fourStarCount} x ${fourStarXP} = ${fourXP} XP`);
          }
          
          totalXP += receivedXP;
        } catch (e) {
          logger.warn('Erro ao contar avaliações recebidas para recálculo', { userId, error: e });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 📅 7. XP de LOGINS DIÁRIOS
      // ═══════════════════════════════════════════════════════════════
      if (this.prisma) {
        try {
          const loginCount = await this.prisma.dailyLogin.count({
            where: { userId }
          });
          
          if (loginCount > 0) {
            const xpPerLogin = getXP('daily-login', 10);
            const loginXP = loginCount * xpPerLogin;
            totalXP += loginXP;
            history.push({ 
              action: 'daily-login', 
              count: loginCount,
              xp: loginXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  📅 Logins: ${loginCount} x ${xpPerLogin} = ${loginXP} XP`);
          }
        } catch (e) {
          logger.warn('Erro ao contar logins para recálculo', { userId, error: e });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 💖 8. XP de REAÇÕES DADAS E RECEBIDAS
      // ═══════════════════════════════════════════════════════════════
      if (this.prisma) {
        try {
          // Reações dadas
          const reactionsGiven = await this.prisma.messageReaction.count({
            where: { userId }
          });
          
          if (reactionsGiven > 0) {
            const xpPerReactionGiven = getXP('reaction-given', 3);
            const reactionGivenXP = reactionsGiven * xpPerReactionGiven;
            totalXP += reactionGivenXP;
            history.push({ 
              action: 'reaction-given', 
              count: reactionsGiven,
              xp: reactionGivenXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  💖 Reações dadas: ${reactionsGiven} x ${xpPerReactionGiven} = ${reactionGivenXP} XP`);
          }

          // Reações recebidas (nas mensagens do usuário)
          const reactionsReceived = await this.prisma.messageReaction.count({
            where: {
              message: { authorId: userId }
            }
          });
          
          if (reactionsReceived > 0) {
            const xpPerReactionReceived = getXP('reaction-received', 5);
            const reactionReceivedXP = reactionsReceived * xpPerReactionReceived;
            totalXP += reactionReceivedXP;
            history.push({ 
              action: 'reaction-received', 
              count: reactionsReceived,
              xp: reactionReceivedXP, 
              timestamp: new Date().toISOString() 
            });
            logger.debug(`  💖 Reações recebidas: ${reactionsReceived} x ${xpPerReactionReceived} = ${reactionReceivedXP} XP`);
          }
        } catch (e) {
          logger.warn('Erro ao contar reações para recálculo', { userId, error: e });
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // 🏆 9. XP de CONQUISTAS DESBLOQUEADAS
      // ⚠️ CRÍTICO: Não remove conquistas! Apenas calcula XP delas.
      // ═══════════════════════════════════════════════════════════════
      const achievements = await this.achievementRepo.findByUser(userId);
      
      // Mapa COMPLETO de raridades (sincronizado com unlockAchievement)
      const ACHIEVEMENT_RARITY_MAP: Record<string, string> = {
        // Café feito
        'first-coffee': 'common',
        'coffee-lover': 'common',
        'barista-junior': 'rare',
        'barista-senior': 'epic',
        'coffee-master': 'legendary',
        'coffee-legend': 'platinum',
        'coffee-god': 'platinum',
        // Café trazido
        'first-supply': 'common',
        'supplier': 'common',
        'generous': 'rare',
        'benefactor': 'epic',
        'philanthropist': 'legendary',
        // Avaliações recebidas
        'five-stars': 'common',
        'five-stars-master': 'epic',
        'five-stars-legend': 'legendary',
        'top-rated': 'epic',
        'perfect-score': 'legendary',
        'perfect-rating': 'legendary',
        // Avaliações dadas
        'first-rate': 'common',
        'taste-expert': 'rare',
        'sommelier': 'epic',
        // Chat
        'first-message': 'common',
        'chatterbox': 'common',
        'social-butterfly': 'rare',
        'communicator': 'epic',
        'influencer': 'legendary',
        'viral': 'epic',
        'popular': 'legendary',
        // Tempo especial
        'early-bird': 'rare',
        'night-owl': 'rare',
        'weekend-warrior': 'rare',
        'monday-hero': 'rare',
        'friday-finisher': 'rare',
        // Streaks
        'streak-3': 'common',
        'streak-7': 'rare',
        'streak-14': 'epic',
        'streak-30': 'legendary',
        'streak-60': 'platinum',
        // Veterano
        'veteran': 'rare',
        'ancient': 'epic',
        'founding-member': 'legendary',
        // Especiais
        'all-rounder': 'epic',
        'perfectionist': 'legendary',
        'completionist': 'legendary',
        // 🔧 REMOVIDO: emoji-master e emoji-legend (sistema só tem 8 emojis)
        'reactor': 'rare',
        'speed-typer': 'rare',
        'coffee-duo': 'rare',
        'triple-threat': 'legendary'
      };

      // Defaults de XP por raridade
      const RARITY_XP_DEFAULTS: Record<string, number> = {
        'common': 25,
        'rare': 50,
        'epic': 100,
        'legendary': 200,
        'platinum': 500
      };

      let achievementsXP = 0;
      for (const achievement of achievements) {
        const rarity = ACHIEVEMENT_RARITY_MAP[achievement.type] || 'common';
        const actionKey = `achievement-${rarity}`;
        const xpAmount = getXP(actionKey, RARITY_XP_DEFAULTS[rarity] || 25);
        
        if (xpAmount > 0) {
          achievementsXP += xpAmount;
          history.push({ 
            action: `achievement:${achievement.type}`, 
            rarity,
            xp: xpAmount, 
            timestamp: achievement.unlockedAt?.toISOString() || new Date().toISOString() 
          });
        }
      }
      
      if (achievementsXP > 0) {
        totalXP += achievementsXP;
        logger.debug(`  🏆 Conquistas (${achievements.length}): ${achievementsXP} XP total`);
      }

      // ═══════════════════════════════════════════════════════════════
      // 📊 10. CALCULAR NÍVEL E SALVAR
      // ═══════════════════════════════════════════════════════════════
      const newLevel = calculateLevel(totalXP);
      const currentLevelXP = calculateCurrentLevelXP(totalXP, newLevel);

      await this.levelRepo.upsertByUsername(username, {
        totalXP,
        level: newLevel,
        xp: currentLevelXP,
        history
      });

      logger.info(`✅ XP recalculado para ${username}: ${totalXP} XP total, Nível ${newLevel}`, {
        userId,
        username,
        totalXP,
        level: newLevel,
        achievements: achievements.length,
        breakdown: {
          coffeesMade: coffeeStats.totalMade,
          coffeesBrought: coffeeStats.totalBrought,
          achievements: achievements.length
        }
      });
    } catch (error) {
      logger.error('❌ ERRO ao recalcular XP do usuário', { 
        userId, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

}

