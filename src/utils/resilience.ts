/**
 * 🛡️ RESILIENCE UTILITIES
 * Utilitários para tornar o servidor robusto e tolerante a falhas
 * 
 * Inclui:
 * - Retry com Backoff Exponencial
 * - Circuit Breaker Pattern
 * - Rate Limiter para WebSocket
 * - Memory Management
 */

import { logger } from './logger';

// ============================================
// RETRY COM BACKOFF EXPONENCIAL
// ============================================

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'P1001', // Prisma - Can't reach database server
    'P1002', // Prisma - Connection timed out
    'P1008', // Prisma - Operations timed out
    'P1017', // Prisma - Server closed connection
    'P2024', // Prisma - Timed out fetching connection
    'P2034', // Prisma - Transaction conflict (deadlock)
    'SQLITE_BUSY',
    'ER_LOCK_DEADLOCK',
    'ER_LOCK_WAIT_TIMEOUT',
    '40001', // PostgreSQL serialization failure
    '40P01', // PostgreSQL deadlock detected
  ],
  onRetry: () => {}
};

/**
 * Executa uma função com retry automático e backoff exponencial
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Verificar se é um erro retryable
      const errorCode = error.code || error.message || '';
      const isRetryable = opts.retryableErrors.some(code => 
        errorCode.includes(code) || (error.meta?.code && error.meta.code.includes(code))
      );
      
      if (!isRetryable || attempt === opts.maxAttempts) {
        logger.error(`❌ ${operationName} falhou após ${attempt} tentativa(s)`, {
          operation: operationName,
          attempt,
          error: error.message,
          code: errorCode,
          isRetryable
        });
        throw error;
      }
      
      // Calcular delay com backoff exponencial + jitter
      const baseDelay = opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
      const jitter = Math.random() * 0.3 * baseDelay; // 0-30% jitter
      const delayMs = Math.min(baseDelay + jitter, opts.maxDelayMs);
      
      logger.warn(`⚠️ ${operationName} falhou (tentativa ${attempt}/${opts.maxAttempts}), retry em ${Math.round(delayMs)}ms`, {
        operation: operationName,
        attempt,
        nextAttempt: attempt + 1,
        delayMs: Math.round(delayMs),
        error: error.message
      });
      
      opts.onRetry(attempt, error, delayMs);
      
      await sleep(delayMs);
    }
  }
  
  throw lastError!;
}

// ============================================
// CIRCUIT BREAKER PATTERN
// ============================================

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal - requisições passam
  OPEN = 'OPEN',         // Falhas demais - requisições bloqueadas
  HALF_OPEN = 'HALF_OPEN' // Testando se serviço voltou
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Falhas para abrir circuito
  successThreshold?: number;      // Sucessos para fechar em HALF_OPEN
  timeout?: number;               // Tempo em ms antes de tentar HALF_OPEN
  resetTimeout?: number;          // Tempo máximo que pode ficar OPEN
}

const DEFAULT_CIRCUIT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,       // 30 segundos
  resetTimeout: 120000  // 2 minutos máximo
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private _lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;
  private readonly options: Required<CircuitBreakerOptions>;
  
  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Verificar se circuito está OPEN
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      
      // Verificar se já passou o timeout para tentar novamente
      if (now < this.nextAttemptTime) {
        logger.warn(`🔴 Circuit breaker ${this.name} está OPEN, requisição rejeitada`, {
          circuitBreaker: this.name,
          state: this.state,
          nextAttemptIn: Math.round((this.nextAttemptTime - now) / 1000) + 's'
        });
        throw new CircuitBreakerOpenError(this.name, this.nextAttemptTime - now);
      }
      
      // Tentar uma requisição de teste (HALF_OPEN)
      this.state = CircuitState.HALF_OPEN;
      logger.info(`🟡 Circuit breaker ${this.name} entrando em HALF_OPEN`, {
        circuitBreaker: this.name
      });
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }
  
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.reset();
        logger.info(`🟢 Circuit breaker ${this.name} fechado após sucessos`, {
          circuitBreaker: this.name,
          successCount: this.successCount
        });
      }
    } else {
      // CLOSED state - reset failure count on success
      this.failureCount = 0;
    }
  }
  
  private onFailure(error: any): void {
    this.failureCount++;
    this._lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Falhou em HALF_OPEN, voltar para OPEN
      this.openCircuit();
      logger.warn(`🔴 Circuit breaker ${this.name} voltou para OPEN após falha em HALF_OPEN`, {
        circuitBreaker: this.name,
        error: error.message
      });
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
      logger.error(`🔴 Circuit breaker ${this.name} aberto após ${this.failureCount} falhas`, {
        circuitBreaker: this.name,
        failureCount: this.failureCount,
        error: error.message
      });
    }
  }
  
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    this.nextAttemptTime = Date.now() + this.options.timeout;
  }
  
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
  
  getState(): CircuitState {
    return this.state;
  }
  
  getStats(): { state: CircuitState; failures: number; successes: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failureCount,
      successes: this.successCount,
      lastFailureTime: this._lastFailureTime
    };
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit breaker ${circuitName} está aberto. Tente novamente em ${Math.round(retryAfterMs / 1000)}s`);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ============================================
// RATE LIMITER PARA WEBSOCKET (por usuário)
// ============================================

export interface RateLimiterOptions {
  windowMs?: number;      // Janela de tempo em ms
  maxRequests?: number;   // Máximo de requisições por janela
  blockDurationMs?: number; // Duração do bloqueio quando excede
}

const DEFAULT_RATE_LIMITER_OPTIONS: Required<RateLimiterOptions> = {
  windowMs: 1000,        // 1 segundo
  maxRequests: 10,       // 10 requisições por segundo
  blockDurationMs: 5000  // Bloqueia por 5 segundos se exceder
};

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

export class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private readonly options: Required<RateLimiterOptions>;
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(
    private readonly name: string,
    options: RateLimiterOptions = {}
  ) {
    this.options = { ...DEFAULT_RATE_LIMITER_OPTIONS, ...options };
    
    // Limpeza periódica de entradas antigas
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // A cada 1 minuto
  }
  
  /**
   * Verifica se a requisição é permitida
   * @returns { allowed: boolean, retryAfter?: number }
   */
  check(key: string): { allowed: boolean; retryAfter?: number; remaining?: number } {
    const now = Date.now();
    let entry = this.entries.get(key);
    
    // Verificar se está bloqueado
    if (entry && entry.blockedUntil > now) {
      return { 
        allowed: false, 
        retryAfter: entry.blockedUntil - now 
      };
    }
    
    // Se não tem entrada ou a janela expirou, criar nova
    if (!entry || (now - entry.windowStart) >= this.options.windowMs) {
      entry = {
        count: 1,
        windowStart: now,
        blockedUntil: 0
      };
      this.entries.set(key, entry);
      return { 
        allowed: true, 
        remaining: this.options.maxRequests - 1 
      };
    }
    
    // Incrementar contador
    entry.count++;
    
    // Verificar se excedeu o limite
    if (entry.count > this.options.maxRequests) {
      entry.blockedUntil = now + this.options.blockDurationMs;
      
      logger.warn(`⚠️ Rate limit excedido: ${this.name}`, {
        rateLimiter: this.name,
        key,
        count: entry.count,
        maxRequests: this.options.maxRequests,
        blockDurationMs: this.options.blockDurationMs
      });
      
      return { 
        allowed: false, 
        retryAfter: this.options.blockDurationMs 
      };
    }
    
    return { 
      allowed: true, 
      remaining: this.options.maxRequests - entry.count 
    };
  }
  
  /**
   * Reseta o rate limit para uma chave
   */
  reset(key: string): void {
    this.entries.delete(key);
  }
  
  /**
   * Limpa entradas antigas para evitar memory leak
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.options.windowMs - this.options.blockDurationMs;
    
    let cleaned = 0;
    for (const [key, entry] of this.entries) {
      if (entry.windowStart < cutoff && entry.blockedUntil < now) {
        this.entries.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`🧹 Rate limiter ${this.name}: ${cleaned} entradas antigas removidas`);
    }
  }
  
  /**
   * Destrutor - para quando o servidor para
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }
  
  /**
   * Estatísticas do rate limiter
   */
  getStats(): { activeEntries: number; blockedEntries: number } {
    const now = Date.now();
    let blocked = 0;
    
    for (const entry of this.entries.values()) {
      if (entry.blockedUntil > now) blocked++;
    }
    
    return {
      activeEntries: this.entries.size,
      blockedEntries: blocked
    };
  }
}

