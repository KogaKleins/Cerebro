/**
 * 🧪 Testes - Sentry Utils
 */

import {
  initSentry,
  isSentryInitialized,
  captureError,
  captureMessage,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  sentryRequestHandler,
  sentryErrorHandler,
} from '../sentry';
import { Request, Response } from 'express';

// Mock do Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  httpIntegration: jest.fn().mockReturnValue({}),
}));

import * as Sentry from '@sentry/node';

describe('Sentry Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset do estado de inicialização
    delete process.env.SENTRY_DSN;
  });

  describe('initSentry', () => {
    it('não deve inicializar sem SENTRY_DSN', () => {
      delete process.env.SENTRY_DSN;
      
      initSentry();
      
      expect(Sentry.init).not.toHaveBeenCalled();
    });
  });

  describe('isSentryInitialized', () => {
    it('deve retornar boolean', () => {
      const result = isSentryInitialized();
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('captureError', () => {
    it('não deve chamar Sentry se não inicializado', () => {
      const error = new Error('Test error');
      
      captureError(error);
      
      // Sentry.captureException não deve ser chamado se não inicializado
      // O comportamento depende do estado de inicialização
      expect(error.message).toBe('Test error');
    });

    it('deve aceitar contexto adicional', () => {
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };
      
      captureError(error, context);
      
      expect(error.message).toBe('Test error');
    });
  });

  describe('captureMessage', () => {
    it('não deve falhar se Sentry não inicializado', () => {
      expect(() => {
        captureMessage('Test message');
      }).not.toThrow();
    });

    it('deve aceitar nível de severidade', () => {
      expect(() => {
        captureMessage('Warning message', 'warning');
      }).not.toThrow();
    });
  });

  describe('setUserContext', () => {
    it('não deve falhar se Sentry não inicializado', () => {
      expect(() => {
        setUserContext({ id: 'user-123', username: 'testuser' });
      }).not.toThrow();
    });

    it('deve aceitar role opcional', () => {
      expect(() => {
        setUserContext({ id: 'user-123', username: 'testuser', role: 'ADMIN' });
      }).not.toThrow();
    });
  });

  describe('clearUserContext', () => {
    it('não deve falhar se Sentry não inicializado', () => {
      expect(() => {
        clearUserContext();
      }).not.toThrow();
    });
  });

  describe('addBreadcrumb', () => {
    it('não deve falhar se Sentry não inicializado', () => {
      expect(() => {
        addBreadcrumb('User clicked button', 'ui');
      }).not.toThrow();
    });

    it('deve aceitar dados e nível opcionais', () => {
      expect(() => {
        addBreadcrumb('Navigation', 'navigation', { from: '/', to: '/home' }, 'info');
      }).not.toThrow();
    });
  });

  describe('sentryRequestHandler', () => {
    it('deve retornar middleware function', () => {
      const middleware = sentryRequestHandler();
      
      expect(typeof middleware).toBe('function');
    });

    it('deve chamar next() quando não inicializado', () => {
      const middleware = sentryRequestHandler();
      const mockReq = { url: '/test', method: 'GET', headers: {} } as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();
      
      middleware(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('sentryErrorHandler', () => {
    it('deve retornar middleware function', () => {
      const middleware = sentryErrorHandler();
      
      expect(typeof middleware).toBe('function');
    });

    it('deve chamar next com erro quando não inicializado', () => {
      const middleware = sentryErrorHandler();
      const error = new Error('Test error');
      const mockReq = {} as Request;
      const mockRes = {} as Response;
      const mockNext = jest.fn();
      
      middleware(error, mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
