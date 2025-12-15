/**
 * 🧠 CÉREBRO - Coffee Validators
 * Schemas de validação Zod para cafés
 */

import { z } from 'zod';

export const createCoffeeSchema = z.object({
  type: z.enum(['MADE', 'BROUGHT'], {
    message: 'Tipo deve ser MADE ou BROUGHT'
  }),
  description: z.string().max(500, 'Descrição muito longa (máx 500 caracteres)').optional(),
  quantity: z.number().int().positive('Quantidade deve ser positiva').optional(),
});

export const rateCoffeeSchema = z.object({
  rating: z.number().int().min(1, 'Avaliação mínima é 1').max(5, 'Avaliação máxima é 5'),
});

export const coffeeIdSchema = z.object({
  coffeeId: z.string().uuid('ID de café inválido'),
});

export const coffeeStatsQuerySchema = z.object({
  userId: z.string().uuid('ID de usuário inválido').optional(),
});

export type CreateCoffeeDto = z.infer<typeof createCoffeeSchema>;
export type RateCoffeeDto = z.infer<typeof rateCoffeeSchema>;
export type CoffeeIdParams = z.infer<typeof coffeeIdSchema>;
export type CoffeeStatsQuery = z.infer<typeof coffeeStatsQuerySchema>;
