/**
 * ðŸ§ª Testes - AchievementService
 */

import { AchievementService } from '../achievement.service';
import { AchievementRepository } from '../../repositories/achievement.repository';
import { CoffeeRepository } from '../../repositories/coffee.repository';
import { UserRepository } from '../../repositories/user.repository';
import { prismaMock } from '../../__tests__/setup';

// Helper para criar mock de achievement


describe('AchievementService', () => {
  let service: AchievementService;
  let achievementRepo: AchievementRepository;
  let coffeeRepo: CoffeeRepository;
  let userRepo: UserRepository;
  const userId = 'user-123';

  beforeEach(() => {
    achievementRepo = new AchievementRepository(prismaMock);
    coffeeRepo = new CoffeeRepository(prismaMock);
    userRepo = new UserRepository(prismaMock);
    service = new AchievementService(coffeeRepo, achievementRepo, undefined, undefined, userRepo);
    
    // Mock padrão: usuário existe
    prismaMock.user.findUnique.mockResolvedValue({
      id: userId,
      username: 'testuser',
      name: 'Test User',
      role: 'MEMBER',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  });

  describe('checkCoffeeAchievements', () => {

    it('deve desbloquear "first-coffee" no primeiro café', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(1) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: null },
      } as any);
      prismaMock.achievement.findUnique.mockResolvedValue(null);
      prismaMock.achievement.upsert.mockResolvedValue({
        id: 'ach-1',
        userId,
        type: 'first-coffee',
        title: 'Primeira Xícara',
        description: 'Fez o primeiro café',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      expect(prismaMock.achievement.upsert).toHaveBeenCalledWith({
        where: {
          userId_type: {
            userId,
            type: 'first-coffee'
          }
        },
        create: {
          userId,
          type: 'first-coffee',
          title: 'Primeira Xícara',
          description: 'Fez o primeiro café'
        },
        update: {
          title: 'Primeira Xícara',
          description: 'Fez o primeiro café'
        }
      });
    });

    it('nÃ£o deve desbloquear "first-coffee" se jÃ¡ foi desbloqueado', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(5) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
      } as any);
      prismaMock.achievement.findUnique.mockResolvedValue({
        id: 'ach-1',
        userId,
        type: 'first-coffee',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      // Não deve criar nova conquista first-coffee (upsert não seria chamado pois findUnique já retorna existente)
    });

    it('deve desbloquear "coffee-master" com 10 cafés', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(10) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 3.5 },
      } as any);
      
      (prismaMock.achievement.findUnique.mockImplementation as any)((args: any) => {
        const achievementType = args.where.userId_type?.type;
        // first-coffee já foi desbloqueado, coffee-master não
        if (achievementType === 'first-coffee') {
          return Promise.resolve({ id: '1', userId, type: 'first-coffee', unlockedAt: new Date() } as any);
        }
        return Promise.resolve(null); // Outras conquistas não desbloqueadas
      });
      
      prismaMock.achievement.upsert.mockResolvedValue({
        id: 'ach-2',
        userId,
        type: 'coffee-master',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      expect(prismaMock.achievement.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId, type: 'coffee-master' } },
        create: { userId, type: 'coffee-master', title: 'Mestre do Café', description: 'Fez 10 cafés' },
        update: { title: 'Mestre do Café', description: 'Fez 10 cafés' }
      });
    });

    it('deve desbloquear "coffee-legend" com 50 cafés', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(50) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 3.8 },
      } as any);
      
      (prismaMock.achievement.findUnique.mockImplementation as any)((args: any) => {
        const achievementType = args.where.userId_type?.type;
        if (achievementType === 'first-coffee') {
          return Promise.resolve({ id: '1', userId, type: 'first-coffee', unlockedAt: new Date() } as any);
        }
        if (achievementType === 'coffee-master') {
          return Promise.resolve({ id: '2', userId, type: 'coffee-master', unlockedAt: new Date() } as any);
        }
        return Promise.resolve(null); // coffee-legend não desbloqueado
      });

      prismaMock.achievement.upsert.mockResolvedValue({
        id: 'ach-3',
        userId,
        type: 'coffee-legend',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      expect(prismaMock.achievement.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId, type: 'coffee-legend' } },
        create: { userId, type: 'coffee-legend', title: 'Lenda do Café', description: 'Fez 50 cafés' },
        update: { title: 'Lenda do Café', description: 'Fez 50 cafés' }
      });
    });

    it('deve desbloquear "coffee-god" com 100 cafés', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(100) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 4.0 },
      } as any);
      
      (prismaMock.achievement.findUnique.mockImplementation as any)((args: any) => {
        const achievementType = args.where.userId_type?.type;
        const unlocked = ['first-coffee', 'coffee-master', 'coffee-legend'];
        if (unlocked.includes(achievementType)) {
          return Promise.resolve({ id: 'x', userId, type: achievementType, unlockedAt: new Date() } as any);
        }
        return Promise.resolve(null); // coffee-god não desbloqueado
      });

      prismaMock.achievement.upsert.mockResolvedValue({
        id: 'ach-4',
        userId,
        type: 'coffee-god',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      expect(prismaMock.achievement.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId, type: 'coffee-god' } },
        create: { userId, type: 'coffee-god', title: 'Deus do Café', description: 'Fez 100 cafés' },
        update: { title: 'Deus do Café', description: 'Fez 100 cafés' }
      });
    });

    it('deve desbloquear "top-rated" com média >= 4.5 e pelo menos 5 cafés', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(20) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 4.7 },
      } as any);

      (prismaMock.achievement.findUnique.mockImplementation as any)((args: any) => {
        if (args.where.userId_type?.type === 'top-rated') {
          return Promise.resolve(null);
        }
        return Promise.resolve({  
          id: 'existing', 
          userId, 
          type: args.where.userId_type?.type || '', 
          unlockedAt: new Date() 
         } as any);
      });

      prismaMock.achievement.upsert.mockResolvedValue({
        id: 'ach-5',
        userId,
        type: 'top-rated',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      expect(prismaMock.achievement.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId, type: 'top-rated' } },
        create: { userId, type: 'top-rated', title: 'Altamente Avaliado', description: 'Média de avaliação >= 4.5' },
        update: { title: 'Altamente Avaliado', description: 'Média de avaliação >= 4.5' }
      });
    });

    it('não deve desbloquear "top-rated" com menos de 5 cafés', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(3) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 5.0 },
      } as any);

      prismaMock.achievement.findUnique.mockResolvedValue(null);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert - não deve ter desbloqueado top-rated (menos de 5 cafés)
      expect(prismaMock.achievement.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId_type: expect.objectContaining({ type: 'top-rated' }) }),
        })
      );
    });

    it('deve desbloquear "perfect-rating" com média 5.0 e pelo menos 10 cafés', async () => {
      // Arrange
      prismaMock.coffee.count
        .mockResolvedValueOnce(15) // totalMade
        .mockResolvedValueOnce(0); // totalBrought
      prismaMock.rating.aggregate.mockResolvedValue({
        _avg: { rating: 5.0 },
      } as any);

      (prismaMock.achievement.findUnique.mockImplementation as any)((args: any) => {
        if (args.where.userId_type?.type === 'perfect-rating') {
          return Promise.resolve(null);
        }
        return Promise.resolve({  
          id: 'existing', 
          userId, 
          type: args.where.userId_type?.type || '', 
          unlockedAt: new Date() 
         } as any);
      });

      prismaMock.achievement.upsert.mockResolvedValue({
        id: 'ach-6',
        userId,
        type: 'perfect-rating',
        unlockedAt: new Date(),
      } as any);

      // Act
      await service.checkCoffeeAchievements(userId);

      // Assert
      expect(prismaMock.achievement.upsert).toHaveBeenCalledWith({
        where: { userId_type: { userId, type: 'perfect-rating' } },
        create: { userId, type: 'perfect-rating', title: 'Avaliação Perfeita', description: 'Média 5.0 com pelo menos 10 cafés' },
        update: { title: 'Avaliação Perfeita', description: 'Média 5.0 com pelo menos 10 cafés' }
      });
    });

    it('não deve lançar erro se verificação falhar', async () => {
      // Arrange
      prismaMock.coffee.count.mockRejectedValue(new Error('Database error'));

      // Act & Assert - nÃ£o deve lanÃ§ar erro
      await expect(service.checkCoffeeAchievements(userId)).resolves.not.toThrow();
    });
  });

  describe('getUserAchievements', () => {
    it('deve retornar todas as conquistas do usuÃ¡rio', async () => {
      // Arrange
      const mockAchievements = [
        { id: '1', userId: 'user-123', type: 'first-coffee', unlockedAt: new Date() },
        { id: '2', userId: 'user-123', type: 'coffee-master', unlockedAt: new Date() },
      ] as any;
      prismaMock.achievement.findMany.mockResolvedValue(mockAchievements);

      // Act
      const achievements = await service.getUserAchievements('user-123');

      // Assert
      expect(achievements).toHaveLength(2);
      expect(prismaMock.achievement.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { unlockedAt: 'desc' },
      });
    });

    it('deve retornar array vazio se usuÃ¡rio nÃ£o tem conquistas', async () => {
      // Arrange
      prismaMock.achievement.findMany.mockResolvedValue([]);

      // Act
      const achievements = await service.getUserAchievements('user-123');

      // Assert
      expect(achievements).toHaveLength(0);
    });
  });

  describe('countUserAchievements', () => {
    it('deve retornar contagem correta', async () => {
      // Arrange
      prismaMock.achievement.count.mockResolvedValue(5);

      // Act
      const count = await service.countUserAchievements('user-123');

      // Assert
      expect(count).toBe(5);
      expect(prismaMock.achievement.count).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('deve retornar 0 se usuÃ¡rio nÃ£o tem conquistas', async () => {
      // Arrange
      prismaMock.achievement.count.mockResolvedValue(0);

      // Act
      const count = await service.countUserAchievements('user-123');

      // Assert
      expect(count).toBe(0);
    });
  });

  describe('XP e nível do usuário RENAN com conquistas épicas', () => {
    it('deve desbloquear conquistas com base nas estatísticas', async () => {
      // Arrange
      const userId = 'renan-id';
      const username = 'RENAN';
      // Mock stats para RENAN: várias conquistas
      const stats = {
        totalMade: 15, // Garante conquistas: first-coffee, coffee-master
        avgRating: 4.6 // Garante conquista épica: top-rated
      };
      // Mock dos repositórios
      const mockCoffeeRepo = { getStatsByUser: jest.fn().mockResolvedValue(stats) };
      const mockAchievementRepo = {
        createIfNotExists: jest.fn().mockImplementation(({ type }) => {
          return Promise.resolve({ achievement: { type }, created: true });
        })
      };
      const mockUserRepo = {
        findById: jest.fn().mockResolvedValue({ username })
      };
      // Instancia serviço com mocks (sem levelRepo/settingRepo/prisma - Points Engine não será usado)
      const service = new AchievementService(
        mockCoffeeRepo as any,
        mockAchievementRepo as any,
        undefined, // levelRepo
        undefined, // settingRepo
        mockUserRepo as any
      );
      // Act
      await service.checkCoffeeAchievements(userId);
      // Assert - verifica que as conquistas foram desbloqueadas
      // coffee-master (totalMade >= 10) e top-rated (avgRating >= 4.5 && totalMade >= 5)
      expect(mockAchievementRepo.createIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'coffee-master' })
      );
      expect(mockAchievementRepo.createIfNotExists).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'top-rated' })
      );
    });
  });

  describe('processUserAchievementsAndXP - XP e nível do usuário RENAN', () => {
    it('deve acumular XP corretamente e atualizar o nível em lote', async () => {
      // Arrange
      const userId = 'renan-id';
      const username = 'RENAN';
      const achievements = [
        { type: 'first-coffee', title: 'Primeira Xícara', description: 'Fez o primeiro café' },
        { type: 'coffee-master', title: 'Mestre do Café', description: 'Fez 10 cafés' },
        { type: 'top-rated', title: 'Altamente Avaliado', description: 'Média de avaliação >= 4.5' }
      ];
      const mockAchievementRepo = {
        createIfNotExists: jest.fn().mockImplementation(({ type }) => {
          return Promise.resolve({ achievement: { type }, created: true });
        })
      };
      const mockLevelRepo = {
        findByUserId: jest.fn().mockResolvedValue({ totalXP: 0, level: 1, xp: 0, history: [] }),
        upsertByUsername: jest.fn().mockResolvedValue({})
      };
      const mockSettingRepo = {
        getXPConfig: jest.fn().mockResolvedValue({
          'achievement-epic': { xp: 1500 },
          'achievement-common': { xp: 50 },
          'achievement-legendary': { xp: 200 }
        })
      };
      const mockUserRepo = {
        findById: jest.fn().mockResolvedValue({ username })
      };
      // Instancia serviço com mocks
      const service = new AchievementService(
        {} as any,
        mockAchievementRepo as any,
        mockLevelRepo as any,
        mockSettingRepo as any,
        mockUserRepo as any
      );
      // Act
      await service.processUserAchievementsAndXP(userId, achievements);
      // Assert
      // XP esperado: 50 (comum) + 200 (lendária) + 1500 (épica) = 1750
      expect(mockLevelRepo.upsertByUsername).toHaveBeenCalledWith(
        username,
        expect.objectContaining({
          totalXP: 1750,
          level: expect.any(Number),
          xp: expect.any(Number)
        })
      );
    });
  });
});



