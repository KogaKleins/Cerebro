/**
 * 🧠 CÉREBRO - Achievement Controller
 * Handlers HTTP para rotas de conquistas
 */

import { Response, NextFunction } from 'express';
import { AchievementService } from '../services/achievement.service';
import { UserRepository } from '../repositories/user.repository';
import { AuthRequest } from '../types';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export class AchievementController {
  constructor(
    private achievementService: AchievementService,
    private userRepository: UserRepository
  ) {}

  /**
   * GET /api/v2/achievements
   * Busca todas as conquistas de todos os usuários (para ranking/admin)
   */
  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username } = req.query;

      // Se username for passado como query param
      if (username && typeof username === 'string') {
        const user = await this.userRepository.findByUsername(username);
        if (!user) {
          return res.json([]);
        }
        const achievements = await this.achievementService.getUserAchievements(user.id);
        // Transformar array em objeto indexado por type (compatível com front)
        const achievementsObj: { [key: string]: any } = {};
        for (const ach of achievements) {
          achievementsObj[ach.type] = {
            unlockedAt: ach.unlockedAt,
            title: ach.title,
            description: ach.description,
            // Adicione outros campos se necessário
          };
        }
        return res.json(achievementsObj);
      }

      // Se não veio username, tentar pegar do token JWT
      if (req.user && req.user.username) {
        const user = await this.userRepository.findByUsername(req.user.username);
        if (!user) {
          return res.json([]);
        }
        const achievements = await this.achievementService.getUserAchievements(user.id);
        const achievementsObj: { [key: string]: any } = {};
        for (const ach of achievements) {
          achievementsObj[ach.type] = {
            unlockedAt: ach.unlockedAt,
            title: ach.title,
            description: ach.description,
          };
        }
        return res.json(achievementsObj);
      }

      // Se não tem usuário autenticado, retorna todas agrupadas (admin/ranking)
      const achievementsByUser = await this.achievementService.getAllAchievementsGrouped();
      res.json(achievementsByUser);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v2/achievements/:username
   * Busca todas as conquistas de um usuário pelo username
   */
  getByUsername = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        throw new AppError('Nome de usuário é obrigatório', 400);
      }

      // Buscar usuário pelo username
      const user = await this.userRepository.findByUsername(username);
      
      if (!user) {
        // Retorna array vazio se usuário não existir (compatibilidade com frontend)
        logger.warn(`Usuário não encontrado para achievements: ${username}`);
        return res.json([]);
      }

      // Buscar conquistas do usuário
      const achievements = await this.achievementService.getUserAchievements(user.id);
      
      logger.info(`Achievements carregados para ${username}: ${achievements.length} conquistas`);
      
      res.json(achievements);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v2/achievements/check/:username
   * Força uma verificação de conquistas para um usuário
   */
  checkAchievements = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        throw new AppError('Nome de usuário é obrigatório', 400);
      }

      const user = await this.userRepository.findByUsername(username);
      
      if (!user) {
        throw new AppError('Usuário não encontrado', 404);
      }

      // 🆕 Verificar TODOS os tipos de conquistas
      // 1. Conquistas de café (quantidade de cafés feitos)
      await this.achievementService.checkCoffeeAchievements(user.id);
      
      // 2. Conquistas de rating (5 estrelas recebidas)
      await this.achievementService.checkRatingAchievements(user.id);
      
      // 3. Conquistas de streak (sequências de dias com café)
      await this.achievementService.checkStreakAchievements(user.id);
      
      // 4. Conquistas de reação (viral, popular, reactor)
      await this.achievementService.checkReactionAchievements(user.id);
      
      // 5. Verificação completa de todas as conquistas (mensagens, etc.)
      await this.achievementService.checkAllAchievementsForUser(user.id);
      
      // Buscar todas as conquistas após a verificação
      const allAchievements = await this.achievementService.getUserAchievements(user.id);
      
      logger.info(`Verificação completa de achievements para ${username}: ${allAchievements.length} total`);
      
      res.json({
        success: true,
        totalAchievements: allAchievements,
        message: `${allAchievements.length} conquista(s) desbloqueada(s)`
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v2/achievements/count/:username
   * Conta as conquistas de um usuário
   */
  countByUsername = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        throw new AppError('Nome de usuário é obrigatório', 400);
      }

      const user = await this.userRepository.findByUsername(username);
      
      if (!user) {
        return res.json({ count: 0 });
      }

      const count = await this.achievementService.countUserAchievements(user.id);
      
      res.json({ count });
    } catch (error) {
      next(error);
    }
  };
}
