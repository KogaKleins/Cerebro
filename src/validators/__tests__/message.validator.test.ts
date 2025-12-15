/**
 * 🧪 Testes - Message Validators
 */

import { 
  createMessageSchema, 
  updateMessageSchema, 
  messageIdSchema 
} from '../message.validator';
import { ZodError } from 'zod';

describe('Message Validators', () => {
  describe('createMessageSchema', () => {
    it('deve aceitar mensagem válida', () => {
      const valid = { text: 'Olá, mundo!' };
      const result = createMessageSchema.parse(valid);
      expect(result.text).toBe('Olá, mundo!');
    });

    it('deve aceitar mensagem longa (até 5000 caracteres)', () => {
      const text = 'a'.repeat(5000);
      const result = createMessageSchema.parse({ text });
      expect(result.text).toBe(text);
    });

    it('deve rejeitar mensagem vazia', () => {
      const invalid = { text: '' };
      expect(() => createMessageSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar mensagem muito longa (> 5000 caracteres)', () => {
      const text = 'a'.repeat(5001);
      expect(() => createMessageSchema.parse({ text })).toThrow(ZodError);
    });

    it('deve rejeitar sem campo text', () => {
      expect(() => createMessageSchema.parse({})).toThrow(ZodError);
    });

    it('deve rejeitar text null', () => {
      expect(() => createMessageSchema.parse({ text: null })).toThrow(ZodError);
    });

    it('deve aceitar mensagem com caracteres especiais', () => {
      const valid = { text: '🎉 Café pronto! @todos #café' };
      const result = createMessageSchema.parse(valid);
      expect(result.text).toBe('🎉 Café pronto! @todos #café');
    });

    it('deve aceitar mensagem com quebras de linha', () => {
      const valid = { text: 'Linha 1\nLinha 2\nLinha 3' };
      const result = createMessageSchema.parse(valid);
      expect(result.text).toBe('Linha 1\nLinha 2\nLinha 3');
    });
  });

  describe('updateMessageSchema', () => {
    it('deve aceitar atualização válida', () => {
      const valid = { text: 'Mensagem atualizada' };
      const result = updateMessageSchema.parse(valid);
      expect(result.text).toBe('Mensagem atualizada');
    });

    it('deve rejeitar atualização vazia', () => {
      const invalid = { text: '' };
      expect(() => updateMessageSchema.parse(invalid)).toThrow(ZodError);
    });

    it('deve rejeitar atualização muito longa', () => {
      const text = 'a'.repeat(5001);
      expect(() => updateMessageSchema.parse({ text })).toThrow(ZodError);
    });

    it('deve aceitar atualização com 5000 caracteres', () => {
      const text = 'b'.repeat(5000);
      const result = updateMessageSchema.parse({ text });
      expect(result.text.length).toBe(5000);
    });
  });

  describe('messageIdSchema', () => {
    it('deve aceitar UUID válido', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = messageIdSchema.parse({ messageId: validUuid });
      expect(result.messageId).toBe(validUuid);
    });

    it('deve aceitar UUID em maiúsculas', () => {
      const validUuid = '550E8400-E29B-41D4-A716-446655440000';
      const result = messageIdSchema.parse({ messageId: validUuid });
      expect(result.messageId).toBe(validUuid);
    });

    it('deve rejeitar ID inválido', () => {
      expect(() => messageIdSchema.parse({ messageId: 'invalid' })).toThrow(ZodError);
    });

    it('deve rejeitar ID vazio', () => {
      expect(() => messageIdSchema.parse({ messageId: '' })).toThrow(ZodError);
    });

    it('deve rejeitar sem messageId', () => {
      expect(() => messageIdSchema.parse({})).toThrow(ZodError);
    });

    it('deve rejeitar UUID parcial', () => {
      expect(() => messageIdSchema.parse({ messageId: '550e8400-e29b-41d4' })).toThrow(ZodError);
    });

    it('deve rejeitar UUID sem hífens', () => {
      expect(() => messageIdSchema.parse({ messageId: '550e8400e29b41d4a716446655440000' })).toThrow(ZodError);
    });
  });
});
