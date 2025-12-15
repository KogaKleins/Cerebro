/**
 * 📊 CÉREBRO - Métricas Prometheus
 * Coleta e exposição de métricas para monitoramento
 */

import client from 'prom-client';

// Criar registro personalizado
const register = new client.Registry();

// Adicionar métricas padrão (CPU, memória, etc)
client.collectDefaultMetrics({ register });

// ============================================
// MÉTRICAS HTTP
// ============================================

/**
 * Histograma de duração de requisições HTTP
 * Mede o tempo de resposta das requisições
 */
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

/**
 * Contador total de requisições HTTP
 */
export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// ============================================
// MÉTRICAS DE NEGÓCIO
// ============================================

/**
 * Contador de cafés criados
 * Labels: type (MADE, BROUGHT)
 */
export const coffeeCreatedCounter = new client.Counter({
  name: 'coffee_created_total',
  help: 'Total number of coffees created',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Contador de avaliações de café
 */
export const coffeeRatedCounter = new client.Counter({
  name: 'coffee_rated_total',
  help: 'Total number of coffee ratings',
  registers: [register],
});

/**
 * Contador de conquistas desbloqueadas
 * Labels: type (first-coffee, coffee-master, etc)
 */
export const achievementUnlockedCounter = new client.Counter({
  name: 'achievement_unlocked_total',
  help: 'Total number of achievements unlocked',
  labelNames: ['type'],
  registers: [register],
});

/**
 * Contador de mensagens de chat
 */
export const chatMessagesCounter = new client.Counter({
  name: 'chat_messages_total',
  help: 'Total number of chat messages sent',
  registers: [register],
});

/**
 * Contador de logins
 */
export const loginCounter = new client.Counter({
  name: 'login_total',
  help: 'Total number of login attempts',
  labelNames: ['status'], // success, failure
  registers: [register],
});

// ============================================
// MÉTRICAS DE INFRAESTRUTURA
// ============================================

/**
 * Gauge de conexões WebSocket ativas
 */
export const activeWebSocketConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

/**
 * Gauge de usuários online
 */
export const usersOnline = new client.Gauge({
  name: 'users_online',
  help: 'Number of users currently online',
  registers: [register],
});

/**
 * Histograma de tempo de resposta do banco de dados
 */
export const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

/**
 * Contador de erros
 */
export const errorCounter = new client.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code'],
  registers: [register],
});

/**
 * Contador de cache hits
 */
export const cacheHits = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register],
});

/**
 * Contador de cache misses
 */
export const cacheMisses = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register],
});

// ============================================
// EXPORTAÇÕES E HELPERS
// ============================================

/**
 * Registro de métricas para uso no endpoint
 */
export const metricsRegistry = register;

/**
 * Função helper para medir tempo de operação
 * Uso:
 * ```
 * const result = await measureDuration(
 *   dbQueryDuration,
 *   { operation: 'select', table: 'users' },
 *   () => prisma.user.findMany()
 * );
 * ```
 */
export function measureDuration<T>(
  histogram: client.Histogram<string>,
  labels: Record<string, string>,
  fn: () => Promise<T>
): Promise<T> {
  const end = histogram.startTimer(labels);
  return fn().finally(() => end());
}

/**
 * Incrementa contador de café criado
 */
export function recordCoffeeCreated(type: 'MADE' | 'BROUGHT') {
  coffeeCreatedCounter.inc({ type });
}

/**
 * Incrementa contador de conquista desbloqueada
 */
export function recordAchievementUnlocked(type: string) {
  achievementUnlockedCounter.inc({ type });
}

/**
 * Incrementa contador de login
 */
export function recordLogin(success: boolean) {
  loginCounter.inc({ status: success ? 'success' : 'failure' });
}

/**
 * Incrementa contador de erro
 */
export function recordError(type: string, code: string | number) {
  errorCounter.inc({ type, code: String(code) });
}

/**
 * Atualiza conexões WebSocket ativas
 */
export function setActiveConnections(count: number) {
  activeWebSocketConnections.set(count);
}

/**
 * Atualiza usuários online
 */
export function setUsersOnline(count: number) {
  usersOnline.set(count);
}
