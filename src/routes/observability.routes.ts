/**
 * 🧠 CÉREBRO - Observability Routes
 * Rotas de métricas, health check e monitoramento
 */

import { Router, Request, Response } from 'express';
import { metricsRegistry } from '../utils/metrics';
import { checkHealth, readinessCheck, livenessCheck } from '../utils/health';
import { getRepositories } from '../repositories';

const router = Router();
const repos = getRepositories();

/**
 * GET /metrics
 * Métricas Prometheus (para scraping)
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (error) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * GET /health/detailed
 * Health check detalhado (com status de componentes)
 */
router.get('/health/detailed', async (_req: Request, res: Response) => {
  const health = await checkHealth(repos.prisma);
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /ready
 * Readiness check (para Kubernetes - app está pronta?)
 */
router.get('/ready', async (_req: Request, res: Response) => {
  const result = await readinessCheck(repos.prisma);
  res.status(result.ready ? 200 : 503).json(result);
});

/**
 * GET /live
 * Liveness check (para Kubernetes - app está viva?)
 */
router.get('/live', (_req: Request, res: Response) => {
  res.json(livenessCheck());
});

export { router as observabilityRoutes };
