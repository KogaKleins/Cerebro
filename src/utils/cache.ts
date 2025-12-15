/**
 * 🧠 CÉREBRO - Cache Service
 * Utilitário para cache com Redis
 * 
 * O cache é OPCIONAL - o sistema funciona sem Redis.
 * Se o Redis não estiver disponível, o cache é simplesmente desabilitado.
 */

import Redis from 'ioredis';
import { logger } from './logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Serviço de Cache com Redis
 * Implementa graceful degradation - funciona sem Redis
 */
class CacheService {
  private redis: Redis | null = null;
  private enabled: boolean = false;
  private connecting: boolean = false;

  /**
   * Conectar ao Redis
   * Falha silenciosamente se Redis não estiver disponível
   */
  async connect(): Promise<void> {
    if (this.connecting || this.enabled) return;
    
    this.connecting = true;
    
    try {
      this.redis = new Redis(REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
        retryStrategy: (times) => {
          if (times > 3) {
            logger.warn('Redis connection failed after 3 attempts, cache disabled');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 2000);
        },
      });

      // Handlers de eventos
      this.redis.on('connect', () => {
        this.enabled = true;
        logger.info('Redis cache connected');
      });

      this.redis.on('error', (error) => {
        if (this.enabled) {
          logger.error('Redis error', { error: error.message });
        }
      });

      this.redis.on('close', () => {
        this.enabled = false;
        logger.warn('Redis connection closed');
      });

      await this.redis.connect();
      this.enabled = true;
    } catch (error) {
      logger.warn('Redis not available, running without cache', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      this.enabled = false;
      this.redis = null;
    } finally {
      this.connecting = false;
    }
  }

  /**
   * Obter valor do cache
   * @param key - Chave do cache
   * @returns Valor do cache ou null se não existir/erro
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) return null;
    
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      
      logger.debug('Cache hit', { key });
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Cache get error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * Salvar valor no cache
   * @param key - Chave do cache
   * @param value - Valor a ser cacheado
   * @param ttl - Tempo de vida em segundos (padrão: 300 = 5 minutos)
   */
  async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    if (!this.enabled || !this.redis) return;
    
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.error('Cache set error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Deletar valor do cache
   * @param key - Chave do cache
   */
  async del(key: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    
    try {
      await this.redis.del(key);
      logger.debug('Cache del', { key });
    } catch (error) {
      logger.error('Cache del error', { 
        key, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Invalidar todas as chaves que correspondem a um padrão
   * @param pattern - Padrão de chave (ex: "coffees:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.enabled || !this.redis) return;
    
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug('Cache invalidated', { pattern, keysDeleted: keys.length });
      }
    } catch (error) {
      logger.error('Cache invalidate error', { 
        pattern, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  /**
   * Verificar se o cache está habilitado
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Desconectar do Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.enabled = false;
      logger.info('Redis cache disconnected');
    }
  }
}

// Singleton do serviço de cache
export const cache = new CacheService();

// Cache keys helpers
export const CacheKeys = {
  // Cafés
  coffeesRecent: (limit: number) => `coffees:recent:${limit}`,
  coffeesStats: () => 'coffees:stats',
  coffeeById: (id: string) => `coffee:${id}`,
  
  // Usuários
  userStats: (username: string) => `user:stats:${username}`,
  userAchievements: (userId: string) => `user:achievements:${userId}`,
  
  // Padrões para invalidação
  allCoffees: () => 'coffees:*',
  allUserStats: () => 'user:stats:*',
};

// TTL helpers (em segundos)
export const CacheTTL = {
  SHORT: 60,        // 1 minuto
  MEDIUM: 300,      // 5 minutos
  LONG: 900,        // 15 minutos
  HOUR: 3600,       // 1 hora
  DAY: 86400,       // 1 dia
};
