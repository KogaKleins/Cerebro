/**
 * 🧠 CÉREBRO - Error Handling Middleware
 * Middleware global para tratamento de erros
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Middleware de tratamento de erros
 * Deve ser o último middleware registrado no Express
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Erro operacional conhecido
  if (err instanceof AppError) {
    logger.warn('Operational error', {
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    
    const response: any = {
      error: err.message,
    };

    // Adicionar detalhes de validação se for ValidationError
    if (err instanceof ValidationError && err.details) {
      response.details = err.details;
    }
    
    return res.status(err.statusCode).json(response);
  }
  
  // Erro não esperado (bug)
  logger.error('Unexpected error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });
  
  // Em produção, não expor detalhes do erro
  const message = process.env.NODE_ENV === 'production' 
    ? 'Erro interno do servidor'
    : err.message;

  const response: any = {
    error: message,
  };

  // Em desenvolvimento, incluir stack trace
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }
  
  return res.status(500).json(response);
}

/**
 * Middleware para capturar rotas não encontradas
 */
export function notFoundHandler(req: Request, res: Response) {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
  });
}