// ============================================
// ASYNC QUEUE (Fila de Processamento)
// ============================================

export interface QueueOptions {
  concurrency?: number;       // Quantas operações simultâneas
  maxQueueSize?: number;      // Tamanho máximo da fila
  processTimeout?: number;    // Timeout por operação em ms
  retryOnError?: boolean;     // Tentar novamente em caso de erro
  maxRetries?: number;        // Número máximo de retries
}

const DEFAULT_QUEUE_OPTIONS: Required<QueueOptions> = {
  concurrency: 5,
  maxQueueSize: 1000,
  processTimeout: 10000,  // 10 segundos
  retryOnError: true,
  maxRetries: 3
};

interface QueueItem<T> {
  id: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
  addedAt: number;
}

export class AsyncQueue<T = any> {
  private queue: QueueItem<T>[] = [];
  private processing: number = 0;
  private readonly options: Required<QueueOptions>;
  private paused: boolean = false;
  private itemIdCounter: number = 0;
  
  constructor(
    private readonly name: string,
    options: QueueOptions = {}
  ) {
    this.options = { ...DEFAULT_QUEUE_OPTIONS, ...options };
  }
  
  /**
   * Adiciona uma operação à fila
   */
  async add(operation: () => Promise<T>): Promise<T> {
    // Verificar se a fila está cheia
    if (this.queue.length >= this.options.maxQueueSize) {
      logger.error(`❌ Fila ${this.name} está cheia`, {
        queue: this.name,
        size: this.queue.length,
        maxSize: this.options.maxQueueSize
      });
      throw new QueueFullError(this.name, this.queue.length);
    }
    
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem<T> = {
        id: `${this.name}-${++this.itemIdCounter}`,
        operation,
        resolve,
        reject,
        retries: 0,
        addedAt: Date.now()
      };
      
      this.queue.push(item);
      this.processNext();
    });
  }
  
  /**
   * Processa o próximo item da fila
   */
  private processNext(): void {
    if (this.paused) return;
    if (this.processing >= this.options.concurrency) return;
    if (this.queue.length === 0) return;
    
    const item = this.queue.shift()!;
    this.processing++;
    
    this.executeItem(item);
  }
  
  private async executeItem(item: QueueItem<T>): Promise<void> {
    try {
      // Timeout para a operação
      const result = await Promise.race([
        item.operation(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Operation timeout')), this.options.processTimeout)
        )
      ]);
      
      item.resolve(result);
    } catch (error: any) {
      // Tentar retry se configurado
      if (this.options.retryOnError && item.retries < this.options.maxRetries) {
        item.retries++;
        logger.warn(`⚠️ Retry ${item.retries}/${this.options.maxRetries} para item ${item.id}`, {
          queue: this.name,
          itemId: item.id,
          error: error.message
        });
        
        // Adicionar de volta à fila (no final)
        this.queue.push(item);
      } else {
        logger.error(`❌ Item ${item.id} falhou após ${item.retries} retries`, {
          queue: this.name,
          itemId: item.id,
          error: error.message
        });
        item.reject(error);
      }
    } finally {
      this.processing--;
      this.processNext();
    }
  }
  
  /**
   * Pausa o processamento da fila
   */
  pause(): void {
    this.paused = true;
    logger.info(`⏸️ Fila ${this.name} pausada`, { queue: this.name });
  }
  
  /**
   * Retoma o processamento da fila
   */
  resume(): void {
    this.paused = false;
    logger.info(`▶️ Fila ${this.name} retomada`, { queue: this.name });
    
    // Processar itens pendentes
    for (let i = 0; i < this.options.concurrency; i++) {
      this.processNext();
    }
  }
  
  /**
   * Limpa a fila (rejeita todos os itens pendentes)
   */
  clear(): void {
    const cleared = this.queue.length;
    
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    
    this.queue = [];
    logger.info(`🧹 Fila ${this.name} limpa, ${cleared} itens removidos`);
  }
  
  /**
   * Estatísticas da fila
   */
  getStats(): { pending: number; processing: number; paused: boolean } {
    return {
      pending: this.queue.length,
      processing: this.processing,
      paused: this.paused
    };
  }
}

