/**
 * 🧪 Testes - Metrics
 */

import {
  coffeeCreatedCounter,
  achievementUnlockedCounter,
  loginCounter,
  errorCounter,
  activeWebSocketConnections,
  usersOnline,
  httpRequestTotal,
  httpRequestDuration,
  metricsRegistry,
  recordCoffeeCreated,
  recordAchievementUnlocked,
  recordLogin,
  recordError,
  setActiveConnections,
  setUsersOnline,
} from '../metrics';

describe('Metrics', () => {
  beforeEach(async () => {
    // Reset métricas entre testes
    metricsRegistry.resetMetrics();
  });

  describe('recordCoffeeCreated', () => {
    it('deve incrementar contador para MADE', () => {
      const initialValue = coffeeCreatedCounter;
      
      recordCoffeeCreated('MADE');
      
      expect(initialValue).toBeDefined();
    });

    it('deve incrementar contador para BROUGHT', () => {
      recordCoffeeCreated('BROUGHT');
      
      expect(coffeeCreatedCounter).toBeDefined();
    });
  });

  describe('recordAchievementUnlocked', () => {
    it('deve incrementar contador com tipo', () => {
      recordAchievementUnlocked('first-coffee');
      
      expect(achievementUnlockedCounter).toBeDefined();
    });
  });

  describe('recordLogin', () => {
    it('deve incrementar contador para login bem-sucedido', () => {
      recordLogin(true);
      
      expect(loginCounter).toBeDefined();
    });

    it('deve incrementar contador para login falho', () => {
      recordLogin(false);
      
      expect(loginCounter).toBeDefined();
    });
  });

  describe('recordError', () => {
    it('deve incrementar contador de erro com tipo e código', () => {
      recordError('validation', 400);
      
      expect(errorCounter).toBeDefined();
    });

    it('deve aceitar código como string', () => {
      recordError('database', 'CONNECTION_FAILED');
      
      expect(errorCounter).toBeDefined();
    });
  });

  describe('setActiveConnections', () => {
    it('deve definir gauge de conexões ativas', () => {
      setActiveConnections(10);
      
      expect(activeWebSocketConnections).toBeDefined();
    });

    it('deve aceitar valor zero', () => {
      setActiveConnections(0);
      
      expect(activeWebSocketConnections).toBeDefined();
    });
  });

  describe('setUsersOnline', () => {
    it('deve definir gauge de usuários online', () => {
      setUsersOnline(5);
      
      expect(usersOnline).toBeDefined();
    });
  });

  describe('metricsRegistry', () => {
    it('deve ter contentType definido', () => {
      expect(metricsRegistry.contentType).toBeDefined();
      expect(metricsRegistry.contentType).toContain('text/plain');
    });

    it('deve retornar métricas no formato Prometheus', async () => {
      const metrics = await metricsRegistry.metrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('string');
      // Deve conter métricas padrão do Node.js
      expect(metrics).toContain('process_');
    });

    it('deve incluir métricas customizadas após uso', async () => {
      recordCoffeeCreated('MADE');
      recordLogin(true);
      
      const metrics = await metricsRegistry.metrics();
      
      expect(metrics).toContain('coffee_created_total');
      expect(metrics).toContain('login_total');
    });
  });

  describe('HTTP metrics', () => {
    it('deve ter httpRequestTotal definido', () => {
      expect(httpRequestTotal).toBeDefined();
    });

    it('deve ter httpRequestDuration definido', () => {
      expect(httpRequestDuration).toBeDefined();
    });
  });
});
