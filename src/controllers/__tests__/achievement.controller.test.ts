/**
 * 🧪 Testes - Achievement Controller
 */

import { Response } from 'express';
import { AchievementController } from '../achievement.controller';
import { AchievementService } from '../../services/achievement.service';
import { UserRepository } from '../../repositories/user.repository';
import { AuthRequest } from '../../types';
import { AppError } from '../../utils/errors';

// Mocks
const mockAchievementService = {
  getUserAchievements: jest.fn(),
  checkCoffeeAchievements: jest.fn(),
  countUserAchievements: jest.fn(),
  getAllAchievementsGrouped: jest.fn(),
} as unknown as jest.Mocked<AchievementService>;

const mockUserRepository = {
  findByUsername: jest.fn(),
  findAll: jest.fn(),
} as unknown as jest.Mocked<UserRepository>;

describe('AchievementController', () => {
  let controller: AchievementController;
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
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

  const mockAchievements = [
    {
      id: 'ach-1',
      userId: 'user-123',
      type: 'first-coffee',
      title: 'Primeira Xícara',
      description: 'Fez o primeiro café',
      unlockedAt: new Date(),
    },
    {
      id: 'ach-2',
      userId: 'user-123',
      type: 'coffee-master',
      title: 'Mestre do Café',
      description: 'Fez 10 cafés',
      unlockedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    controller = new AchievementController(mockAchievementService, mockUserRepository);
    
    mockReq = {
      user: {
        username: 'testuser',
        name: 'Test User',
        role: 'MEMBER',
      },
      params: {},
      query: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('getAll', () => {
    it('deve retornar conquistas de um usuário específico via query param', async () => {
      mockReq.query = { username: 'testuser' };
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockAchievementService.getUserAchievements.mockResolvedValue(mockAchievements);
      
      await controller.getAll(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockAchievementService.getUserAchievements).toHaveBeenCalledWith('user-123');
      // O controller transforma o array em objeto indexado por type
      expect(mockRes.json).toHaveBeenCalledWith({
        'first-coffee': expect.objectContaining({
          title: 'Primeira Xícara',
          description: 'Fez o primeiro café',
        }),
        'coffee-master': expect.objectContaining({
          title: 'Mestre do Café',
          description: 'Fez 10 cafés',
        }),
      });
    });

    it('deve retornar array vazio se usuário não existir (query param)', async () => {
      mockReq.query = { username: 'nonexistent' };
      mockUserRepository.findByUsername.mockResolvedValue(null);
      
      await controller.getAll(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('deve retornar conquistas de todos os usuários quando sem query param e sem user no JWT', async () => {
      mockReq.query = {};
      mockReq.user = undefined; // Simular requisição sem autenticação
      mockAchievementService.getAllAchievementsGrouped.mockResolvedValue({
        testuser: [
          { id: 'first-coffee', type: 'first-coffee', title: 'Primeira Xícara', description: 'Fez o primeiro café', unlockedAt: new Date() },
          { id: 'coffee-master', type: 'coffee-master', title: 'Mestre do Café', description: 'Fez 10 cafés', unlockedAt: new Date() },
        ],
      });
      
      await controller.getAll(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockAchievementService.getAllAchievementsGrouped).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        testuser: expect.arrayContaining([
          expect.objectContaining({ type: 'first-coffee' }),
          expect.objectContaining({ type: 'coffee-master' }),
        ]),
      });
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new Error('Database error');
      mockReq.query = { username: 'testuser' };
      mockUserRepository.findByUsername.mockRejectedValue(error);
      
      await controller.getAll(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getByUsername', () => {
    it('deve retornar conquistas do usuário', async () => {
      mockReq.params = { username: 'testuser' };
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockAchievementService.getUserAchievements.mockResolvedValue(mockAchievements);
      
      await controller.getByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockAchievementService.getUserAchievements).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith(mockAchievements);
    });

    it('deve retornar array vazio se usuário não existir', async () => {
      mockReq.params = { username: 'nonexistent' };
      mockUserRepository.findByUsername.mockResolvedValue(null);
      
      await controller.getByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('deve lançar erro se username não for fornecido', async () => {
      mockReq.params = {};
      
      await controller.getByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Nome de usuário é obrigatório');
      expect(error.statusCode).toBe(400);
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new Error('Database error');
      mockReq.params = { username: 'testuser' };
      mockUserRepository.findByUsername.mockRejectedValue(error);
      
      await controller.getByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('checkAchievements', () => {
    it('deve verificar e retornar conquistas do usuário', async () => {
      mockReq.params = { username: 'testuser' };
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockAchievementService.checkCoffeeAchievements.mockResolvedValue(undefined);
      mockAchievementService.getUserAchievements.mockResolvedValue(mockAchievements);
      
      await controller.checkAchievements(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockAchievementService.checkCoffeeAchievements).toHaveBeenCalledWith('user-123');
      expect(mockAchievementService.getUserAchievements).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        totalAchievements: mockAchievements,
        message: '2 conquista(s) desbloqueada(s)',
      });
    });

    it('deve lançar erro se username não for fornecido', async () => {
      mockReq.params = {};
      
      await controller.checkAchievements(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Nome de usuário é obrigatório');
    });

    it('deve lançar erro se usuário não existir', async () => {
      mockReq.params = { username: 'nonexistent' };
      mockUserRepository.findByUsername.mockResolvedValue(null);
      
      await controller.checkAchievements(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Usuário não encontrado');
      expect(error.statusCode).toBe(404);
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new Error('Database error');
      mockReq.params = { username: 'testuser' };
      mockUserRepository.findByUsername.mockRejectedValue(error);
      
      await controller.checkAchievements(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('countByUsername', () => {
    it('deve retornar contagem de conquistas do usuário', async () => {
      mockReq.params = { username: 'testuser' };
      mockUserRepository.findByUsername.mockResolvedValue(mockUser);
      mockAchievementService.countUserAchievements.mockResolvedValue(5);
      
      await controller.countByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockAchievementService.countUserAchievements).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith({ count: 5 });
    });

    it('deve retornar count 0 se usuário não existir', async () => {
      mockReq.params = { username: 'nonexistent' };
      mockUserRepository.findByUsername.mockResolvedValue(null);
      
      await controller.countByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({ count: 0 });
    });

    it('deve lançar erro se username não for fornecido', async () => {
      mockReq.params = {};
      
      await controller.countByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Nome de usuário é obrigatório');
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new Error('Database error');
      mockReq.params = { username: 'testuser' };
      mockUserRepository.findByUsername.mockRejectedValue(error);
      
      await controller.countByUsername(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
