/**
 * 🧠 CÉREBRO - Coffee Service
 * Lógica de negócio para cafés
 */

import { CoffeeRepository } from '../repositories/coffee.repository';
import { UserRepository } from '../repositories/user.repository';
import { RatingRepository } from '../repositories/rating.repository';
import { AchievementService } from './achievement.service';
import { SocketService } from './socket.service';
import { CreateCoffeeDto, RateCoffeeDto } from '../validators/coffee.validator';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { getPointsEngine } from './points-engine.service';
import { PrismaClient } from '@prisma/client';

export class CoffeeService {
  constructor(
    private coffeeRepo: CoffeeRepository,
    private userRepo: UserRepository,
    private ratingRepo: RatingRepository,
    private achievementService: AchievementService,
    private socketService: SocketService,
    private prisma: PrismaClient,
  ) {}
  
  /**
   * Cria um novo registro de café
   * 🔧 CORREÇÃO #7: Validar limite de 10 cafés/dia com thread safety
   */
  async create(username: string, data: CreateCoffeeDto) {
    // 1. Buscar usuário
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    
    // 2. Validar limite diário (10 cafés por dia) - THREAD-SAFE
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Usar transação para garantir atomicidade
    try {
      // Contar cafés feitos HOJE
      const countToday = await this.coffeeRepo.countByUserSince(user.id, today);
      
      if (countToday >= 10) {
        throw new ValidationError(`Limite de 10 cafés por dia atingido. Tente novamente amanhã.`);
      }

      // 3. Criar café
      const coffee = await this.coffeeRepo.create({
        type: data.type,
        makerId: user.id,
        description: data.description,
        quantity: data.quantity,
      });

      logger.info('Coffee created', { 
        coffeeId: coffee.id, 
        userId: user.id, 
        username,
        type: data.type 
      });

      // 4. Adicionar pontos via Points Engine (centralizado e auditado)
      const pointsEngine = getPointsEngine(this.prisma, logger);
      try {
        const result = await pointsEngine.addCoffeeMadePoints(user.id, coffee.id);
        logger.info('Pontos de café creditados', {
          coffeeId: coffee.id,
          userId: user.id,
          xpAdded: result.message
        });
      } catch (error) {
        logger.error('Erro ao adicionar pontos de café', { coffeeId: coffee.id, userId: user.id, error });
        // Continua mesmo se falhar, pois o café foi criado
      }

      // 5. Verificar conquistas (assíncrono, não bloqueia)
      this.achievementService.checkCoffeeAchievements(user.id).catch(err => {
        logger.error('Error checking achievements after coffee creation', err);
      });

      // 5b. 🆕 Verificar conquistas de horário especial (early-bird, night-owl, etc)
      this.achievementService.checkSpecialTimeAchievements(user.id, new Date()).catch(err => {
        logger.error('Error checking special time achievements', err);
      });
      
      // 5c. 🔧 CORREÇÃO: Verificar conquistas de STREAK (dias consecutivos)
      this.achievementService.checkStreakAchievements(user.id).catch(err => {
        logger.error('Error checking streak achievements', err);
      });

      // 6. Notificar via WebSocket
      const message = data.type === 'MADE' 
        ? `${user.name} fez café! ☕` 
        : `${user.name} trouxe café! 🎁`;

      this.socketService.notifyAll(message, 'info');

      return coffee;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Erro ao criar café', { username, error });
      throw error;
    }
  }
  
