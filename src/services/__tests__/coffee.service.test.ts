/**
 * 🧪 Testes - CoffeeService
 */

import { CoffeeService } from '../coffee.service';
import { CoffeeRepository } from '../../repositories/coffee.repository';
import { UserRepository } from '../../repositories/user.repository';
import { RatingRepository } from '../../repositories/rating.repository';
import { AchievementService } from '../achievement.service';
import { SocketService } from '../socket.service';
import { prismaMock } from '../../__tests__/setup';
import { ValidationError, NotFoundError } from '../../utils/errors';

describe('CoffeeService', () => {
  let service: CoffeeService;
  let coffeeRepo: CoffeeRepository;
  let userRepo: UserRepository;
  let ratingRepo: RatingRepository;
  let achievementService: jest.Mocked<AchievementService>;
  let socketService: jest.Mocked<SocketService>;

  beforeEach(() => {
    coffeeRepo = new CoffeeRepository(prismaMock);
    userRepo = new UserRepository(prismaMock);
    ratingRepo = new RatingRepository(prismaMock);
    
    achievementService = {
      checkCoffeeAchievements: jest.fn().mockResolvedValue(undefined),
      getUserAchievements: jest.fn(),
      countUserAchievements: jest.fn(),
    } as any;
    
    socketService = {
      notifyAll: jest.fn(),
      notifyUser: jest.fn(),
    } as any;

    service = new CoffeeService(
      coffeeRepo,
      userRepo,
      ratingRepo,
      achievementService,
      socketService,
      prismaMock as any
    );
  });

  describe('create', () => {
    const username = 'testuser';
    const mockUser = {
      id: 'user-123',
      username,
      password: 'hashed',
      name: 'Test User',
      avatar: '☕',
      role: 'MEMBER' as const,
      setor: 'TI',
      photo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      bannedUntil: null,
      banReason: null,
    };

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
    });

    it('deve criar café com sucesso', async () => {
      // Arrange
      const createData = {
        type: 'MADE' as const,
        description: 'Café expresso',
      };

      prismaMock.coffee.count.mockResolvedValue(5); // 5 cafés hoje
      prismaMock.coffee.create.mockResolvedValue({
        id: 'coffee-123',
        type: 'MADE',
        makerId: mockUser.id,
        description: 'Café expresso',
        quantity: null,
        timestamp: new Date(),
        maker: mockUser,
        ratings: [],
      } as any);

      // Act
      const coffee = await service.create(username, createData);

      // Assert
      expect(coffee.id).toBe('coffee-123');
      expect(coffee.type).toBe('MADE');
      expect(coffee.makerId).toBe(mockUser.id);
      expect(prismaMock.coffee.create).toHaveBeenCalledTimes(1);
      expect(socketService.notifyAll).toHaveBeenCalledWith(
        expect.stringContaining('fez café'),
        'info'
      );
    });

    it('deve criar café do tipo BROUGHT', async () => {
      // Arrange
      const createData = {
        type: 'BROUGHT' as const,
        description: 'Café da padaria',
      };

      prismaMock.coffee.count.mockResolvedValue(2);
      prismaMock.coffee.create.mockResolvedValue({
        id: 'coffee-124',
        type: 'BROUGHT',
        makerId: mockUser.id,
        description: 'Café da padaria',
        quantity: null,
        timestamp: new Date(),
        maker: mockUser,
        ratings: [],
      } as any);

      // Act
      const coffee = await service.create(username, createData);

      // Assert
      expect(coffee.type).toBe('BROUGHT');
      expect(socketService.notifyAll).toHaveBeenCalledWith(
        expect.stringContaining('trouxe café'),
        'info'
      );
    });

    it('deve lançar erro se limite diário atingido', async () => {
      // Arrange
      prismaMock.coffee.count.mockResolvedValue(10); // Limite atingido

      // Act & Assert
      await expect(
        service.create(username, { type: 'MADE' })
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.create(username, { type: 'MADE' })
      ).rejects.toThrow('Limite de 10 cafés por dia atingido');
    });

    it('deve lançar erro se usuário não encontrado', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.create('nonexistent', { type: 'MADE' })
      ).rejects.toThrow(NotFoundError);
    });

    it('deve verificar conquistas após criar café', async () => {
      // Arrange
      prismaMock.coffee.count.mockResolvedValue(1);
      prismaMock.coffee.create.mockResolvedValue({
        id: 'coffee-125',
        type: 'MADE',
        makerId: mockUser.id,
        description: null,
        quantity: null,
        timestamp: new Date(),
        maker: mockUser,
        ratings: [],
      } as any);

      // Act
      await service.create(username, { type: 'MADE' });

      // Assert - aguardar um pouco pois checkCoffeeAchievements é chamado assincronamente
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(achievementService.checkCoffeeAchievements).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('rateCoffee', () => {
    const username = 'rater';
    const coffeeId = 'coffee-123';
    
    const mockRater = {
      id: 'rater-id',
      username,
      password: 'hashed',
      name: 'Rater User',
      avatar: '⭐',
      role: 'MEMBER' as const,
      setor: 'TI',
      photo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      bannedUntil: null,
      banReason: null,
    };

    const mockMaker = {
      id: 'maker-id',
      username: 'maker',
      password: 'hashed',
      name: 'Coffee Maker',
      avatar: '☕',
      role: 'MEMBER' as const,
      setor: 'TI',
      photo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      bannedUntil: null,
      banReason: null,
    };

    const mockCoffee = {
      id: coffeeId,
      type: 'MADE' as const,
      makerId: 'maker-id',
      description: null,
      quantity: null,
      timestamp: new Date(),
      maker: mockMaker,
      ratings: [],
    };

    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue(mockRater);
      prismaMock.coffee.findUnique.mockResolvedValue(mockCoffee as any);
    });

    it('deve avaliar café com sucesso', async () => {
      // Arrange
      prismaMock.rating.findUnique.mockResolvedValue(null); // Ainda não avaliou
      prismaMock.rating.upsert.mockResolvedValue({
        id: 'rating-1',
        coffeeId,
        userId: mockRater.id,
        rating: 5,
        createdAt: new Date(),
        user: mockRater,
        coffee: mockCoffee,
      } as any);

      // Act
      const rating = await service.rateCoffee(username, coffeeId, { rating: 5 });

      // Assert
      expect(rating.rating).toBe(5);
      expect(rating.coffeeId).toBe(coffeeId);
      expect(rating.userId).toBe(mockRater.id);
      expect(prismaMock.rating.upsert).toHaveBeenCalledTimes(1);
    });

    it('deve verificar conquistas do criador após avaliar', async () => {
      // Arrange
      prismaMock.rating.findUnique.mockResolvedValue(null);
      prismaMock.rating.upsert.mockResolvedValue({
        id: 'rating-2',
        coffeeId,
        userId: mockRater.id,
        rating: 4,
        createdAt: new Date(),
        user: mockRater,
        coffee: mockCoffee,
      } as any);

      // Act
      await service.rateCoffee(username, coffeeId, { rating: 4 });

      // Assert
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(achievementService.checkCoffeeAchievements).toHaveBeenCalledWith('maker-id');
    });

    it('deve lançar erro ao tentar avaliar próprio café', async () => {
      // Arrange
      const selfCoffee = { ...mockCoffee, makerId: mockRater.id };
      prismaMock.coffee.findUnique.mockResolvedValue(selfCoffee as any);

      // Act & Assert
      await expect(
        service.rateCoffee(username, coffeeId, { rating: 5 })
      ).rejects.toThrow(ValidationError);
      
      await expect(
        service.rateCoffee(username, coffeeId, { rating: 5 })
      ).rejects.toThrow('Você não pode avaliar seu próprio café');
    });

    it('deve lançar erro se café não encontrado', async () => {
      // Arrange
      prismaMock.coffee.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.rateCoffee(username, 'nonexistent', { rating: 5 })
      ).rejects.toThrow(NotFoundError);
    });

    it('deve lançar erro se usuário não encontrado', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.rateCoffee('nonexistent', coffeeId, { rating: 5 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getRecent', () => {
    it('deve retornar cafés recentes ordenados por data', async () => {
      // Arrange
      const mockCoffees = [
        { 
          id: '1', 
          type: 'MADE' as const,
          makerId: 'user-1',
          timestamp: new Date('2025-12-08'),
          description: null,
          quantity: null,
          maker: { id: 'user-1', username: 'user1', name: 'User 1', avatar: '☕', role: 'MEMBER', setor: 'TI' },
          ratings: [],
        },
        { 
          id: '2', 
          type: 'BROUGHT' as const,
          makerId: 'user-2',
          timestamp: new Date('2025-12-07'),
          description: null,
          quantity: null,
          maker: { id: 'user-2', username: 'user2', name: 'User 2', avatar: '🎁', role: 'MEMBER', setor: 'TI' },
          ratings: [],
        },
      ];
      prismaMock.coffee.findMany.mockResolvedValue(mockCoffees as any);

      // Act
      const coffees = await service.getRecent(10);

      // Assert
      expect(coffees).toHaveLength(2);
      expect(coffees[0].id).toBe('1');
      expect(coffees[1].id).toBe('2');
      expect(prismaMock.coffee.findMany).toHaveBeenCalledTimes(1);
    });

    it('deve respeitar o limite especificado', async () => {
      // Arrange
      prismaMock.coffee.findMany.mockResolvedValue([]);

      // Act
      await service.getRecent(5);

      // Assert
      expect(prismaMock.coffee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      );
    });
  });

  describe('getById', () => {
    it('deve retornar café por ID', async () => {
      // Arrange
      const mockCoffee = {
        id: 'coffee-123',
        type: 'MADE' as const,
        makerId: 'user-1',
        timestamp: new Date(),
        description: 'Café especial',
        quantity: null,
        maker: { id: 'user-1', username: 'user1', name: 'User 1', avatar: '☕', role: 'MEMBER', setor: 'TI' },
        ratings: [],
      };
      prismaMock.coffee.findUnique.mockResolvedValue(mockCoffee as any);

      // Act
      const coffee = await service.getById('coffee-123');

      // Assert
      expect(coffee).toEqual(mockCoffee);
      expect(coffee.id).toBe('coffee-123');
      expect(prismaMock.coffee.findUnique).toHaveBeenCalledTimes(1);
    });

    it('deve lançar erro se café não encontrado', async () => {
      // Arrange
      prismaMock.coffee.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getById('nonexistent')
      ).rejects.toThrow(NotFoundError);
    });
  });
});
