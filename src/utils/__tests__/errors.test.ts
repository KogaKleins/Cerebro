/**
 * 🧪 Testes - Custom Error Classes
 */

import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
} from '../errors';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('deve criar erro com mensagem e status code', () => {
      const error = new AppError('Erro de teste', 400);
      
      expect(error.message).toBe('Erro de teste');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('deve criar erro não operacional quando especificado', () => {
      const error = new AppError('Erro crítico', 500, false);
      
      expect(error.isOperational).toBe(false);
    });

    it('deve capturar stack trace', () => {
      const error = new AppError('Erro com stack', 400);
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('Erro com stack');
    });
  });

  describe('ValidationError', () => {
    it('deve criar erro de validação com status 400', () => {
      const error = new ValidationError('Campo inválido');
      
      expect(error.message).toBe('Campo inválido');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    it('deve criar erro de validação com detalhes', () => {
      const details = [{ field: 'email', message: 'Email inválido' }];
      const error = new ValidationError('Validação falhou', details);
      
      expect(error.details).toEqual(details);
    });

    it('deve criar erro de validação sem detalhes', () => {
      const error = new ValidationError('Validação falhou');
      
      expect(error.details).toBeUndefined();
    });
  });

  describe('UnauthorizedError', () => {
    it('deve criar erro com mensagem padrão e status 401', () => {
      const error = new UnauthorizedError();
      
      expect(error.message).toBe('Não autorizado');
      expect(error.statusCode).toBe(401);
    });

    it('deve criar erro com mensagem customizada', () => {
      const error = new UnauthorizedError('Token expirado');
      
      expect(error.message).toBe('Token expirado');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('deve criar erro com mensagem padrão e status 403', () => {
      const error = new ForbiddenError();
      
      expect(error.message).toBe('Acesso negado');
      expect(error.statusCode).toBe(403);
    });

    it('deve criar erro com mensagem customizada', () => {
      const error = new ForbiddenError('Permissão insuficiente');
      
      expect(error.message).toBe('Permissão insuficiente');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('deve criar erro com mensagem formatada e status 404', () => {
      const error = new NotFoundError('Usuário');
      
      expect(error.message).toBe('Usuário não encontrado');
      expect(error.statusCode).toBe(404);
    });

    it('deve criar erro para diferentes recursos', () => {
      const coffeeError = new NotFoundError('Café');
      const messageError = new NotFoundError('Mensagem');
      
      expect(coffeeError.message).toBe('Café não encontrado');
      expect(messageError.message).toBe('Mensagem não encontrado');
    });
  });

  describe('ConflictError', () => {
    it('deve criar erro com status 409', () => {
      const error = new ConflictError('Recurso já existe');
      
      expect(error.message).toBe('Recurso já existe');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('TooManyRequestsError', () => {
    it('deve criar erro com mensagem padrão e status 429', () => {
      const error = new TooManyRequestsError();
      
      expect(error.message).toBe('Muitas requisições. Tente novamente mais tarde.');
      expect(error.statusCode).toBe(429);
    });

    it('deve criar erro com mensagem customizada', () => {
      const error = new TooManyRequestsError('Limite de tentativas excedido');
      
      expect(error.message).toBe('Limite de tentativas excedido');
      expect(error.statusCode).toBe(429);
    });
  });

  describe('InternalServerError', () => {
    it('deve criar erro com mensagem padrão e status 500', () => {
      const error = new InternalServerError();
      
      expect(error.message).toBe('Erro interno do servidor');
      expect(error.statusCode).toBe(500);
    });

    it('deve criar erro não operacional por padrão', () => {
      const error = new InternalServerError();
      
      expect(error.isOperational).toBe(false);
    });

    it('deve criar erro com mensagem customizada', () => {
      const error = new InternalServerError('Falha de conexão com banco');
      
      expect(error.message).toBe('Falha de conexão com banco');
    });
  });

  describe('Hierarquia de Erros', () => {
    it('todos os erros devem ser instâncias de AppError', () => {
      expect(new ValidationError('test')).toBeInstanceOf(AppError);
      expect(new UnauthorizedError()).toBeInstanceOf(AppError);
      expect(new ForbiddenError()).toBeInstanceOf(AppError);
      expect(new NotFoundError('test')).toBeInstanceOf(AppError);
      expect(new ConflictError('test')).toBeInstanceOf(AppError);
      expect(new TooManyRequestsError()).toBeInstanceOf(AppError);
      expect(new InternalServerError()).toBeInstanceOf(AppError);
    });

    it('todos os erros devem ser instâncias de Error', () => {
      expect(new AppError('test', 400)).toBeInstanceOf(Error);
      expect(new ValidationError('test')).toBeInstanceOf(Error);
      expect(new UnauthorizedError()).toBeInstanceOf(Error);
    });
  });
});
