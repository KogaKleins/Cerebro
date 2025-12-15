/**
 * 🧠 CÉREBRO - Validation Middleware
 * Middleware para validação de dados com Zod
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Valida o body da requisição com um schema Zod
 */
export function validate(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Validação do body falhou', error.issues));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Valida os params da requisição com um schema Zod
 */
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Parâmetros inválidos', error.issues));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Valida a query string da requisição com um schema Zod
 */
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(new ValidationError('Query string inválida', error.issues));
      } else {
        next(error);
      }
    }
  };
}
