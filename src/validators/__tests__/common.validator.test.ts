/**
 * 🧪 Testes - Common Validators
 */

import { paginationSchema, uuidParamSchema, usernameParamSchema } from '../common.validator';
import { ZodError } from 'zod';

describe('Common Validators', () => {
  describe('uuidParamSchema', () => {
    it('deve aceitar UUID válido', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = uuidParamSchema.parse({ id: validUuid });
      expect(result.id).toBe(validUuid);
    });

    it('deve aceitar UUID em maiúsculas', () => {
      const validUuid = '550E8400-E29B-41D4-A716-446655440000';
      const result = uuidParamSchema.parse({ id: validUuid });
      expect(result.id).toBe(validUuid);
    });

    it('deve rejeitar UUID inválido', () => {
      expect(() => uuidParamSchema.parse({ id: 'invalid-uuid' })).toThrow(ZodError);
      expect(() => uuidParamSchema.parse({ id: '12345' })).toThrow(ZodError);
      expect(() => uuidParamSchema.parse({ id: '' })).toThrow(ZodError);
    });

    it('deve rejeitar UUID com formato errado', () => {
      expect(() => uuidParamSchema.parse({ id: '550e8400-e29b-41d4-a716' })).toThrow(ZodError);
      expect(() => uuidParamSchema.parse({ id: '550e8400e29b41d4a716446655440000' })).toThrow(ZodError);
    });
  });

  describe('usernameParamSchema', () => {
    it('deve aceitar username válido', () => {
      const result = usernameParamSchema.parse({ username: 'testuser' });
      expect(result.username).toBe('testuser');
    });

    it('deve aceitar username com underscores e hífens', () => {
      expect(usernameParamSchema.parse({ username: 'test_user' }).username).toBe('test_user');
      expect(usernameParamSchema.parse({ username: 'test-user' }).username).toBe('test-user');
      expect(usernameParamSchema.parse({ username: 'test_user-123' }).username).toBe('test_user-123');
    });

    it('deve aceitar username com números', () => {
      expect(usernameParamSchema.parse({ username: 'user123' }).username).toBe('user123');
      expect(usernameParamSchema.parse({ username: '123user' }).username).toBe('123user');
    });

    it('deve rejeitar username muito curto', () => {
      expect(() => usernameParamSchema.parse({ username: 'ab' })).toThrow(ZodError);
    });

    it('deve rejeitar username muito longo', () => {
      expect(() => usernameParamSchema.parse({ username: 'a'.repeat(51) })).toThrow(ZodError);
    });

    it('deve aceitar username com 3 caracteres (mínimo)', () => {
      const result = usernameParamSchema.parse({ username: 'abc' });
      expect(result.username).toBe('abc');
    });

    it('deve aceitar username com 50 caracteres (máximo)', () => {
      const username = 'a'.repeat(50);
      const result = usernameParamSchema.parse({ username });
      expect(result.username).toBe(username);
    });
  });

  describe('paginationSchema', () => {
    it('deve aceitar valores padrão', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('deve aceitar page e limit customizados', () => {
      const result = paginationSchema.parse({ page: 5, limit: 50 });
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });

    it('deve aceitar page e limit como strings', () => {
      const result = paginationSchema.parse({ page: '3', limit: '10' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('deve rejeitar page < 1', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ page: -1 })).toThrow(ZodError);
    });

    it('deve rejeitar limit < 1', () => {
      expect(() => paginationSchema.parse({ limit: 0 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ limit: -5 })).toThrow(ZodError);
    });

    it('deve rejeitar limit > 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ limit: 1000 })).toThrow(ZodError);
    });

    it('deve aceitar limit = 100 (máximo)', () => {
      const result = paginationSchema.parse({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('deve aceitar page = 1 (mínimo)', () => {
      const result = paginationSchema.parse({ page: 1 });
      expect(result.page).toBe(1);
    });

    it('deve rejeitar valores não numéricos', () => {
      expect(() => paginationSchema.parse({ page: 'abc' })).toThrow(ZodError);
      expect(() => paginationSchema.parse({ limit: 'xyz' })).toThrow(ZodError);
    });
  });
});
