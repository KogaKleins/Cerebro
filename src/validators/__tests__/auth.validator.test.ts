/**
 * 🧪 Testes - Auth Validators
 */

import { loginSchema } from '../auth.validator';
import { ZodError } from 'zod';

describe('Auth Validators', () => {
  describe('loginSchema', () => {
    it('deve aceitar credenciais válidas', () => {
      const valid = {
        username: 'testuser',
        password: 'password123',
      };

      const result = loginSchema.parse(valid);
      expect(result.username).toBe('testuser');
      expect(result.password).toBe('password123');
    });

    it('deve aceitar username com caracteres especiais', () => {
      const valid = {
        username: 'test_user-123',
        password: 'password123',
      };

      const result = loginSchema.parse(valid);
      expect(result.username).toBe('test_user-123');
    });

    it('deve rejeitar username vazio', () => {
      const invalid = {
        username: '',
        password: 'password123',
      };
      expect(() => loginSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar password vazio', () => {
      const invalid = {
        username: 'testuser',
        password: '',
      };
      expect(() => loginSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar sem username', () => {
      const invalid = {
        password: 'password123',
      };
      expect(() => loginSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar sem password', () => {
      const invalid = {
        username: 'testuser',
      };
      expect(() => loginSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve aceitar username com espaços internos', () => {
      // O schema atual não valida espaços - apenas tamanho mínimo e máximo
      const valid = {
        username: 'test user',
        password: 'password123',
      };
      const result = loginSchema.parse(valid);
      expect(result.username).toBe('test user');
    });

    it('deve rejeitar password muito curto', () => {
      const invalid = {
        username: 'testuser',
        password: '12345',
      };
      expect(() => loginSchema.parse(invalid)).toThrow(ZodError);
    });
  });
});
