/**
 * 🧠 CÉREBRO - Legacy Validators
 * Schemas de validação Zod para rotas legadas (v1)
 */

import { z } from 'zod';

// Lista de itens especiais válidos
export const SPECIAL_ITEMS = [
  'filtro-cafe',
  'bolo',
  'bolo-supreme',
  'bolacha',
  'bolacha-recheada',
  'biscoito',
  'sonho'
] as const;

export const legacyCoffeeSchema = z.object({
  name: z.string().max(100, 'Nome muito longo').optional(),
  note: z.string().max(500, 'Nota muito longa').optional(),
  // 🆕 Campo opcional para indicar item especial
  specialItem: z.enum(SPECIAL_ITEMS).optional(),
});

export const legacyMessageSchema = z.object({
  text: z.string().min(1, 'Texto é obrigatório').max(2000, 'Mensagem muito longa'),
});

export const legacyRatingSchema = z.object({
  raters: z.array(z.object({
    name: z.string(),
    stars: z.number().int().min(1).max(5)
  })).optional(),
});

// 🆕 Schema para registrar item especial
export const specialItemSchema = z.object({
  name: z.string().max(100, 'Nome muito longo').optional(),
  itemType: z.enum(SPECIAL_ITEMS),
  note: z.string().max(500, 'Nota muito longa').optional(),
});

export type LegacyCoffeeDto = z.infer<typeof legacyCoffeeSchema>;
export type LegacyMessageDto = z.infer<typeof legacyMessageSchema>;
export type LegacyRatingDto = z.infer<typeof legacyRatingSchema>;
export type SpecialItemDto = z.infer<typeof specialItemSchema>;
