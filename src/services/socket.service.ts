/**
 * 🧠 CÉREBRO - Serviço de WebSocket
 * Gerenciamento de conexões em tempo real com Socket.io
 * 
 * 🛡️ ROBUSTO: Inclui rate limiting, filas de processamento, 
 * limpeza de memória e tratamento de erros resiliente
 * 
 * ✅ OTIMIZADO: Imports estáticos para melhor performance
 */

import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData,
  ChatMessage,
  CoffeeRecord
} from '../types';
import { verifyToken, sanitizeString } from '../utils/auth.utils';
import { logger, logWebSocket } from '../utils/logger';
import { MessageRepository } from '../repositories/message.repository';
import { UserRepository } from '../repositories/user.repository';
import { CoffeeRepository } from '../repositories/coffee.repository';
import { RatingRepository } from '../repositories/rating.repository';
import { 
  rateLimiters, 
  queues, 
  withRetry, 
  memoryMonitor
} from '../utils/resilience';

// 🚀 OTIMIZAÇÃO: Imports estáticos (evita import dinâmico a cada mensagem)
import { getPrismaClient } from '../repositories';
import { getPointsEngine } from './points-engine.service';
import { AchievementService } from './achievement.service';
import { 
  CoffeeRepository as CoffeeRepoClass,
  AchievementRepository,
  LevelRepository,
  SettingRepository,
  UserRepository as UserRepoClass,
  RatingRepository as RatingRepoClass
} from '../repositories';

// Cooldown para XP de mensagens (evitar spam)
const MESSAGE_XP_COOLDOWN_MS = 30 * 1000; // 30 segundos entre XPs
const lastMessageXP: Map<string, number> = new Map(); // username -> timestamp do último XP

// 🛡️ Map para controlar timeouts de typing (evita memory leak)
const typingTimeouts: Map<string, NodeJS.Timeout> = new Map();

// 🛡️ LIMPEZA PERIÓDICA: Evitar memory leaks
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_XP_COOLDOWN_ENTRIES = 1000; // Máximo de entradas no Map de cooldown

export class SocketService {
  private io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private onlineUsers: Map<string, string> = new Map(); // socketId -> username
  private userNames: Map<string, string> = new Map(); // username -> name (nome completo)
  private userSockets: Map<string, string[]> = new Map(); // username -> socketIds[]
  
  // Repositories para persistência
  private messageRepo?: MessageRepository;
  private userRepo?: UserRepository;
  private coffeeRepo?: CoffeeRepository;
  private ratingRepo?: RatingRepository;

  // 🛡️ Interval para limpeza periódica
  private cleanupInterval?: NodeJS.Timeout;
  
