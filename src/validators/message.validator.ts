/**
 * 🧠 CÉREBRO - Message Validators
 * Schemas de validação Zod para mensagens
 */

import { z } from 'zod';

export const createMessageSchema = z.object({
  text: z.string()
    .min(1, 'Mensagem não pode estar vazia')
    .max(5000, 'Mensagem muito longa (máx 5000 caracteres)'),
});

export const updateMessageSchema = z.object({
  text: z.string()
    .min(1, 'Mensagem não pode estar vazia')
    .max(5000, 'Mensagem muito longa (máx 5000 caracteres)'),
});

export const messageIdSchema = z.object({
  messageId: z.string().uuid('ID de mensagem inválido'),
});

export type CreateMessageDto = z.infer<typeof createMessageSchema>;
export type UpdateMessageDto = z.infer<typeof updateMessageSchema>;
export type MessageIdParams = z.infer<typeof messageIdSchema>;
