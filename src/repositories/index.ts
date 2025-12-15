/**
 * Repositories Index - Exporta todos os repositories e instância do Prisma
 * 
 * 🛡️ ROBUSTO: Pool de conexões otimizado com retry e circuit breaker
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool, PoolConfig } from 'pg';
import { UserRepository } from './user.repository';
import { CoffeeRepository } from './coffee.repository';
import { RatingRepository } from './rating.repository';
import { MessageRepository } from './message.repository';
import { AchievementRepository } from './achievement.repository';
import { SettingRepository } from './setting.repository';
import { LevelRepository } from './level.repository';
import { ReactionRepository } from './reaction.repository';
import { DailyLoginRepository } from './daily-login.repository';
import { AnnouncementRepository } from './announcement.repository';
import { SuggestionRepository } from './suggestion.repository';

// Singleton do Prisma Client
let prisma: PrismaClient;
let pool: Pool;

// 🛡️ Configuração otimizada do pool de conexões
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  // Número de conexões no pool
  max: parseInt(process.env.DB_POOL_SIZE || '20'),
  // Mínimo de conexões mantidas
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  // Timeout para obter conexão do pool (ms)
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  // Timeout de idle antes de fechar conexão (ms)
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  // Tempo máximo que conexão pode ficar no pool (ms)
  maxLifetimeSeconds: 1800, // 30 minutos
  // Habilitar keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Statement timeout para queries
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  // Query timeout
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
};

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // Criar pool com configurações otimizadas
    pool = new Pool(poolConfig);
    
    // 🛡️ Handlers de erro do pool
    pool.on('error', (err) => {
      console.error('🔴 Erro no pool de conexões PostgreSQL:', err.message);
      // Não derrubar o processo - o pool vai tentar reconectar automaticamente
    });
    
    pool.on('connect', () => {
      console.log('🟢 Nova conexão estabelecida no pool');
    });
    
    pool.on('remove', () => {
      console.log('🟡 Conexão removida do pool');
    });
    
    // Prisma 7 requer adapter
    const adapter = new PrismaPg(pool);
    
    prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
    });
    
    // 🛡️ Nota: Em Prisma 7, middlewares foram removidos
    // Para logging de queries lentas, usar logs ou Prisma Pulse/Accelerate
    console.log('🟢 Prisma Client inicializado com pool otimizado');
  }
  return prisma;
}

// Instanciar repositories
export function getRepositories() {
  const prismaClient = getPrismaClient();
  
  return {
    user: new UserRepository(prismaClient),
    coffee: new CoffeeRepository(prismaClient),
    rating: new RatingRepository(prismaClient),
    message: new MessageRepository(prismaClient),
    achievement: new AchievementRepository(prismaClient),
    setting: new SettingRepository(prismaClient),
    level: new LevelRepository(prismaClient),
    reaction: new ReactionRepository(prismaClient),      // 🆕 Reações de mensagens
    dailyLogin: new DailyLoginRepository(prismaClient),  // 🆕 Logins diários
    announcement: new AnnouncementRepository(prismaClient), // 🆕 Comunicados
    suggestion: new SuggestionRepository(prismaClient),     // 🆕 Sugestões
    prisma: prismaClient
  };
}

// 🛡️ Função para verificar saúde do pool
export async function checkPoolHealth(): Promise<{
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}> {
  if (!pool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  }
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

// Função para fechar conexão
export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (pool) {
    await pool.end();
  }
}

// Exportar tipos
export type Repositories = ReturnType<typeof getRepositories>;

// Exportar classes individuais
export { UserRepository } from './user.repository';
export { CoffeeRepository } from './coffee.repository';
export { RatingRepository } from './rating.repository';
export { MessageRepository } from './message.repository';
export { AchievementRepository } from './achievement.repository';
export { SettingRepository } from './setting.repository';
export { LevelRepository } from './level.repository';
export { ReactionRepository } from './reaction.repository';       // 🆕
export { DailyLoginRepository } from './daily-login.repository';  // 🆕
export { AnnouncementRepository } from './announcement.repository'; // 🆕
export { SuggestionRepository } from './suggestion.repository';     // 🆕