export class QueueFullError extends Error {
  constructor(queueName: string, currentSize: number) {
    super(`Fila ${queueName} está cheia (${currentSize} itens)`);
    this.name = 'QueueFullError';
  }
}

// ============================================
// MEMORY MANAGEMENT
// ============================================

/**
 * Monitora uso de memória e executa cleanup se necessário
 */
export class MemoryMonitor {
  private cleanupCallbacks: (() => void)[] = [];
  private monitorInterval: NodeJS.Timeout | null = null;
  private readonly thresholdPercent: number;
  
  constructor(thresholdPercent: number = 85) {
    this.thresholdPercent = thresholdPercent;
  }
  
  /**
   * Inicia o monitoramento de memória
   */
  start(intervalMs: number = 60000): void {
    if (this.monitorInterval) return;
    
    this.monitorInterval = setInterval(() => this.check(), intervalMs);
    logger.info('🧠 Memory monitor iniciado', { intervalMs, thresholdPercent: this.thresholdPercent });
  }
  
  /**
   * Para o monitoramento
   */
  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('🧠 Memory monitor parado');
    }
  }
  
  /**
   * Registra uma callback de cleanup
   */
  onCleanup(callback: () => void): void {
    this.cleanupCallbacks.push(callback);
  }
  
  /**
   * Verifica uso de memória e executa cleanup se necessário
   */
  check(): void {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const usagePercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    
    logger.debug('🧠 Memory usage', {
      heapUsedMB,
      heapTotalMB,
      usagePercent,
      threshold: this.thresholdPercent
    });
    
    if (usagePercent >= this.thresholdPercent) {
      logger.warn(`⚠️ Uso de memória alto: ${usagePercent}%`, {
        heapUsedMB,
        heapTotalMB,
        usagePercent
      });
      
      this.runCleanup();
    }
  }
  
  /**
   * Executa todas as callbacks de cleanup
   */
  private runCleanup(): void {
    logger.info('🧹 Executando cleanup de memória...');
    
    for (const callback of this.cleanupCallbacks) {
      try {
        callback();
      } catch (error) {
        logger.error('Erro em cleanup callback', { error });
      }
    }
    
    // Forçar garbage collection se disponível
    if (global.gc) {
      global.gc();
      logger.info('🧹 Garbage collection forçado');
    }
  }
  
  /**
   * Retorna estatísticas de memória
   */
  getStats(): { heapUsedMB: number; heapTotalMB: number; usagePercent: number; rss: number } {
    const usage = process.memoryUsage();
    return {
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      usagePercent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
      rss: Math.round(usage.rss / 1024 / 1024)
    };
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cria uma versão com timeout de uma Promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Debounce assíncrono - agrupa múltiplas chamadas em uma só
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  let pendingResolve: ((value: ReturnType<T>) => void) | null = null;
  let pendingReject: ((error: any) => void) | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    lastArgs = args;
    
    if (pendingPromise) {
      // Já tem uma chamada pendente, retornar a mesma Promise
      return pendingPromise;
    }
    
    pendingPromise = new Promise<ReturnType<T>>((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(async () => {
      try {
        const result = await fn(...lastArgs!);
        pendingResolve!(result);
      } catch (error) {
        pendingReject!(error);
      } finally {
        timeoutId = null;
        pendingPromise = null;
        pendingResolve = null;
        pendingReject = null;
        lastArgs = null;
      }
    }, delayMs);
    
    return pendingPromise;
  };
}

// ============================================
// SINGLETON INSTANCES
// ============================================

// Monitor de memória global
export const memoryMonitor = new MemoryMonitor(80); // Alerta em 80%

// Circuit breakers para diferentes serviços
export const circuitBreakers = {
  database: new CircuitBreaker('database', { failureThreshold: 5, timeout: 30000 }),
  redis: new CircuitBreaker('redis', { failureThreshold: 3, timeout: 15000 }),
  external: new CircuitBreaker('external-api', { failureThreshold: 3, timeout: 60000 })
};

// Rate limiters para diferentes recursos
export const rateLimiters = {
  chatMessage: new RateLimiter('chat-message', { windowMs: 1000, maxRequests: 5, blockDurationMs: 5000 }),
  chatReaction: new RateLimiter('chat-reaction', { windowMs: 1000, maxRequests: 10, blockDurationMs: 3000 }),
  coffeeRegister: new RateLimiter('coffee-register', { windowMs: 5000, maxRequests: 3, blockDurationMs: 10000 }),
  apiGeneral: new RateLimiter('api-general', { windowMs: 1000, maxRequests: 20, blockDurationMs: 5000 })
};

// Filas de processamento
export const queues = {
  achievement: new AsyncQueue('achievement', { concurrency: 3, maxQueueSize: 500 }),
  xpCredit: new AsyncQueue('xp-credit', { concurrency: 5, maxQueueSize: 1000 }),
  notification: new AsyncQueue('notification', { concurrency: 10, maxQueueSize: 500 })
};

// Tipos já exportados via interface, não precisa exportar novamente
