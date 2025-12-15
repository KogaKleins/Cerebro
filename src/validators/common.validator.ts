/**
 * 🧠 CÉREBRO - Common Validators
 * Schemas de validação Zod comuns
 */

import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
});

export const usernameParamSchema = z.object({
  username: z.string().min(3).max(50),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type UuidParams = z.infer<typeof uuidParamSchema>;
export type UsernameParams = z.infer<typeof usernameParamSchema>;
