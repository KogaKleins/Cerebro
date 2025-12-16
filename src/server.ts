/**
 * 🧠 CÉREBRO - Servidor TypeScript + WebSocket
 * Servidor Express com Socket.io para comunicação em tempo real
 * 
 * Refatorado: Rotas movidas para src/routes/
 */

// IMPORTANTE: Carregar variáveis de ambiente ANTES de qualquer outro import
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';

// Services e utils
import { SocketService } from './services/socket.service';
import { logger, logWithContext, traceIdMiddleware } from './utils/logger';
import { cache } from './utils/cache';

// Observability
import { initSentry, sentryRequestHandler, sentryErrorHandler } from './utils/sentry';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { performanceMiddleware, responseTimeHeader } from './middleware/performance.middleware';

// Repositories
import { getRepositories, disconnectPrisma } from './repositories';

// Middleware
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Routes
import { authRoutes } from './routes/auth.routes';
import { createCoffeeRoutes } from './routes/coffee.routes';
import { achievementRoutes } from './routes/achievement.routes';
import { messageRoutes } from './routes/message.routes';
import { userRoutes } from './routes/user.routes';
import { createLegacyRoutes } from './routes/legacy.routes';
import { observabilityRoutes } from './routes/observability.routes';
import { settingRoutes } from './routes/setting.routes';
import { levelRoutes } from './routes/level.routes';
import { adminRoutes } from './routes/admin.routes';
import adminXPAuditRoutes from './routes/admin-xp-audit.routes';
import reactionRoutes from './routes/reaction.routes';
import { announcementRoutes } from './routes/announcement.routes';
import { suggestionRoutes } from './routes/suggestion.routes';

// Types
import { AuthRequest } from './types';

// ============================================
// INICIALIZAÇÃO DO SENTRY (deve ser primeiro)
// ============================================
initSentry();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE DE PERFORMANCE E COMPRESSÃO
// ============================================

app.use(compression({
  level: 6,                    // Bom equilíbrio entre velocidade e compressão
  threshold: 256,              // 🚀 OTIMIZADO: Comprimir respostas menores (era 1024)
  memLevel: 8,                 // Usar mais memória para melhor compressão
  filter: (req, res) => {
    // Não comprimir se cliente pediu
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Não comprimir streams ou Server-Sent Events
    if (req.headers['accept'] === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  },
}));

app.use(performanceMiddleware());
app.use(responseTimeHeader());

// ============================================
// MIDDLEWARES DE OBSERVABILIDADE
// ============================================

app.use(sentryRequestHandler());
app.use(traceIdMiddleware);
app.use(metricsMiddleware);

// Criar servidor HTTP para Socket.io
const httpServer = createServer(app);

// Inicializar WebSocket Service
let socketService: SocketService;
try {
  socketService = new SocketService(httpServer);
  logger.info('Socket.io service initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Socket.io service', error);
  process.exit(1);
}

// Inicializar Repositories (Prisma)
const repos = getRepositories();
logger.info('Prisma repositories initialized successfully');

// Injetar repositories no WebSocket Service para persistência
socketService.setRepositories({
  message: repos.message,
  user: repos.user,
  coffee: repos.coffee,
  rating: repos.rating
});
logger.info('WebSocket service repositories injected');

// ============================================
// CONFIGURAÇÃO CORS
// ============================================

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    const ipPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
    if (ipPattern.test(origin)) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    const msg = 'A política de CORS não permite acesso dessa origem.';
    return callback(new Error(msg), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

// ============================================
// HEADERS DE SEGURANÇA - ROBUSTOS E PROFISSIONAIS
// ============================================

app.use((req: Request, res: Response, next: NextFunction) => {
  // 🛡️ Prevenir MIME sniffing
  res.header('X-Content-Type-Options', 'nosniff');
  
  // 🛡️ Controle de frames
  if (req.path.endsWith('.pdf') || req.path.includes('/assets/documents/')) {
    res.header('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.header('X-Frame-Options', 'DENY');
  }
  
  // 🛡️ XSS Protection (legacy, mas ainda útil para navegadores antigos)
  res.header('X-XSS-Protection', '1; mode=block');
  
  // 🛡️ Content Security Policy
  // Em desenvolvimento, CSP é mais permissivo para facilitar debug
  // Em produção, CSP é mais restritivo para segurança
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
      "connect-src 'self' ws: wss: https://api.github.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'"
    ];
    res.header('Content-Security-Policy', cspDirectives.join('; '));
  }
  // Em desenvolvimento, não aplicar CSP restritivo
  
  // 🛡️ Prevenir vazamento de referrer
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 🛡️ Permissions Policy (antigo Feature-Policy)
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  // 🛡️ HSTS - Apenas HTTPS em produção
  if (isProduction) {
    res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // 🛡️ Cache control para APIs
  if (req.path.startsWith('/api/')) {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate, private');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
  } else {
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  
  // 🛡️ Remover header que expõe tecnologia
  res.removeHeader('X-Powered-By');
  
  next();
});

// ============================================
// RATE LIMITING
// ============================================

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'development' || 
           req.ip === '127.0.0.1' || 
           req.ip === '::1' ||
           req.ip === '::ffff:127.0.0.1';
  }
});

