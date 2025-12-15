/**
 * 🧪 Testes - Error Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from '../error.middleware';
import { AppError, ValidationError, NotFoundError, UnauthorizedError } from '../../utils/errors';

// Mock do logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Error Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  
  beforeEach(() => {
    mockReq = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('deve tratar AppError corretamente', () => {
      const error = new AppError('Erro de teste', 400);
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Erro de teste',
      });
    });

    it('deve tratar ValidationError com detalhes', () => {
      const details = [{ field: 'email', message: 'Email inválido' }];
      const error = new ValidationError('Validação falhou', details);
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validação falhou',
        details,
      });
    });

    it('deve tratar NotFoundError', () => {
      const error = new NotFoundError('Usuário');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Usuário não encontrado',
      });
    });

    it('deve tratar UnauthorizedError', () => {
      const error = new UnauthorizedError();
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Não autorizado',
      });
    });

    it('deve tratar erro genérico em produção', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Erro interno');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Erro interno do servidor',
      });
      
      process.env.NODE_ENV = originalEnv;
    });

    it('deve tratar erro genérico em desenvolvimento (com detalhes)', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const error = new Error('Erro interno detalhado');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Erro interno detalhado',
          stack: expect.any(String),
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });

    it('deve tratar ValidationError sem detalhes', () => {
      const error = new ValidationError('Validação falhou');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validação falhou',
      });
    });
  });

  describe('notFoundHandler', () => {
    it('deve retornar 404 para rotas não encontradas', () => {
      notFoundHandler(mockReq as Request, mockRes as Response);
      
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rota não encontrada',
          path: '/test',
        })
      );
    });

    it('deve incluir o path correto', () => {
      const reqWithDifferentPath = {
        ...mockReq,
        path: '/api/unknown',
      };
      
      notFoundHandler(reqWithDifferentPath as Request, mockRes as Response);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/unknown',
        })
      );
    });
  });
});
