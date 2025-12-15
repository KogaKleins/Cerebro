/**
 * 🧪 Testes - Coffee Validators
 */

import { createCoffeeSchema, rateCoffeeSchema } from '../coffee.validator';
import { ZodError } from 'zod';

describe('Coffee Validators', () => {
  describe('createCoffeeSchema', () => {
    it('deve aceitar dados válidos (MADE)', () => {
      const valid = {
        type: 'MADE',
        description: 'Café expresso',
      };

      const result = createCoffeeSchema.parse(valid);
      expect(result.type).toBe('MADE');
      expect(result.description).toBe('Café expresso');
    });

    it('deve aceitar dados válidos (BROUGHT)', () => {
      const valid = {
        type: 'BROUGHT',
        description: 'Café especial da padaria',
      };

      const result = createCoffeeSchema.parse(valid);
      expect(result.type).toBe('BROUGHT');
    });

    it('deve aceitar type sem description', () => {
      const valid = { type: 'MADE' };
      const result = createCoffeeSchema.parse(valid);
      expect(result.type).toBe('MADE');
      expect(result.description).toBeUndefined();
    });

    it('deve aceitar description opcional', () => {
      const valid = { 
        type: 'MADE',
        description: 'Café com leite',
      };
      const result = createCoffeeSchema.parse(valid);
      expect(result.description).toBe('Café com leite');
    });

    it('deve rejeitar type inválido', () => {
      const invalid = { type: 'INVALID' };
      expect(() => createCoffeeSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar description muito longa', () => {
      const invalid = {
        type: 'MADE',
        description: 'a'.repeat(1001),
      };
      expect(() => createCoffeeSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve aceitar description vazia', () => {
      // Description é opcional e aceita string vazia
      const valid = {
        type: 'MADE',
        description: '',
      };
      const result = createCoffeeSchema.parse(valid);
      expect(result.description).toBe('');
    });

    it('deve rejeitar sem type', () => {
      const invalid = { description: 'Café' };
      expect(() => createCoffeeSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve aceitar quantity válida', () => {
      const valid = {
        type: 'MADE',
        quantity: 5,
      };
      const result = createCoffeeSchema.parse(valid);
      expect(result.quantity).toBe(5);
    });

    it('deve rejeitar quantity negativa', () => {
      const invalid = {
        type: 'MADE',
        quantity: -1,
      };
      expect(() => createCoffeeSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar quantity zero', () => {
      const invalid = {
        type: 'MADE',
        quantity: 0,
      };
      expect(() => createCoffeeSchema.parse(invalid)).toThrow(ZodError);
    });
  });

  describe('rateCoffeeSchema', () => {
    it('deve aceitar rating válido (1-5)', () => {
      [1, 2, 3, 4, 5].forEach(rating => {
        const result = rateCoffeeSchema.parse({ rating });
        expect(result.rating).toBe(rating);
      });
    });

    it('deve rejeitar rating < 1', () => {
      expect(() => rateCoffeeSchema.parse({ rating: 0 })).toThrow(ZodError);
      expect(() => rateCoffeeSchema.parse({ rating: -1 })).toThrow(ZodError);
    });

    it('deve rejeitar rating > 5', () => {
      expect(() => rateCoffeeSchema.parse({ rating: 6 })).toThrow(ZodError);
      expect(() => rateCoffeeSchema.parse({ rating: 100 })).toThrow(ZodError);
    });

    it('deve rejeitar rating não inteiro', () => {
      expect(() => rateCoffeeSchema.parse({ rating: 3.5 })).toThrow(ZodError);
      expect(() => rateCoffeeSchema.parse({ rating: 4.9 })).toThrow(ZodError);
    });

    it('deve rejeitar rating não numérico', () => {
      expect(() => rateCoffeeSchema.parse({ rating: '5' })).toThrow(ZodError);
      expect(() => rateCoffeeSchema.parse({ rating: 'five' })).toThrow(ZodError);
    });

    it('deve rejeitar sem rating', () => {
      expect(() => rateCoffeeSchema.parse({})).toThrow(ZodError);
    });

    it('deve rejeitar rating null', () => {
      expect(() => rateCoffeeSchema.parse({ rating: null })).toThrow(ZodError);
    });

    it('deve rejeitar rating undefined', () => {
      expect(() => rateCoffeeSchema.parse({ rating: undefined })).toThrow(ZodError);
    });
  });
});