app.use('/api/auth/', limiter);

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logWithContext('info', 'HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      user: (req as AuthRequest).user?.username || 'anonymous'
    });
  });
  
  next();
});

// ============================================
// ARQUIVOS ESTÁTICOS
// ============================================

app.use(express.static(path.join(__dirname, '..'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    if (filePath.endsWith('.js') && process.env.NODE_ENV !== 'production') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// ============================================
// ROTAS
// ============================================

// Rotas de observabilidade (sem prefixo)
app.use(observabilityRoutes);

// API - Autenticação
app.use('/api/auth', authRoutes);

// API v2 - Rotas principais
app.use('/api/v2/coffees', createCoffeeRoutes(socketService));
app.use('/api/v2/achievements', achievementRoutes);
app.use('/api/v2/messages', messageRoutes);
app.use('/api/v2/users', userRoutes);
app.use('/api/v2/settings', settingRoutes);
app.use('/api/v2/levels', levelRoutes);
app.use('/api/v2/admin', adminRoutes);
app.use('/api/v2/admin', adminXPAuditRoutes);
app.use('/api/v2/reactions', reactionRoutes);  // 🆕 Reações de mensagens
app.use('/api/v2/announcements', announcementRoutes);  // 🆕 Comunicados
app.use('/api/v2/suggestions', suggestionRoutes);  // 🆕 Sugestões

// API v1 - Rotas de compatibilidade (DEPRECADAS - migrar para v2)
app.use('/api', createLegacyRoutes(socketService));

// ============================================
// ERROR HANDLERS
// ============================================

app.use(notFoundHandler);
app.use(sentryErrorHandler());
app.use(errorHandler);

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function getLocalIP(): string {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// 🛡️ Graceful shutdown melhorado
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn(`${signal} recebido novamente, forçando shutdown...`);
    process.exit(1);
  }
  
  isShuttingDown = true;
  logger.info(`${signal} recebido: iniciando graceful shutdown...`);
  
  // 1. Parar de aceitar novas conexões
  httpServer.close(() => {
    logger.info('HTTP server fechado para novas conexões');
  });
  
  
  
  // 3. Aguardar filas processarem (máximo 10 segundos)
  logger.info('Aguardando filas finalizarem...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // 4. Desconectar cache Redis
  try {
    await cache.disconnect();
    logger.info('Cache Redis desconectado');
  } catch (error) {
    logger.error('Erro ao desconectar Redis', { error });
  }
  
  // 5. Desconectar banco de dados
  try {
    await disconnectPrisma();
    logger.info('Banco de dados desconectado');
  } catch (error) {
    logger.error('Erro ao desconectar banco de dados', { error });
  }
  
  logger.info('✅ Graceful shutdown completo');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 🛡️ Handler para erros não capturados
process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  // Dar tempo para logs serem escritos
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('❌ Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  // Não derrubar o processo, apenas logar
});

// Iniciar servidor
async function startServer() {
  await cache.connect();
  
  httpServer.listen(PORT, () => {
    const localIP = getLocalIP();
    
    console.log('');
    console.log('  ╔════════════════════════════════════════════════════╗');
    console.log('  ║  🧠 CÉREBRO - TypeScript + WebSocket               ║');
    console.log('  ║  🛡️  MODO ROBUSTO ATIVADO                          ║');
    console.log('  ╠════════════════════════════════════════════════════╣');
    console.log(`  ║  Local:   http://localhost:${PORT}                    ║`);
    console.log(`  ║  Rede:    http://${localIP}:${PORT}                ║`);
    console.log('  ╠════════════════════════════════════════════════════╣');
    console.log('  ║  ✅ WebSocket: ATIVO                                ║');
    console.log('  ║  ✅ TypeScript: COMPILADO                           ║');
    console.log('  ║  ✅ Logging: Winston                                ║');
    console.log(`  ║  ${cache.isEnabled() ? '✅' : '⚠️'} Cache Redis: ${cache.isEnabled() ? 'ATIVO' : 'DESABILITADO'}                     ║`);
    console.log('  ║  ✅ Rate Limiting: ATIVO                            ║');
    console.log('  ║  ✅ Circuit Breakers: ATIVO                         ║');
    console.log('  ║  ✅ Background Queues: ATIVO                        ║');
    console.log('  ╠════════════════════════════════════════════════════╣');
    console.log('  ║  Health: /health/detailed                          ║');
    console.log('  ║  Logs: logs/                                       ║');
    console.log('  ║  Para parar: Ctrl+C                                ║');
    console.log('  ╚════════════════════════════════════════════════════╝');
    console.log('');
    
    logger.info(`Server started on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`WebSocket service: ${socketService ? 'ACTIVE' : 'INACTIVE'}`);
    logger.info(`Cache Redis: ${cache.isEnabled() ? 'ENABLED' : 'DISABLED'}`);
    logger.info('🛡️ Robustness features: Rate Limiting, Circuit Breakers, Background Queues, Memory Monitor');
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server', error);
  process.exit(1);
});
