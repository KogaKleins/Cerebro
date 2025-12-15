/**
 * 📊 CÉREBRO - Metrics Middleware
 * Middleware para coleta de métricas HTTP
 */

import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestTotal } from '../utils/metrics';

/**
 * Middleware que coleta métricas de requisições HTTP
 * - Duração das requisições (histograma)
 * - Total de requisições (contador)
 * 
 * Labels utilizados:
 * - method: GET, POST, PUT, DELETE, etc
 * - route: caminho da rota
 * - status_code: código HTTP de resposta
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Não coletar métricas para o próprio endpoint de métricas
  if (req.path === '/metrics') {
    return next();
  }

  const start = Date.now();
  
  // Listener para quando a resposta for finalizada
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    // Usar route path se disponível, senão usar path normalizado
    const route = normalizeRoute(req.route?.path || req.path);
    
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    
    // Registrar duração no histograma
    httpRequestDuration.observe(labels, duration);
    
    // Incrementar contador de requisições
    httpRequestTotal.inc(labels);
  });
  
  next();
}

/**
 * Normaliza o path da rota para evitar explosão de cardinalidade
 * Ex: /api/users/123 -> /api/users/:id
 */
function normalizeRoute(path: string): string {
  // Substituir UUIDs por :id
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  
  // Substituir números isolados por :id
  normalized = normalized.replace(/\/\d+/g, '/:id');
  
  // Limitar tamanho para evitar rotas muito longas
  if (normalized.length > 50) {
    normalized = normalized.substring(0, 50) + '...';
  }
  
  return normalized;
}
