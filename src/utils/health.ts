/**
 * 🏥 CÉREBRO - Health Checks
 * Verificação de saúde dos componentes do sistema
 * 
 * 🛡️ ROBUSTO: Inclui verificação de filas, rate limiters, circuit breakers e memória
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { circuitBreakers, queues, rateLimiters, memoryMonitor } from './resilience';
import { cache } from './cache';

// ============================================
// TIPOS
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: ComponentHealth;
    memory: ComponentHealth;
    cache?: ComponentHealth;
    circuitBreakers?: ComponentHealth;
    queues?: ComponentHealth;
    rateLimiters?: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  details?: Record<string, unknown>;
}

// ============================================
// HEALTH CHECKS
// ============================================

/**
 * Executa verificação completa de saúde do sistema
 */
export async function checkHealth(prisma: PrismaClient): Promise<HealthStatus> {
  const checks = {
    database: await checkDatabase(prisma),
    memory: checkMemory(),
    cache: checkCache(),
    circuitBreakers: checkCircuitBreakers(),
    queues: checkQueues(),
    rateLimiters: checkRateLimiters(),
  };
  
  // Determinar status geral
  const allUp = Object.values(checks).every(c => c.status === 'up');
  const anyDown = Object.values(checks).some(c => c.status === 'down');
  const anyDegraded = Object.values(checks).some(c => c.status === 'degraded');
  
  let status: HealthStatus['status'];
  if (allUp) {
    status = 'healthy';
  } else if (anyDown) {
    status = 'unhealthy';
  } else if (anyDegraded) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }
  
  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '2.0.0',
    checks,
  };
}

/**
 * Verifica conexão com banco de dados
 */
async function checkDatabase(prisma: PrismaClient): Promise<ComponentHealth> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    
    // Se a query demorou mais de 1 segundo, considerar degradado
    return {
      status: responseTime < 1000 ? 'up' : 'degraded',
      responseTime,
      details: responseTime >= 1000 ? { warning: 'Resposta lenta do banco de dados' } : undefined
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      status: 'down',
      details: { error: (error as Error).message },
    };
  }
}

/**
 * Verifica uso de memória
 */
function checkMemory(): ComponentHealth {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const percentUsed = (heapUsedMB / heapTotalMB) * 100;
  
  let status: ComponentHealth['status'] = 'up';
  if (percentUsed >= 90) {
    status = 'down';
  } else if (percentUsed >= 75) {
    status = 'degraded';
  }
  
  return {
    status,
    details: {
      heapUsedMB,
      heapTotalMB,
      percentUsed: Math.round(percentUsed),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
      memoryMonitorStats: memoryMonitor.getStats()
    },
  };
}

/**
 * 🛡️ Verifica estado do cache Redis
 */
function checkCache(): ComponentHealth {
  const isEnabled = cache.isEnabled();
  
  return {
    status: 'up', // Cache é opcional, então sempre "up" mesmo se desabilitado
    details: {
      enabled: isEnabled,
      note: isEnabled ? 'Redis conectado' : 'Cache desabilitado (sistema funciona sem Redis)'
    }
  };
}

/**
 * 🛡️ Verifica estado dos circuit breakers
 */
function checkCircuitBreakers(): ComponentHealth {
  const stats = {
    database: circuitBreakers.database.getStats(),
    redis: circuitBreakers.redis.getStats(),
    external: circuitBreakers.external.getStats()
  };
  
  // Verificar se algum está OPEN
  const hasOpen = Object.values(stats).some(s => s.state === 'OPEN');
  const hasHalfOpen = Object.values(stats).some(s => s.state === 'HALF_OPEN');
  
  let status: ComponentHealth['status'] = 'up';
  if (hasOpen) {
    status = 'degraded';
  } else if (hasHalfOpen) {
    status = 'up'; // HALF_OPEN é estado de recuperação, ok
  }
  
  return {
    status,
    details: stats
  };
}

/**
 * 🛡️ Verifica estado das filas de processamento
 */
function checkQueues(): ComponentHealth {
  const stats = {
    achievement: queues.achievement.getStats(),
    xpCredit: queues.xpCredit.getStats(),
    notification: queues.notification.getStats()
  };
  
  // Verificar se alguma fila está muito cheia (> 80% da capacidade)
  const totalPending = stats.achievement.pending + stats.xpCredit.pending + stats.notification.pending;
  const maxCapacity = 2000; // Soma das capacidades máximas
  const utilizationPercent = (totalPending / maxCapacity) * 100;
  
  let status: ComponentHealth['status'] = 'up';
  if (utilizationPercent >= 90) {
    status = 'down';
  } else if (utilizationPercent >= 70) {
    status = 'degraded';
  }
  
  return {
    status,
    details: {
      ...stats,
      totalPending,
      utilizationPercent: Math.round(utilizationPercent)
    }
  };
}

/**
 * 🛡️ Verifica estado dos rate limiters
 */
function checkRateLimiters(): ComponentHealth {
  const stats = {
    chatMessage: rateLimiters.chatMessage.getStats(),
    chatReaction: rateLimiters.chatReaction.getStats(),
    coffeeRegister: rateLimiters.coffeeRegister.getStats(),
    apiGeneral: rateLimiters.apiGeneral.getStats()
  };
  
  // Contar usuários bloqueados
  const totalBlocked = Object.values(stats).reduce((sum, s) => sum + s.blockedEntries, 0);
  
  // Se muitos usuários estão bloqueados, pode indicar ataque ou problema
  let status: ComponentHealth['status'] = 'up';
  if (totalBlocked > 50) {
    status = 'degraded';
  }
  
  return {
    status,
    details: {
      ...stats,
      totalBlocked,
      warning: totalBlocked > 20 ? 'Muitos usuários bloqueados - possível ataque ou problema' : undefined
    }
  };
}

// ============================================
// SIMPLE CHECKS (para load balancers/k8s)
// ============================================

/**
 * Health check básico (apenas status ok)
 */
export function basicHealth(): { status: string } {
  return { status: 'ok' };
}

/**
 * Readiness check - verifica se a aplicação está pronta para receber tráfego
 */
export async function readinessCheck(prisma: PrismaClient): Promise<{ ready: boolean; details?: string }> {
  try {
    // Verificar banco de dados
    await prisma.$queryRaw`SELECT 1`;
    
    // Verificar se não está em estado crítico
    const memStats = memoryMonitor.getStats();
    if (memStats.usagePercent > 95) {
      return { ready: false, details: 'Memória crítica' };
    }
    
    // Verificar circuit breaker do banco
    const dbCircuit = circuitBreakers.database.getState();
    if (dbCircuit === 'OPEN') {
      return { ready: false, details: 'Circuit breaker do banco está aberto' };
    }
    
    return { ready: true };
  } catch (error) {
    return { ready: false, details: (error as Error).message };
  }
}

/**
 * Liveness check - verifica se a aplicação está viva
 */
export function livenessCheck(): { alive: boolean } {
  return { alive: true };
}
