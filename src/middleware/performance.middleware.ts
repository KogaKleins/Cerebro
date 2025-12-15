/**
 * 🧠 CÉREBRO - Performance Middleware
 * Middleware para monitoramento de performance das requisições
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Threshold para considerar uma requisição lenta (ms)
const SLOW_REQUEST_THRESHOLD = parseInt(process.env.SLOW_REQUEST_THRESHOLD || '500', 10);

/**
 * Middleware para medir e registrar tempo de resposta das requisições
 * 
 * Funcionalidades:
 * - Adiciona header X-Response-Time com o tempo de resposta
 * - Loga requisições lentas (> threshold)
 * - Loga métricas de performance
 */
export function performanceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    
    // Listener para quando a resposta for finalizada
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationNs = Number(end - start);
      const durationMs = durationNs / 1_000_000; // Converter para milissegundos
      
      // Adicionar header de tempo de resposta
      // Nota: headers só podem ser setados antes de res.end()
      // Este header é mais para debugging, já que o response já foi enviado
      
      // Log de requisições lentas
      if (durationMs > SLOW_REQUEST_THRESHOLD) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.path,
          duration: `${durationMs.toFixed(2)}ms`,
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      }
      
      // Log de performance em modo debug
      logger.debug('Request completed', {
        method: req.method,
        path: req.path,
        duration: `${durationMs.toFixed(2)}ms`,
        statusCode: res.statusCode,
      });
    });
    
    // Adicionar timestamp de início na requisição
    (req as any).startTime = start;
    
    next();
  };
}

/**
 * Helper para obter o tempo decorrido desde o início da requisição
 */
export function getRequestDuration(req: Request): number {
  const start = (req as any).startTime;
  if (!start) return 0;
  
  const end = process.hrtime.bigint();
  return Number(end - start) / 1_000_000;
}

/**
 * Middleware para adicionar header X-Response-Time
 * Deve ser usado antes de enviar a resposta
 */
export function responseTimeHeader() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime();
    
    // Interceptar res.json e res.send para adicionar o header
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    const addResponseTime = () => {
      const diff = process.hrtime(start);
      const durationMs = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);
      res.setHeader('X-Response-Time', `${durationMs}ms`);
    };
    
    res.json = function (body: any) {
      addResponseTime();
      return originalJson(body);
    };
    
    res.send = function (body: any) {
      addResponseTime();
      return originalSend(body);
    };
    
    next();
  };
}