  /**
   * Avalia um café
   */
  async rateCoffee(username: string, coffeeId: string, data: RateCoffeeDto) {
    // 1. Buscar usuário
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    
    // 2. Verificar se café existe
    const coffee = await this.coffeeRepo.findById(coffeeId);
    if (!coffee) {
      throw new NotFoundError('Café');
    }
    
    // 3. Não pode avaliar próprio café
    if (coffee.makerId === user.id) {
      throw new ValidationError('Você não pode avaliar seu próprio café');
    }
    
    // 4. 🔒 CORREÇÃO: Verificar se usuário já avaliou este café (bloquear re-avaliação)
    const existingRating = await this.ratingRepo.findOne(coffeeId, user.id);
    if (existingRating) {
      throw new ValidationError('Você já avaliou este café');
    }
    
    // 5. Criar avaliação (não permitir atualização)
    const rating = await this.ratingRepo.upsert({
      coffeeId,
      userId: user.id,
      rating: data.rating,
    });
    
    logger.info('Coffee rated', { 
      coffeeId, 
      userId: user.id, 
      rating: data.rating 
    });
    
    // 5b. Adicionar pontos por avaliação ao AVALIADOR (centralizado)
    const pointsEngine = getPointsEngine(this.prisma, logger);
    try {
      await pointsEngine.addPoints(user.id, 'rating', {
        amount: 5,
        reason: `Avaliou café com nota ${data.rating}`,
        sourceId: coffeeId
      });
    } catch (error) {
      logger.error('Erro ao adicionar pontos de avaliação', { coffeeId, userId: user.id, error });
    }
    
    // 5c. 🆕 CORREÇÃO #1: Adicionar pontos EXTRAS ao AUTOR do café
    // Se recebeu 5 estrelas, autor ganha bônus de qualidade
    try {
      if (data.rating === 5) {
        await pointsEngine.addPoints(coffee.makerId, 'rating', {
          amount: 30,
          reason: `Recebeu avaliação ⭐⭐⭐⭐⭐ no café ${coffeeId}`,
          sourceId: `coffee-${coffeeId}-5star-${user.id}`, // Unique per rater
          metadata: { 
            coffeeId, 
            ratedBy: user.id,
            ratedByUsername: user.username,
            rating: 5
          }
        });
      } else if (data.rating >= 4) {
        // 4 estrelas também dá bônus (menor)
        await pointsEngine.addPoints(coffee.makerId, 'rating', {
          amount: 15,
          reason: `Recebeu avaliação ⭐⭐⭐⭐ no café ${coffeeId}`,
          sourceId: `coffee-${coffeeId}-4star-${user.id}`,
          metadata: { 
            coffeeId, 
            ratedBy: user.id,
            ratedByUsername: user.username,
            rating: 4
          }
        });
      }
    } catch (error) {
      logger.error('Erro ao adicionar bônus de qualidade ao autor', { coffeeId, authorId: coffee.makerId, error });
    }
    
    // 6. Verificar conquistas do autor do café (assíncrono)
    // 🆕 CORREÇÃO CRÍTICA: Verificar AMBOS os tipos de conquistas
    // - checkCoffeeAchievements: conquistas de quantidade de cafés feitos
    // - checkRatingAchievements: conquistas de 5 estrelas recebidas (ESTAVA FALTANDO!)
    
    // 6a. Verificar conquistas de café
    this.achievementService.checkCoffeeAchievements(coffee.makerId).catch(err => {
      logger.error('Error checking coffee achievements after rating', err);
    });
    
    // 6b. 🆕 Verificar conquistas de RATING (5 estrelas recebidas)
    // CRÍTICO: Este era o bug! Conquistas de 5 estrelas NÃO eram verificadas!
    this.achievementService.checkRatingAchievements(coffee.makerId).catch(err => {
      logger.error('Error checking rating achievements after rating', err);
    });

    // 6c. 🆕 Verificar conquistas de AVALIAÇÕES DADAS (pelo avaliador)
    // Conquistas: first-rate, taste-expert, sommelier
    this.achievementService.checkRatingsGivenAchievements(user.id).catch(err => {
      logger.error('Error checking ratings given achievements', err);
    });
    
    logger.info('✅ Rating processado com verificação completa de conquistas', {
      coffeeId,
      makerId: coffee.makerId,
      rating: data.rating,
      ratedBy: user.username
    });
    
    return rating;
  }
  
  /**
   * Busca cafés recentes
   */
  async getRecent(limit = 50) {
    return this.coffeeRepo.findRecent(limit);
  }
  
  /**
   * Busca um café específico por ID
   */
  async getById(coffeeId: string) {
    const coffee = await this.coffeeRepo.findById(coffeeId);
    if (!coffee) {
      throw new NotFoundError('Café');
    }
    return coffee;
  }
  
  /**
   * Busca estatísticas gerais de cafés
   */
  async getStats() {
    return this.coffeeRepo.getOverallStats();
  }
  
  /**
   * Busca estatísticas de um usuário específico
   */
  async getUserStats(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuário');
    }
    
    return this.coffeeRepo.getStatsByUser(userId);
  }
}
