/**
 * 🧪 Testes - Validation Middleware
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { validate, validateParams, validateQuery } from '../validation.middleware';
import { ValidationError } from '../../utils/errors';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      params: {},
      query: {},
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('validate (body)', () => {
    const testSchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    it('deve validar body correto e chamar next', () => {
      mockReq.body = { name: 'Test', email: 'test@test.com' };
      
      const middleware = validate(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'Test', email: 'test@test.com' });
    });

    it('deve passar ValidationError para next em body inválido', () => {
      mockReq.body = { name: '', email: 'invalid' };
      
      const middleware = validate(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Validação do body falhou');
    });

    it('deve passar ValidationError quando campo obrigatório está faltando', () => {
      mockReq.body = { name: 'Test' }; // faltando email
      
      const middleware = validate(testSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('deve passar erro genérico para next se não for ZodError', () => {
      const schemaWithCustomError = {
        parse: () => { throw new Error('Erro customizado'); },
      };
      
      const middleware = validate(schemaWithCustomError as any);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Erro customizado');
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
    });

    it('deve validar params corretos e chamar next', () => {
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      
      const middleware = validateParams(paramsSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('deve passar ValidationError para next em params inválidos', () => {
      mockReq.params = { id: 'invalid-uuid' };
      
      const middleware = validateParams(paramsSchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Parâmetros inválidos');
    });

    it('deve passar erro genérico para next se não for ZodError', () => {
      const schemaWithCustomError = {
        parse: () => { throw new Error('Erro de params'); },
      };
      
      const middleware = validateParams(schemaWithCustomError as any);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(20),
    });

    it('deve validar query correta e chamar next', () => {
      mockReq.query = { page: '2', limit: '50' };
      
      const middleware = validateQuery(querySchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: 2, limit: 50 });
    });

    it('deve usar valores padrão quando query está vazia', () => {
      mockReq.query = {};
      
      const middleware = validateQuery(querySchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: 1, limit: 20 });
    });

    it('deve passar ValidationError para next em query inválida', () => {
      mockReq.query = { page: '0', limit: '200' };
      
      const middleware = validateQuery(querySchema);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = mockNext.mock.calls[0][0];
      expect(error.message).toBe('Query string inválida');
    });

    it('deve passar erro genérico para next se não for ZodError', () => {
      const schemaWithCustomError = {
        parse: () => { throw new Error('Erro de query'); },
      };
      
      const middleware = validateQuery(schemaWithCustomError as any);
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
