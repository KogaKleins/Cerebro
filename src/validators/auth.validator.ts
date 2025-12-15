/**
 * 🧠 CÉREBRO - Auth Validators
 * Schemas de validação Zod para autenticação
 */

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username deve ter no mínimo 3 caracteres').max(50),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type VerifyTokenDto = z.infer<typeof verifyTokenSchema>;
