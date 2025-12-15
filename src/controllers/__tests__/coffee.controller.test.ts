/**
 * 🧪 Testes - Coffee Controller
 */

import { Response } from 'express';
import { CoffeeController } from '../coffee.controller';
import { CoffeeService } from '../../services/coffee.service';
import { AuthRequest } from '../../types';
import { NotFoundError, ValidationError } from '../../utils/errors';

// Mock do CoffeeService
const mockCoffeeService = {
  create: jest.fn(),
  rateCoffee: jest.fn(),
  getRecent: jest.fn(),
  getById: jest.fn(),
  getStats: jest.fn(),
} as unknown as jest.Mocked<CoffeeService>;

describe('CoffeeController', () => {
  let controller: CoffeeController;
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    controller = new CoffeeController(mockCoffeeService);
    
    mockReq = {
      user: {
        username: 'testuser',
        name: 'Test User',
        role: 'MEMBER',
      },
      body: {},
      params: {},
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('create', () => {
    it('deve criar café com sucesso', async () => {
      const coffeeData = { type: 'MADE', description: 'Café expresso' };
      const createdCoffee = {
        id: 'coffee-123',
        ...coffeeData,
        makerId: 'user-123',
        timestamp: new Date(),
      };
      
      mockReq.body = coffeeData;
      mockCoffeeService.create.mockResolvedValue(createdCoffee as any);
      
      await controller.create(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockCoffeeService.create).toHaveBeenCalledWith('testuser', coffeeData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdCoffee,
      });
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new ValidationError('Limite diário atingido');
      mockReq.body = { type: 'MADE' };
      mockCoffeeService.create.mockRejectedValue(error);
      
      await controller.create(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('rateCoffee', () => {
    it('deve avaliar café com sucesso', async () => {
      const ratingData = { rating: 5 };
      const createdRating = {
        id: 'rating-123',
        coffeeId: 'coffee-123',
        userId: 'user-456',
        rating: 5,
      };
      
      mockReq.params = { coffeeId: 'coffee-123' };
      mockReq.body = ratingData;
      mockCoffeeService.rateCoffee.mockResolvedValue(createdRating as any);
      
      await controller.rateCoffee(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockCoffeeService.rateCoffee).toHaveBeenCalledWith(
        'testuser',
        'coffee-123',
        ratingData
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdRating,
      });
    });

    it('deve passar erro para next se café não encontrado', async () => {
      const error = new NotFoundError('Café');
      mockReq.params = { coffeeId: 'invalid-id' };
      mockReq.body = { rating: 5 };
      mockCoffeeService.rateCoffee.mockRejectedValue(error);
      
      await controller.rateCoffee(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getRecent', () => {
    it('deve retornar cafés recentes', async () => {
      const coffees = [
        { id: 'coffee-1', type: 'MADE' },
        { id: 'coffee-2', type: 'BROUGHT' },
      ];
      
      mockCoffeeService.getRecent.mockResolvedValue(coffees as any);
      
      await controller.getRecent(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockCoffeeService.getRecent).toHaveBeenCalledWith(50);
      expect(mockRes.json).toHaveBeenCalledWith(coffees);
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new Error('Database error');
      mockCoffeeService.getRecent.mockRejectedValue(error);
      
      await controller.getRecent(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getById', () => {
    it('deve retornar café por ID', async () => {
      const coffee = {
        id: 'coffee-123',
        type: 'MADE',
        description: 'Café expresso',
      };
      
      mockReq.params = { coffeeId: 'coffee-123' };
      mockCoffeeService.getById.mockResolvedValue(coffee as any);
      
      await controller.getById(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockCoffeeService.getById).toHaveBeenCalledWith('coffee-123');
      expect(mockRes.json).toHaveBeenCalledWith(coffee);
    });

    it('deve passar erro para next se café não encontrado', async () => {
      const error = new NotFoundError('Café');
      mockReq.params = { coffeeId: 'invalid-id' };
      mockCoffeeService.getById.mockRejectedValue(error);
      
      await controller.getById(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getStats', () => {
    it('deve retornar estatísticas de café', async () => {
      const stats = {
        totalMade: 100,
        totalBrought: 50,
        topMakers: [],
      };
      
      mockCoffeeService.getStats.mockResolvedValue(stats as any);
      
      await controller.getStats(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockCoffeeService.getStats).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(stats);
    });

    it('deve passar erro para next em caso de falha', async () => {
      const error = new Error('Stats error');
      mockCoffeeService.getStats.mockRejectedValue(error);
      
      await controller.getStats(mockReq as AuthRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
