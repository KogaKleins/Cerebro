/**
 * 🧠 CÉREBRO - Coffee Routes
 * Rotas de café (API v2)
 */

import { Router } from 'express';
import { authenticateToken } from '../utils/auth.utils';
import { validate, validateParams } from '../middleware/validation.middleware';
import { 
  createCoffeeSchema, 
  rateCoffeeSchema, 
  coffeeIdSchema 
} from '../validators/coffee.validator';
import { CoffeeController } from '../controllers/coffee.controller';
import { CoffeeService } from '../services/coffee.service';
import { AchievementService } from '../services/achievement.service';
import { getRepositories } from '../repositories';
import { SocketService } from '../services/socket.service';

const router = Router();

// Função para criar rotas com dependências injetadas
export function createCoffeeRoutes(socketService: SocketService) {
  const repos = getRepositories();
  const { prisma } = repos;
  
  // 🆕 Incluir RatingRepository no AchievementService para verificar conquistas de 5 estrelas
  const achievementService = new AchievementService(
    repos.coffee, 
    repos.achievement, 
    repos.level, 
    repos.setting, 
    repos.user,
    prisma,
    repos.rating  // 🆕 CRÍTICO: Necessário para checkRatingAchievements
  );
  const coffeeService = new CoffeeService(
    repos.coffee,
    repos.user,
    repos.rating,
    achievementService,
    socketService,
    prisma
  );
  const coffeeController = new CoffeeController(coffeeService);

  // GET /api/v2/coffees - Buscar cafés recentes
  router.get('/', authenticateToken, coffeeController.getRecent);

  // POST /api/v2/coffees - Registrar novo café
  router.post(
    '/', 
    authenticateToken, 
    validate(createCoffeeSchema),
    coffeeController.create
  );

  // GET /api/v2/coffees/stats - Estatísticas de café
  router.get('/stats', authenticateToken, coffeeController.getStats);

  // GET /api/v2/coffees/:coffeeId - Buscar café por ID
  router.get(
    '/:coffeeId',
    authenticateToken,
    validateParams(coffeeIdSchema),
    coffeeController.getById
  );

  // POST /api/v2/coffees/:coffeeId/rate - Avaliar café
  router.post(
    '/:coffeeId/rate', 
    authenticateToken,
    validateParams(coffeeIdSchema),
    validate(rateCoffeeSchema),
    coffeeController.rateCoffee
  );

  return router;
}

export { router as coffeeRoutes };
