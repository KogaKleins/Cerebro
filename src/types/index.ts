/**
 * 🧠 CÉREBRO - Definições de Tipos TypeScript
 * Tipos centralizados para todo o sistema
 */

import { Request } from 'express';

// ============================================
// USER TYPES
// ============================================

// Role usa o enum do Prisma: 'ADMIN' | 'MEMBER' (uppercase)
export type UserRole = 'ADMIN' | 'MEMBER';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  avatar: string;
  setor: string;
  photo?: string;
}

export interface UserCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  user: User;
}

export interface JWTPayload {
  username: string;
  name: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

// ============================================
// COFFEE TYPES
// ============================================

// CoffeeType usa o enum do Prisma: 'MADE' | 'BROUGHT'
// Para compatibilidade com frontend legado, converter para lowercase
export type CoffeeTypeLegacy = 'made' | 'brought';

// 🆕 Itens especiais válidos
export type SpecialItemType = 'filtro-cafe' | 'bolo' | 'bolo-supreme' | 'bolacha' | 'bolacha-recheada' | 'biscoito' | 'sonho';

export interface CoffeeRecord {
  id: string;
  name: string;
  note?: string;
  date: string;
  type: CoffeeTypeLegacy;
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt?: string;
  // 🆕 Item especial (bolo, filtro, etc.)
  specialItem?: SpecialItemType;
}

export interface CoffeeRating {
  coffeeId: string;
  ratings: number[];
  average: number;
  count: number;
}

export interface CoffeeStats {
  totalMade: number;
  totalBrought: number;
  lastMaker: string | null;
  lastBringer: string | null;
  topMaker: string | null;
  topBringer: string | null;
}

// ============================================
// CHAT TYPES
// ============================================

export interface ChatMessage {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  reactions?: Record<string, string[]>;
  edited?: boolean;
  deleted?: boolean;
  createdBy?: string;
  replyTo?: {
    id: string;
    author: string;
    text: string;
  };
}

export interface ChatReaction {
  emoji: string;
  users: string[];
}

export interface TypingIndicator {
  username: string;
  timestamp: number;
}

// ============================================
// ACHIEVEMENT TYPES
// ============================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'coffee' | 'chat' | 'special';
  requirement: number;
  type: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
  progress?: number;
}

export interface UserAchievements {
  [username: string]: {
    [achievementId: string]: UserAchievement;
  };
}

// ============================================
// WEBSOCKET TYPES
// ============================================

export interface ServerToClientEvents {
  // Chat events
  'chat:message': (message: ChatMessage) => void;
  'chat:typing': (username: string) => void;
  'chat:stop-typing': (username: string) => void;
  'chat:delete': (messageId: string) => void;
  'chat:edit': (messageId: string, newText: string) => void;
  'chat:reaction': (data: { messageId: string; reactions: Record<string, string>; user: string; emoji: string; action: 'add' | 'remove' }) => void; // 🆕 Reações em tempo real
  
  // Coffee events
  'coffee:new': (record: CoffeeRecord) => void;
  'coffee:rating': (rating: CoffeeRating) => void;
  
  // Achievement events
  'achievement:unlocked': (data: { username: string; achievement: Achievement }) => void;
  
  // User events
  'users:online': (users: string[]) => void;
  'user:joined': (username: string) => void;
  'user:left': (username: string) => void;
  
  // System events
  // originUser: quem iniciou a ação (para evitar notificação duplicada no próprio usuário)
  'system:notification': (message: string, type: 'info' | 'warning' | 'error', originUser?: string) => void;
  'system:maintenance': (message: string) => void;
}

export interface ClientToServerEvents {
  // Chat events
  'chat:send': (
    data: string | { text: string; replyTo?: { id: string; author: string; text: string } | null }, 
    callback: (response: { 
      success: boolean; 
      message?: ChatMessage; 
      error?: string; 
      xpGained?: number;
      banned?: boolean;      // 🆕 Indica se usuário está banido
      bannedUntil?: Date;    // 🆕 Data de término do ban
    }) => void
  ) => void;
  'chat:typing': () => void;
  'chat:stop-typing': () => void;
  'chat:react': (messageId: string, emoji: string, callback: (response: { success: boolean; xpAwarded?: boolean; error?: string }) => void) => void; // 🆕 Reação via WebSocket
  
  // Coffee events
  'coffee:register': (record: Omit<CoffeeRecord, 'id' | 'createdAt' | 'createdBy'>, callback: (response: { success: boolean; record?: CoffeeRecord; error?: string }) => void) => void;
  'coffee:rate': (coffeeId: string, rating: number, callback: (response: { success: boolean; error?: string }) => void) => void;
  
  // User events
  'user:status': (status: 'online' | 'away' | 'busy') => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user: JWTPayload;
  sessionId: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  stack?: string;
}

// ============================================
// DATABASE TYPES
// ============================================

export interface DataFile {
  'coffee-made': CoffeeRecord[];
  'coffee-brought': CoffeeRecord[];
  'coffee-history': CoffeeRecord[];
  'ratings': Record<string, CoffeeRating>;
  'chat-messages': ChatMessage[];
  'achievements': UserAchievements;
}

export type DataFileKey = keyof DataFile;

// ============================================
// MONITORING TYPES
// ============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version: string;
  metrics: {
    totalRequests: number;
    totalErrors: number;
    errorRate: string;
    activeConnections: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  services: {
    database: 'connected' | 'disconnected';
    websocket: 'active' | 'inactive';
  };
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: Error;
  [key: string]: any;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}