  // 🚀 Cache de serviços para evitar reinstanciação
  private prisma = getPrismaClient();
  private achievementServiceCache?: AchievementService;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true
      },
      // 🛡️ ROBUSTEZ: Configurações otimizadas para produção
      pingTimeout: 60000,           // 60s timeout para pings
      pingInterval: 25000,          // Ping a cada 25s
      upgradeTimeout: 30000,        // 30s para upgrade de conexão
      maxHttpBufferSize: 1e6,       // 1MB max por mensagem
      transports: ['websocket', 'polling'], // Websocket primeiro, polling como fallback
      allowUpgrades: true,
      perMessageDeflate: {
        threshold: 1024              // Comprimir mensagens > 1KB
      }
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupCleanupInterval();
    this.setupMemoryMonitor();
    
    logger.info('WebSocket service initialized with robustness features');
  }
  
  /**
   * 🚀 Obter instância do AchievementService (singleton cacheado)
   */
  private getAchievementService(): AchievementService {
    if (!this.achievementServiceCache) {
      this.achievementServiceCache = new AchievementService(
        new CoffeeRepoClass(this.prisma),
        new AchievementRepository(this.prisma),
        new LevelRepository(this.prisma),
        new SettingRepository(this.prisma),
        new UserRepoClass(this.prisma),
        this.prisma,
        new RatingRepoClass(this.prisma)
      );
    }
    return this.achievementServiceCache;
  }

  /**
   * 🛡️ Configurar limpeza periódica para evitar memory leaks
   */
  private setupCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, CLEANUP_INTERVAL_MS);
    
    logger.info('WebSocket cleanup interval configured', { intervalMs: CLEANUP_INTERVAL_MS });
  }

  /**
   * 🛡️ Executar limpeza de memória
   */
  private performCleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Limpar entradas antigas do Map de cooldown de XP
    for (const [username, timestamp] of lastMessageXP) {
      // Remover entradas com mais de 10 minutos
      if (now - timestamp > 10 * 60 * 1000) {
        lastMessageXP.delete(username);
        cleanedCount++;
      }
    }
    
    // Limitar tamanho máximo do Map (proteção contra DoS)
    if (lastMessageXP.size > MAX_XP_COOLDOWN_ENTRIES) {
      // Remover as entradas mais antigas
      const entries = Array.from(lastMessageXP.entries())
        .sort((a, b) => a[1] - b[1]);
      
      const toRemove = entries.slice(0, entries.length - MAX_XP_COOLDOWN_ENTRIES);
      for (const [username] of toRemove) {
        lastMessageXP.delete(username);
        cleanedCount++;
      }
    }
    
    // Limpar userSockets de usuários desconectados
    for (const [username, sockets] of this.userSockets) {
      if (!sockets || sockets.length === 0) {
        this.userSockets.delete(username);
        this.userNames.delete(username);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info('🧹 WebSocket cleanup executado', {
        cleanedEntries: cleanedCount,
        remainingCooldowns: lastMessageXP.size,
        onlineUsers: this.onlineUsers.size,
        userSockets: this.userSockets.size
      });
    }
  }

  /**
   * 🛡️ Registrar callbacks no memory monitor
   */
  private setupMemoryMonitor(): void {
    memoryMonitor.onCleanup(() => {
      logger.info('🧹 Memory cleanup triggered - executando limpeza emergencial');
      this.performCleanup();
      
      // Limpar caches das filas se necessário
      const achievementStats = queues.achievement.getStats();
      const xpStats = queues.xpCredit.getStats();
      
      logger.info('🧹 Queue stats', { achievementStats, xpStats });
    });
    
    // Iniciar monitor de memória
    memoryMonitor.start(60000); // Verificar a cada 1 minuto
  }

  /**
   * Injetar repositories para persistência de dados
   */
  public setRepositories(repos: {
    message: MessageRepository;
    user: UserRepository;
    coffee: CoffeeRepository;
    rating: RatingRepository;
  }): void {
    this.messageRepo = repos.message;
    this.userRepo = repos.user;
    this.coffeeRepo = repos.coffee;
    this.ratingRepo = repos.rating;
    logger.info('WebSocket repositories injected for data persistence');
  }

  /**
   * Middleware de autenticação JWT para WebSocket
   */
  private setupMiddleware(): void {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        logger.warn('WebSocket connection attempt without token');
        return next(new Error('Authentication error: No token provided'));
      }
      
      const decoded = verifyToken(token);
      if (!decoded) {
        logger.warn('WebSocket connection attempt with invalid token');
        return next(new Error('Authentication error: Invalid token'));
      }
      
      socket.data.user = decoded;
      socket.data.sessionId = `${decoded.username}-${Date.now()}`;
      
      next();
    });
  }

  /**
   * Configurar handlers de eventos do WebSocket
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) => {
      const username = socket.data.user.username;
      const name = socket.data.user.name;
      
      logger.info(`User connected via WebSocket: ${name} (${username})`);
      logWebSocket('connection', username);
      
      // Adicionar à lista de usuários online
      this.onlineUsers.set(socket.id, username);
      this.userNames.set(username, name); // Guardar nome completo
      this.addUserSocket(username, socket.id);
      this.broadcastOnlineUsers();
      
      // Notificar outros usuários
      socket.broadcast.emit('user:joined', name);
      
      // ============================================
      // CHAT EVENTS
      // ============================================
      
      socket.on('chat:send', async (data: string | { text: string; replyTo?: { id: string; author: string; text: string } | null }, callback) => {
        let xpGained = 0; // 🆕 Declarar fora para usar no callback
        
        // 🛡️ RATE LIMITING: Verificar se o usuário não está enviando mensagens muito rápido
        const rateCheck = rateLimiters.chatMessage.check(username);
        if (!rateCheck.allowed) {
          logger.warn('⚠️ Rate limit excedido para chat:send', {
            username,
            retryAfter: rateCheck.retryAfter
          });
          callback({ 
            success: false, 
            error: `Você está enviando mensagens muito rápido. Aguarde ${Math.ceil((rateCheck.retryAfter || 5000) / 1000)} segundos.`
          });
          return;
        }
        
        // 🆕 VERIFICAR BAN NO SERVIDOR (fonte de verdade)
        if (this.userRepo) {
          try {
            const banStatus = await this.userRepo.getBanStatus(username);
            if (banStatus && banStatus.banned) {
              logger.warn('🚫 Usuário banido tentou enviar mensagem', {
                username,
                bannedUntil: banStatus.until,
                reason: banStatus.reason
              });
              callback({
                success: false,
                error: `Você está temporariamente bloqueado. Motivo: ${banStatus.reason || 'Violação das regras'}`,
                banned: true,
                bannedUntil: banStatus.until
              });
              return;
            }
          } catch (banError) {
            logger.warn('⚠️ Erro ao verificar ban, permitindo mensagem', { username, error: String(banError) });
            // Em caso de erro, permitir a mensagem (fail-open para não bloquear usuários legítimos)
          }
        }
        
        try {
          // Suportar string (compatibilidade) ou objeto (com replyTo)
          const text = typeof data === 'string' ? data : data.text;
          const replyTo = typeof data === 'object' ? data.replyTo : null;
          
          logWebSocket('chat:send', username, { text, hasReplyTo: !!replyTo });
          
          const sanitizedText = sanitizeString(text.trim());
          let messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Salvar mensagem no banco de dados
          logger.debug('🔍 Verificando repos', { 
            hasMessageRepo: !!this.messageRepo, 
            hasUserRepo: !!this.userRepo 
          });
          
          if (this.messageRepo && this.userRepo) {
            // 🛡️ RETRY: Operações de banco com retry automático
            const user = await withRetry(
              () => this.userRepo!.findByUsername(username),
              'findUserByUsername'
            );
            logger.debug('🔍 Usuário encontrado', { user: user ? user.username : 'não encontrado' });
            
            if (user) {
              // 🔧 CORREÇÃO: Salvar replyTo no banco de dados para persistência
              // 🛡️ RETRY: Salvar mensagem com retry automático
              const savedMessage = await withRetry(
                () => this.messageRepo!.create({
                  authorId: user.id,
                  text: sanitizedText,
                  replyToId: replyTo?.id,
                  replyToAuthor: replyTo?.author,
                  replyToText: replyTo?.text?.substring(0, 200) // Limitar preview
                }),
                'createMessage'
              );
              messageId = savedMessage.id;
              logger.info(`💾 Mensagem salva: ${messageId}${replyTo ? ' (reply)' : ''}`);
              
              // 🔧 PADRONIZAÇÃO: XP agora é creditado no BACKEND (igual às reações)
              // O WebSocket retorna xpGained para o frontend mostrar notificação
              // Isso garante fonte única de verdade e evita duplicação
              
              // Verificar cooldown para XP de mensagens
              const now = Date.now();
              const lastCheck = lastMessageXP.get(username) || 0;
              const canGetXP = (now - lastCheck) >= MESSAGE_XP_COOLDOWN_MS;
              
              if (canGetXP) {
                // 🛡️ QUEUE: Processar XP em background para não bloquear a resposta
                queues.xpCredit.add(async () => {
                  try {
                    logger.debug('🎮 Creditando XP de mensagem...');
                  
                    // 🚀 OTIMIZADO: Usar import estático
                    const pointsEngine = getPointsEngine(this.prisma, logger);
                  
                    // Usar sourceId único para evitar duplicação
                    // 🆕 CORREÇÃO: O Points Engine agora verifica limite diário
                    const result = await pointsEngine.addChatMessagePoints(username, messageId);
                    
                    // 🆕 CORREÇÃO: Verificar se limite foi atingido
                    if (result && !result.limitReached) {
                      const xp = result.amount || 1;
                      logger.info(`✅ XP creditado por mensagem: +${xp} para ${username}`);
                      // Atualizar timestamp do último XP APENAS se XP foi concedido
                      lastMessageXP.set(username, now);
                    } else if (result && result.limitReached) {
                      logger.info(`🛑 Limite diário de XP por mensagens atingido para ${username} (${result.dailyCount}/${result.dailyLimit})`);
                    }
                  } catch (xpError) {
                    logger.warn('⚠️ Erro ao creditar XP de mensagem (background)', { username, error: String(xpError) });
                  }
                }).catch(err => {
                  logger.error('❌ Erro na fila de XP', { username, error: String(err) });
                });
              } else {
                const waitTime = Math.ceil((MESSAGE_XP_COOLDOWN_MS - (now - lastCheck)) / 1000);
                logger.debug(`⏱️ Cooldown de XP ativo para ${username}, aguardar ${waitTime}s`);
              }
              
              // 🔧 CORREÇÃO: Verificar conquistas de MENSAGENS em background
              // 🛡️ QUEUE: Não bloquear a resposta principal
              queues.achievement.add(async () => {
                try {
                  const messageCount = await this.messageRepo!.countByAuthor(user.id);
                  // 🚀 OTIMIZADO: Usar service cacheado ao invés de import dinâmico
                  const achievementService = this.getAchievementService();
                  await achievementService.checkMessageAchievements(user.id, messageCount);
                  logger.debug('✅ Conquistas de mensagens verificadas (background)', { userId: user.id, messageCount });
                } catch (achievementError) {
                  logger.warn('⚠️ Erro ao verificar conquistas de mensagem (background)', { username, error: String(achievementError) });
                }
              }).catch(err => {
                logger.error('❌ Erro na fila de conquistas', { username, error: String(err) });
              });
            }
          }
          
          const message: ChatMessage = {
            id: messageId,
            author: name,
            text: sanitizedText,
            timestamp: new Date().toISOString(),
            replyTo: replyTo || undefined // Incluir replyTo se existir
          };
          
          // Broadcast para todos os clientes
          this.io.emit('chat:message', message);
          
          // 🆕 Retornar XP ganho no callback para feedback visual
          callback({ success: true, message, xpGained });
          logger.info(`Chat message from ${name}: ${sanitizedText.substring(0, 50)}...${replyTo ? ' (reply)' : ''}${xpGained > 0 ? ` (+${xpGained} XP)` : ''}`);
        } catch (error: any) {
          logger.error(`Error in chat:send: ${error?.message || error}`, {
            username,
            error: error?.stack || String(error)
          });
          callback({ success: false, error: 'Falha ao enviar mensagem. Tente novamente.' });
        }
      });
      
      // 🛡️ CORREÇÃO: Handler typing com controle de timeout para evitar memory leak
      socket.on('chat:typing', () => {
        logWebSocket('chat:typing', username);
        socket.broadcast.emit('chat:typing', name);
        
        // 🛡️ Limpar timeout anterior para este usuário (evita acúmulo de timeouts)
        const existingTimeout = typingTimeouts.get(username);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        // Auto-stop typing após 3 segundos
        const timeout = setTimeout(() => {
          socket.broadcast.emit('chat:stop-typing', name);
          typingTimeouts.delete(username);
        }, 3000);
        
        typingTimeouts.set(username, timeout);
      });
      
      socket.on('chat:stop-typing', () => {
        logWebSocket('chat:stop-typing', username);
        socket.broadcast.emit('chat:stop-typing', name);
        
        // 🛡️ Limpar timeout se existir
        const existingTimeout = typingTimeouts.get(username);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          typingTimeouts.delete(username);
        }
      });
      
      // 🆕 Handler para reações em tempo real
      socket.on('chat:react', async (messageId: string, emoji: string, callback) => {
        // 🛡️ RATE LIMITING: Verificar se o usuário não está reagindo muito rápido
        const rateCheck = rateLimiters.chatReaction.check(username);
        if (!rateCheck.allowed) {
          logger.warn('⚠️ Rate limit excedido para chat:react', {
            username,
            retryAfter: rateCheck.retryAfter
          });
          callback({ 
            success: false, 
            error: `Muitas reações em sequência. Aguarde ${Math.ceil((rateCheck.retryAfter || 3000) / 1000)} segundos.`
          });
          return;
        }
        
        try {
          logWebSocket('chat:react', username, { messageId, emoji });
          
          // Importar repository de reações (necessário pois não está injetado)
          const { getRepositories } = await import('../repositories');
          const repos = getRepositories();
          
          // Verificar se usuário existe com retry
          const user = this.userRepo ? await withRetry(
            () => this.userRepo!.findByUsername(username),
            'findUserForReaction'
          ) : null;
          
          if (!user) {
            callback({ success: false, error: 'Usuário não encontrado' });
            return;
          }
          
          // Salvar reação no banco com retry
          const result = await withRetry(
            () => repos.reaction.addReaction({
              messageId,
              userId: username,
              emoji
            }),
            'addReaction'
          );
          
          let xpAwarded = false;
          
          if (result.created) {
            // 🛡️ QUEUE: Processar XP e conquistas em background
            queues.xpCredit.add(async () => {
              try {
                // 🚀 OTIMIZADO: Usar import estático
                const pointsEngine = getPointsEngine(this.prisma, logger);
                
                // XP para quem reagiu
                const reactionResult = await pointsEngine.addMessageReactionPoints(username, messageId, emoji);
                
                if (reactionResult && !reactionResult.limitReached) {
                  logger.info(`✅ XP creditado por reação: +${reactionResult.amount || 3} para ${username}`);
                } else if (reactionResult && reactionResult.limitReached) {
                  logger.info(`🛑 Limite diário de XP por reações atingido para ${username}`);
                }
                
                // Buscar autor da mensagem para dar XP por receber reação
                const message = await repos.message?.findById(messageId);
                if (message && message.authorId && message.authorId !== user.id) {
                  const author = await this.userRepo?.findById(message.authorId);
                  if (author) {
                    await pointsEngine.addReactionReceivedPoints(author.username, messageId, emoji, username);
                  }
                }
              } catch (xpError) {
                logger.warn('⚠️ Erro ao creditar XP por reação (background)', { username, error: String(xpError) });
              }
            }).catch(err => logger.error('❌ Erro na fila de XP (reação)', { error: String(err) }));
            
            // 🛡️ QUEUE: Verificar conquistas em background
            queues.achievement.add(async () => {
              try {
                // 🚀 OTIMIZADO: Usar service cacheado
                const achievementService = this.getAchievementService();
                
                // Verificar conquistas de emoji para quem reagiu
                await achievementService.checkEmojiAchievements(user.id);
                
                // Verificar conquistas de reações DADAS
                const reactionsGiven = await repos.reaction.countReactionsGivenByUser(username);
                await achievementService.checkReactionAchievements(user.id, reactionsGiven, undefined);
                
                // Verificar conquistas de reações RECEBIDAS para o autor
                const message = await repos.message?.findById(messageId);
                if (message && message.authorId && message.authorId !== user.id) {
                  const authorReactionsReceived = await repos.reaction.countReactionsReceivedByUser(message.authorId);
                  await achievementService.checkReactionAchievements(message.authorId, undefined, authorReactionsReceived);
                }
                
                logger.debug('✅ Conquistas de reações verificadas (background)');
              } catch (achError) {
                logger.warn('⚠️ Erro ao verificar conquistas de emojis (background)', { username, error: String(achError) });
              }
            }).catch(err => logger.error('❌ Erro na fila de conquistas (reação)', { error: String(err) }));
            
            xpAwarded = true; // Marcamos como true pois foi para fila
          }
          
          // Buscar reações atualizadas da mensagem para broadcast
          const messageReactions = await withRetry(
            () => repos.reaction.getReactionsByMessage(messageId),
            'getReactionsByMessage'
          );
          
          // Converter para formato { user: emoji }
          const reactions: Record<string, string> = {};
          messageReactions.forEach(r => {
            reactions[r.userId] = r.emoji;
          });
          
          // Broadcast para TODOS os clientes (incluindo quem enviou)
          this.io.emit('chat:reaction', {
            messageId,
            reactions,
            user: username,
            emoji,
            action: result.created ? 'add' : 'add' // Sempre 'add' neste endpoint
          });
          
          callback({ success: true, xpAwarded });
          logger.info(`Reação ${emoji} adicionada por ${name} na mensagem ${messageId}`);
          
        } catch (error: any) {
          logger.error(`Error in chat:react: ${error?.message || error}`, {
            username,
            messageId,
            error: error?.stack || String(error)
          });
          callback({ success: false, error: 'Falha ao reagir. Tente novamente.' });
        }
      });
      
      // ============================================
      // COFFEE EVENTS
      // ============================================
      
      socket.on('coffee:register', async (record, callback) => {
        // 🛡️ RATE LIMITING: Verificar se o usuário não está registrando café muito rápido
        const rateCheck = rateLimiters.coffeeRegister.check(username);
        if (!rateCheck.allowed) {
          logger.warn('⚠️ Rate limit excedido para coffee:register', {
            username,
            retryAfter: rateCheck.retryAfter
          });
          callback({ 
            success: false, 
            error: `Muitos registros em sequência. Aguarde ${Math.ceil((rateCheck.retryAfter || 10000) / 1000)} segundos.`
          });
          return;
        }
        
        try {
          logWebSocket('coffee:register', username, { record });
          
          let coffeeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Salvar café no banco de dados
          if (this.coffeeRepo && this.userRepo) {
            // 🛡️ RETRY: Operação de banco com retry
            const user = await withRetry(
              () => this.userRepo!.findByUsername(username),
              'findUserForCoffee'
            );
            
            if (user) {
              const coffeeType = record.type === 'made' ? 'MADE' : 'BROUGHT';
              
              // 🆕 Descrição inclui item especial se fornecido
              const description = record.specialItem 
                ? `[${record.specialItem}] ${record.note || ''}`
                : (record.note || undefined);
              
              // 🛡️ RETRY: Salvar café com retry
              const savedCoffee = await withRetry(
                () => this.coffeeRepo!.create({
                  type: coffeeType,
                  makerId: user.id,
                  description
                }),
                'createCoffee'
              );
              coffeeId = savedCoffee.id;
              logger.debug(`Coffee saved to database: ${coffeeId}`);
              
              // 🆕 CORREÇÃO CRÍTICA: Creditar XP por café via Points Engine
              try {
                // 🚀 OTIMIZADO: Usar import estático
                const pointsEngine = getPointsEngine(this.prisma, logger);
                
                if (coffeeType === 'MADE') {
                  await pointsEngine.addCoffeeMadePoints(user.id, coffeeId);
                  logger.info('✅ XP creditado por café FEITO via WebSocket', { userId: user.id, coffeeId });
                } else {
                  // 🆕 Se for item especial, usar XP específico
                  if (record.specialItem) {
                    const xpSetting = await this.prisma.setting.findUnique({
                      where: { key: 'xp-config' }
                    });
                    const xpConfig = xpSetting?.value as Record<string, { xp: number }> || {};
                    
                    // XP padrão para itens especiais
                    const DEFAULT_ITEM_XP: Record<string, number> = {
                      'filtro-cafe': 30,
                      'bolo': 250,
                      'bolo-supreme': 400,
                      'bolacha': 25,
                      'bolacha-recheada': 35,
                      'biscoito': 50,
                      'sonho': 75
                    };
                    
                    const xpAmount = xpConfig[record.specialItem]?.xp || DEFAULT_ITEM_XP[record.specialItem] || 50;
                    
                    await pointsEngine.addPoints(user.id, 'coffee-brought', {
                      amount: xpAmount,
                      reason: `Trouxe item especial: ${record.specialItem}`,
                      sourceId: `special-item-${record.specialItem}-${coffeeId}`,
                      metadata: { coffeeId, type: 'BROUGHT', specialItem: record.specialItem }
                    });
                    
                    logger.info('✅ XP creditado por ITEM ESPECIAL via WebSocket', { 
                      userId: user.id, 
                      coffeeId, 
                      specialItem: record.specialItem,
                      xpAmount
                    });
                  } else {
                    await pointsEngine.addCoffeeBroughtPoints(user.id, coffeeId);
                    logger.info('✅ XP creditado por café TRAZIDO via WebSocket', { userId: user.id, coffeeId });
                  }
                }
                
                // 🆕 Verificar conquistas de café
                // 🚀 OTIMIZADO: Usar service cacheado
                const achievementService = this.getAchievementService();
                await achievementService.checkCoffeeAchievements(user.id);
                await achievementService.checkSpecialTimeAchievements(user.id, new Date());
                
              } catch (xpError) {
                logger.warn('⚠️ Erro ao creditar XP por café', { username, error: xpError });
              }
            }
          }
          
          const fullRecord: CoffeeRecord = {
            ...record,
            id: coffeeId,
            createdBy: username,
            createdAt: new Date().toISOString()
          };
          
          // Broadcast para todos
          this.io.emit('coffee:new', fullRecord);
          
          // Notificação especial - enviar originUser para evitar duplicação no cliente
          let message: string;
          if (record.specialItem) {
            message = `🎁 ${name} trouxe ${record.specialItem}!`;
          } else if (fullRecord.type === 'made') {
            message = `☕ ${name} acabou de fazer café!`;
          } else {
            message = `🛒 ${name} trouxe café!`;
          }
          
          // Enviar com originUser para que o frontend possa ignorar para o próprio usuário
          this.io.emit('system:notification', message, 'info', name);
          
          callback({ success: true, record: fullRecord });
          logger.info(`Coffee registered by ${name}: ${fullRecord.type}${record.specialItem ? ` (${record.specialItem})` : ''}`);
        } catch (error: any) {
          logger.error(`Error in coffee:register: ${error?.message || error}`, {
            username,
            error: error?.stack || String(error)
          });
          callback({ success: false, error: 'Falha ao registrar café. Tente novamente.' });
        }
      });
      
      socket.on('coffee:rate', async (coffeeId, rating, callback) => {
        try {
          logWebSocket('coffee:rate', username, { coffeeId, rating });
          
          // Salvar rating no banco de dados
          if (this.ratingRepo && this.userRepo && this.coffeeRepo) {
            // 🛡️ RETRY: Operação de banco com retry
            const user = await withRetry(
              () => this.userRepo!.findByUsername(username),
              'findUserForRating'
            );
            
            if (user) {
              // 🛡️ RETRY: Salvar rating com retry
              await withRetry(
                () => this.ratingRepo!.upsert({
                  coffeeId,
                  userId: user.id,
                  rating
                }),
                'upsertRating'
              );
              logger.debug(`Rating saved to database: ${coffeeId} -> ${rating}`);
              
              // 🛡️ QUEUE: Processar XP e conquistas em background
              queues.xpCredit.add(async () => {
                try {
                  // 🚀 OTIMIZADO: Usar import estático
                  const pointsEngine = getPointsEngine(this.prisma, logger);
                  
                  // Buscar XP configurado para avaliações
                  const setting = await this.prisma.setting.findUnique({
                    where: { key: 'xp-config' }
                  });
                  const xpConfig = setting?.value as Record<string, { xp: number }> || {};
                  const xpAmount = xpConfig['rating-given']?.xp || 3;
                  
                  // XP para quem AVALIOU
                  await pointsEngine.addPoints(user.id, 'rating', {
                    amount: xpAmount,
                    reason: `Avaliou café com ${rating} estrelas`,
                    sourceId: `rating-${coffeeId}-${user.id}`,
                    metadata: { coffeeId, rating }
                  });
                  
                  logger.info('✅ XP creditado por avaliação (background)', {
                    userId: user.id,
                    username,
                    coffeeId,
                    rating,
                    xpAmount
                  });
                } catch (xpError) {
                  logger.warn('⚠️ Erro ao creditar XP por avaliação (background)', { username, error: String(xpError) });
                }
              }).catch(err => logger.error('❌ Erro na fila de XP (rating)', { error: String(err) }));
              
              // 🛡️ QUEUE: Verificar conquistas em background
              queues.achievement.add(async () => {
                try {
                  // 🚀 OTIMIZADO: Usar service cacheado
                  const achievementService = this.getAchievementService();
                  await achievementService.checkRatingsGivenAchievements(user.id);
                  
                  // Verificar conquistas de avaliações RECEBIDAS (para o maker)
                  const coffee = await this.coffeeRepo?.findById(coffeeId);
                  if (coffee && coffee.makerId) {
                    await achievementService.checkRatingAchievements(coffee.makerId);
                  }
                } catch (achError) {
                  logger.warn('⚠️ Erro ao verificar conquistas de rating (background)', { username, error: String(achError) });
                }
              }).catch(err => logger.error('❌ Erro na fila de conquistas (rating)', { error: String(err) }));
              
              // 🔥 BUG FIX: Buscar café atualizado e emitir para todos os clientes
              const coffee = await withRetry(
                () => this.coffeeRepo!.findById(coffeeId),
                'findCoffeeById'
              );
              
              if (coffee && coffee.ratings) {
                const totalStars = coffee.ratings.reduce((sum, r) => sum + r.rating, 0);
                const ratingData: any = {
                  coffeeId,
                  makerName: coffee.maker.name,
                  totalStars,
                  raters: coffee.ratings.map(r => ({
                    name: (r as any).user?.name || 'Anônimo',
                    stars: r.rating
                  })),
                  average: totalStars / coffee.ratings.length
                };
                
                // Emitir para todos os clientes
                this.io.emit('coffee:rating', ratingData);
                logger.debug(`Broadcast coffee:rating for ${coffeeId}`);
                
                // 🆕 CORREÇÃO: Notificar o barista que seu café foi avaliado
                const makerUsername = coffee.maker.username;
                const raterDisplayName = name; // Nome de quem avaliou
                const stars = '⭐'.repeat(rating);
                this.notifyUser(
                  makerUsername,
                  `${raterDisplayName} avaliou seu café com ${stars}!`,
                  'info'
                );
                logger.info(`Barista ${makerUsername} notificado sobre avaliação de ${raterDisplayName}`);
              }
            }
          }
          
          callback({ success: true });
          logger.info(`Coffee rated by ${name}: ${coffeeId} -> ${rating}`);
        } catch (error) {
          logger.error(`Error in coffee:rate: ${error}`);
          callback({ success: false, error: 'Failed to rate coffee' });
        }
      });
      
      // ============================================
      // USER EVENTS
      // ============================================
      
      socket.on('user:status', (status) => {
        logWebSocket('user:status', username, { status });
        // TODO: Implementar status do usuário
      });
      
      // ============================================
      // DISCONNECT
      // ============================================
      
      socket.on('disconnect', (reason) => {
        logger.info(`User disconnected: ${name} (${reason})`);
        logWebSocket('disconnect', username, { reason });
        
        this.onlineUsers.delete(socket.id);
        this.removeUserSocket(username, socket.id);
        
        // Se usuário não tem mais sockets, está offline
        if (!this.getUserSockets(username)?.length) {
          socket.broadcast.emit('user:left', name);
        }
        
        this.broadcastOnlineUsers();
      });
    });
  }

  /**
   * Broadcast lista de usuários online para todos
   * 🔒 CRÍTICO: Enviar nomes completos (não usernames) para consistência com o frontend
   */
  private broadcastOnlineUsers(): void {
    // Mapear socket.id -> username e deduplica por username
    const usernames = Array.from(this.onlineUsers.values()); // Array de usernames
    const uniqueUsernames = Array.from(new Set(usernames)); // Remove duplicatas
    
    // Converter usernames para nomes completos
    const uniqueNames = uniqueUsernames.map(username => {
      return this.userNames.get(username) || username; // Fallback para username se nome não encontrado
    });
    
    logger.debug(`Broadcasting online users: ${uniqueNames.join(', ')}`);
    this.io.emit('users:online', uniqueNames);
  }

  /**
   * Gerenciar múltiplos sockets por usuário (múltiplas abas)
   */
  private addUserSocket(username: string, socketId: string): void {
    const sockets = this.userSockets.get(username) || [];
    sockets.push(socketId);
    this.userSockets.set(username, sockets);
  }

  private removeUserSocket(username: string, socketId: string): void {
    const sockets = this.userSockets.get(username) || [];
    const filtered = sockets.filter(id => id !== socketId);
    
    if (filtered.length > 0) {
      this.userSockets.set(username, filtered);
    } else {
      this.userSockets.delete(username);
    }
  }

  private getUserSockets(username: string): string[] | undefined {
    return this.userSockets.get(username);
  }

  /**
   * Enviar notificação para usuário específico
   */
  public notifyUser(username: string, message: string, type: 'info' | 'warning' | 'error'): void {
    const socketIds = this.getUserSockets(username);
    if (socketIds) {
      socketIds.forEach(socketId => {
        this.io.to(socketId).emit('system:notification', message, type);
      });
    }
  }

  /**
   * Broadcast notificação para todos
   * @param originUser - Usuário que originou a ação (para evitar duplicação no cliente)
   */
  public notifyAll(message: string, type: 'info' | 'warning' | 'error', originUser?: string): void {
    this.io.emit('system:notification', message, type, originUser);
    logger.info(`System notification: ${message} (${type})`);
  }

  /**
   * Broadcast mensagem de chat para todos os clientes conectados
   */
  public broadcastChatMessage(message: { id: string; author: string; text: string; timestamp: string; xpGained?: number }): void {
    this.io.emit('chat:message', message);
    logger.debug(`Chat message broadcast: ${message.author}: ${message.text.substring(0, 50)}...`);
  }

  /**
   * Obter número de conexões ativas
   */
  public getActiveConnections(): number {
    return this.onlineUsers.size;
  }

  /**
   * Obter lista de usuários online (nomes completos)
   */
  public getOnlineUsers(): string[] {
    const usernames = Array.from(new Set(this.onlineUsers.values()));
    return usernames.map(username => this.userNames.get(username) || username);
  }

  /**
   * Enviar mensagem de manutenção
   */
  public sendMaintenanceNotice(message: string): void {
    this.io.emit('system:maintenance', message);
    logger.warn(`Maintenance notice sent: ${message}`);
  }

  /**
   * 🛡️ Obter estatísticas do serviço para health check
   */
  public getStats(): {
    connections: number;
    uniqueUsers: number;
    cooldownEntries: number;
    rateLimitStats: any;
    queueStats: any;
  } {
    return {
      connections: this.onlineUsers.size,
      uniqueUsers: this.userSockets.size,
      cooldownEntries: lastMessageXP.size,
      rateLimitStats: {
        chatMessage: rateLimiters.chatMessage.getStats(),
        chatReaction: rateLimiters.chatReaction.getStats(),
        coffeeRegister: rateLimiters.coffeeRegister.getStats()
      },
      queueStats: {
        achievement: queues.achievement.getStats(),
        xpCredit: queues.xpCredit.getStats(),
        notification: queues.notification.getStats()
      }
    };
  }

  /**
   * 🛡️ Destrutor - Limpar recursos ao parar o servidor
   */
  public destroy(): void {
    logger.info('🛑 Destruindo WebSocket service...');
    
    // Parar interval de limpeza
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    // Parar memory monitor
    memoryMonitor.stop();
    
    // Destruir rate limiters
    rateLimiters.chatMessage.destroy();
    rateLimiters.chatReaction.destroy();
    rateLimiters.coffeeRegister.destroy();
    
    // Limpar filas
    queues.achievement.clear();
    queues.xpCredit.clear();
    queues.notification.clear();
    
    // Limpar Maps
    this.onlineUsers.clear();
    this.userNames.clear();
    this.userSockets.clear();
    lastMessageXP.clear();
    
    // 🛡️ Limpar timeouts de typing para evitar memory leaks
    for (const timeout of typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    typingTimeouts.clear();
    
    // Limpar cache do achievement service
    this.achievementServiceCache = undefined;
    
    // Fechar todas as conexões WebSocket
    this.io.close();
    
    logger.info('✅ WebSocket service destruído com sucesso');
  }
}
