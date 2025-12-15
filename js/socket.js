/**
 * 🧠 CÉREBRO - Socket Module
 * Gerenciamento de conexão WebSocket no cliente
 * 
 * 🛡️ SEGURO: Implementa sanitização contra XSS
 * 🔄 ROBUSTO: Reconexão automática infinita com backoff
 */

import { State } from './state.js';
import { Utils } from './utils.js';
import { Logger } from './logger.js';
import { Coffee } from './coffee.js';

// Flag para evitar notificações duplicadas de ações próprias
let lastOwnAction = null;

export const Socket = {
    io: null,
    connected: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: Infinity, // 🔄 NUNCA desistir de reconectar
    currentOnlineUsers: [], // 🆕 Lista atual de usuários online (fonte de verdade)
    
    /**
     * 🛡️ Escapa HTML para prevenir XSS
     * @param {string} text - Texto a ser escapado
     * @returns {string} Texto seguro
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Inicializa a conexão WebSocket
     */
    init() {
        // Verificar se socket.io está disponível
        if (typeof io === 'undefined') {
            Logger.warn('Socket.io client not available');
            return false;
        }
        
        const token = localStorage.getItem('cerebroToken');
        if (!token) {
            Logger.warn('No token available for WebSocket connection');
            return false;
        }
        
        try {
            // 🔄 ROBUSTO: Conectar com reconexão infinita e backoff exponencial
            this.io = io({
                auth: { token },
                reconnection: true,
                reconnectionDelay: 1000,      // Começa em 1s
                reconnectionDelayMax: 30000,  // Máximo 30s entre tentativas
                reconnectionAttempts: Infinity, // Nunca desistir
                timeout: 20000,               // 20s para conexão inicial
                randomizationFactor: 0.5,     // Adiciona variação para evitar thundering herd
                // Preferir WebSocket, fallback para polling
                transports: ['websocket', 'polling'],
                upgrade: true
            });
            
            this.setupEventHandlers();
            Logger.info('WebSocket connection initiated');
            return true;
        } catch (error) {
            Logger.error('Failed to initialize WebSocket', error);
            return false;
        }
    },
    
    /**
     * Configura os handlers de eventos
     */
    setupEventHandlers() {
        if (!this.io) return;
        
        // Conexão estabelecida
        this.io.on('connect', () => {
            this.connected = true;
            this.reconnectAttempts = 0;
            Logger.success('WebSocket connected');
            this.updateConnectionStatus(true);
        });
        
        // Desconexão
        this.io.on('disconnect', (reason) => {
            this.connected = false;
            Logger.warn(`WebSocket disconnected: ${reason}`);
            this.updateConnectionStatus(false);
        });
        
        // Erro de conexão
        this.io.on('connect_error', (error) => {
            this.reconnectAttempts++;
            Logger.error(`WebSocket connection error: ${error.message}`);
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                Logger.warn('Max reconnection attempts reached');
            }
        });
        
        // ============================================
        // CHAT EVENTS
        // ============================================
        
        // Receber mensagem de chat
        this.io.on('chat:message', (message) => {
            Logger.debug('Received chat message', message);
            this.handleChatMessage(message);
        });
        
        // Usuário digitando - integrar com sistema do Chat
        this.io.on('chat:typing', (userName) => {
            Logger.debug(`${userName} está digitando`);
            if (window.Chat && window.Chat.onlineUsers) {
                const userData = window.Chat.onlineUsers.get(userName) || { 
                    lastSeen: Date.now(), 
                    status: 'online' 
                };
                userData.isTyping = true;
                userData.lastSeen = Date.now();
                window.Chat.onlineUsers.set(userName, userData);
                window.Chat.updateTypingIndicator();
                window.Chat.updateOnlineUsers();
            }
            this.showTypingIndicator(userName);
        });
        
        this.io.on('chat:stop-typing', (userName) => {
            Logger.debug(`${userName} parou de digitar`);
            if (window.Chat && window.Chat.onlineUsers) {
                const userData = window.Chat.onlineUsers.get(userName);
                if (userData) {
                    userData.isTyping = false;
                    window.Chat.onlineUsers.set(userName, userData);
                    window.Chat.updateTypingIndicator();
                    window.Chat.updateOnlineUsers();
                }
            }
            this.hideTypingIndicator(userName);
        });
        
        // 🆕 Receber reação de outro usuário em tempo real
        this.io.on('chat:reaction', (data) => {
            Logger.debug('Received chat reaction', data);
            if (window.Chat && window.Chat.handleReactionUpdate) {
                window.Chat.handleReactionUpdate(data);
            }
        });
        
        // ============================================
        // USER EVENTS
        // ============================================
        
        // Usuário entrou - mostrar toast para outros usuários
        this.io.on('user:joined', (userName) => {
            Logger.info(`User joined: ${userName}`);
            
            // Normalizar para comparação
            const normalize = (name) => name?.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
            const currentUser = State.getUser();
            
            // Não mostrar notificação se for o próprio usuário entrando
            if (normalize(userName) !== normalize(currentUser)) {
                Utils.showToast(`${userName} entrou no Cérebro`, 'info');
            }
            
            // A lista completa virá via 'users:online' logo em seguida
            // Não precisamos manipular manualmente o mapa aqui
        });
        
        // Usuário saiu
        this.io.on('user:left', (userName) => {
            Logger.info(`User left: ${userName}`);
            // A lista atualizada virá via 'users:online' logo em seguida
            // Não precisamos manipular manualmente o mapa aqui
        });
        
        // Lista de usuários online
        this.io.on('users:online', (users) => {
            Logger.debug('Online users updated', users);
            this.updateOnlineUsers(users);
        });
        
        // ============================================
        // COFFEE EVENTS
        // ============================================
        
        // Novo café registrado
        this.io.on('coffee:new', (record) => {
            Logger.info('New coffee registered', record);
            // Atualizar UI
            Coffee.updateStats();
            Coffee.updateHistory();
            Coffee.updateLastSpecialItem();
        });
        
        // 🔥 BUG FIX: Café foi avaliado - sincronizar ratings
        this.io.on('coffee:rating', (ratingData) => {
            Logger.info('Coffee rating event received', ratingData);
            const { coffeeId, average, raters } = ratingData;
            
            // Atualizar ratings no State
            if (State && State.coffeeData && State.coffeeData.ratings) {
                State.coffeeData.ratings[coffeeId] = ratingData;
                Logger.debug('Ratings updated in State:', State.coffeeData.ratings[coffeeId]);
            }
            
            // Atualizar UI
            Coffee.updateTodayCoffee();
            Coffee.updateTopBaristas();
            Coffee.updateHistory();
        });
        
        // ============================================
        // SYSTEM EVENTS
        // ============================================
        
        // Notificação do sistema - usar Toast (verde no canto superior)
        // Evitar duplicação: não mostrar para quem executou a ação (já recebeu toast local)
        this.io.on('system:notification', (message, type, originUser) => {
            const currentUser = State.getUser();
            // Se a notificação veio da própria ação do usuário, ignorar
            // (o frontend já mostrou o toast localmente)
            if (originUser && currentUser) {
                const normalize = (name) => name?.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
                if (normalize(originUser) === normalize(currentUser)) {
                    Logger.debug('Ignorando notificação própria:', message);
                    return;
                }
            }
            Utils.showToast(message, type === 'error' ? 'error' : (type === 'warning' ? 'warning' : 'info'));
        });
        
        // Aviso de manutenção
        this.io.on('system:maintenance', (message) => {
            Utils.showToast(`⚠️ Manutenção: ${message}`, 'warning', null, 10000);
        });
    },
    
    /**
     * Processar mensagem de chat recebida via WebSocket
     * 🆕 ROBUSTEZ: Verificação dupla para evitar duplicação de mensagens
     */
    handleChatMessage(message) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        // 🆕 Normalizar ID para comparação consistente
        const messageId = String(message.id);
        
        // Verificar se a mensagem já existe no DOM (verificação principal)
        const existingMsg = document.querySelector(`[data-message-id="${messageId}"]`);
        if (existingMsg) {
            console.log(`[Socket] ⏭️ Mensagem ${messageId} já existe no DOM, ignorando`);
            return;
        }
        
        // Verificar se já existe no State
        const messages = State.getChatMessages();
        const existsInState = messages.some(m => String(m.id) === messageId);
        
        // 🔒 CORREÇÃO: Comparação case-insensitive para identificar mensagens próprias
        const currentUser = State.getUser();
        const normalizeUsername = (name) => {
            if (!name) return '';
            return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        const isOwnMessage = currentUser && message.author && 
            normalizeUsername(message.author) === normalizeUsername(currentUser);
        
        // Se a mensagem é do próprio usuário e já existe no state, ignorar
        // (foi enviada localmente e agora está voltando do servidor)
        if (isOwnMessage && existsInState) {
            console.log(`[Socket] ⏭️ Mensagem própria ${messageId} já no State, ignorando`);
            return;
        }
        
        // Adicionar ao State se não existir
        if (!existsInState) {
            messages.push(message);
            State.setChatMessages(messages);
            
            // 🆕 Também atualizar allMessages no Chat se disponível
            if (window.Chat && window.Chat.allMessages) {
                const alreadyInAllMessages = window.Chat.allMessages.some(m => String(m.id) === messageId);
                if (!alreadyInAllMessages) {
                    window.Chat.allMessages.push(message);
                    // Manter ordenado por timestamp
                    window.Chat.allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                }
            }
        }
        
        // Verificar se está perto do final antes de adicionar
        const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
        
        // 🆕 Verificação final antes de renderizar (evitar race condition)
        const doubleCheck = document.querySelector(`[data-message-id="${messageId}"]`);
        if (doubleCheck) {
            console.log(`[Socket] ⏭️ Mensagem ${messageId} apareceu no DOM durante processamento`);
            return;
        }
        
        // Renderizar mensagem (usar Chat module se disponível)
        if (typeof window.Chat !== 'undefined' && window.Chat.appendMessage) {
            window.Chat.appendMessage(message, false); // Não fazer scroll automático
        } else {
            this.appendMessageToDOM(message);
        }
        
        // Scroll para a mensagem apenas se estava no final e não está rolando
        const isUserScrolling = window.Chat?.isUserScrolling || false;
        if (wasAtBottom && !isUserScrolling) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else if (isUserScrolling) {
            // Mostrar botão de novas mensagens
            if (window.Chat?.showNewMessagesButton) {
                window.Chat.showNewMessagesButton();
            }
        }
        
        // Notificar se não for do usuário atual (usar toast verde)
        if (!isOwnMessage) {
            // 🛡️ Escapar texto para notificação
            const safeText = this.escapeHtml(message.text.substring(0, 50));
            const safeAuthor = this.escapeHtml(message.author);
            Utils.showToast(`💬 ${safeAuthor}: ${safeText}...`, 'info');
        }
    },
    
    /**
     * Fallback para renderizar mensagem
     * 🛡️ SEGURO: Usa textContent para prevenir XSS
     */
    appendMessageToDOM(message) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        const msgElement = document.createElement('div');
        msgElement.className = 'message';
        msgElement.setAttribute('data-message-id', message.id);
        
        // 🔒 CORREÇÃO: Comparação case-insensitive
        const currentUser = State.getUser();
        const normalizeUsername = (name) => {
            if (!name) return '';
            return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        if (currentUser && message.author && 
            normalizeUsername(message.author) === normalizeUsername(currentUser)) {
            msgElement.classList.add('own-message');
        }
        
        const time = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // 🛡️ SEGURO: Criar elementos DOM ao invés de innerHTML
        const header = document.createElement('div');
        header.className = 'message-header';
        
        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author';
        authorSpan.textContent = message.author || 'Anônimo'; // textContent é seguro
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = time;
        
        header.appendChild(authorSpan);
        header.appendChild(timeSpan);
        
        const content = document.createElement('div');
        content.className = 'message-content';
        content.textContent = message.text || ''; // textContent previne XSS
        
        msgElement.appendChild(header);
        msgElement.appendChild(content);
        
        chatContainer.appendChild(msgElement);
    },
    
    /**
     * Enviar mensagem de chat via WebSocket
     * @param {string|object} messageData - Texto da mensagem ou objeto { text, replyTo }
     */
    sendChatMessage(messageData) {
        if (!this.connected || !this.io) {
            Logger.warn('Cannot send message: not connected');
            return Promise.reject(new Error('Not connected'));
        }
        
        // Suportar string (texto simples) ou objeto (com replyTo)
        const data = typeof messageData === 'string' 
            ? { text: messageData } 
            : messageData;
        
        return new Promise((resolve, reject) => {
            Logger.debug('📤 Enviando mensagem via WebSocket...', { 
                text: data.text?.substring(0, 30),
                hasReplyTo: !!data.replyTo 
            });
            
            this.io.emit('chat:send', data, async (response) => {
                Logger.debug('📥 Resposta do servidor recebida:', response);
                
                if (response && response.success) {
                    Logger.debug('✅ Mensagem enviada com sucesso', { 
                        messageId: response.message?.id,
                        xpGained: response.xpGained
                    });
                    
                    // 🔧 PADRONIZAÇÃO: Retornar resposta completa com xpGained
                    // O chat.js mostrará notificação de XP baseada na resposta
                    resolve({
                        message: response.message,
                        xpGained: response.xpGained || 0
                    });
                } else {
                    // 🆕 TRATAMENTO DE BAN: Se servidor informou que está banido, atualizar frontend
                    if (response?.banned) {
                        Logger.warn('🚫 Servidor confirmou ban:', response.bannedUntil);
                        
                        // Importar dinamicamente para evitar dependência circular
                        const { ChatModeration } = await import('./chat-moderation.js');
                        const currentUser = State.getUser();
                        
                        if (currentUser && response.bannedUntil) {
                            const until = new Date(response.bannedUntil).getTime();
                            ChatModeration.blockedUsers.set(currentUser, {
                                reason: response.error || 'Violação das regras',
                                blockedAt: Date.now(),
                                until: until,
                                messagesToDelete: [],
                                serverVerified: true
                            });
                            ChatModeration.lastBanCheckTimestamp = Date.now();
                            ChatModeration.saveBlockedUsers();
                        }
                    }
                    
                    Logger.warn('❌ Falha ao enviar mensagem:', response?.error);
                    reject(new Error(response?.error || 'Failed to send message'));
                }
            });
        });
    },
    
    /**
     * Indicar que está digitando
     */
    startTyping() {
        if (this.connected && this.io) {
            this.io.emit('chat:typing');
        }
    },
    
    /**
     * Indicar que parou de digitar
     */
    stopTyping() {
        if (this.connected && this.io) {
            this.io.emit('chat:stop-typing');
        }
    },
    
    /**
     * 🆕 Enviar reação via WebSocket (tempo real)
     */
    sendReaction(messageId, emoji) {
        if (!this.connected || !this.io) {
            Logger.warn('Cannot send reaction: not connected');
            return Promise.reject(new Error('Not connected'));
        }
        
        return new Promise((resolve, reject) => {
            Logger.debug('📤 Enviando reação via WebSocket...', { messageId, emoji });
            
            this.io.emit('chat:react', messageId, emoji, (response) => {
                Logger.debug('📥 Resposta de reação recebida:', response);
                
                if (response && response.success) {
                    Logger.debug('✅ Reação enviada com sucesso');
                    resolve(response);
                } else {
                    Logger.warn('❌ Falha ao enviar reação:', response?.error);
                    reject(new Error(response?.error || 'Failed to send reaction'));
                }
            });
        });
    },
    
    /**
     * Registrar café via WebSocket
     */
    registerCoffee(record) {
        if (!this.connected || !this.io) {
            Logger.warn('Cannot register coffee: not connected');
            return Promise.reject(new Error('Not connected'));
        }
        
        return new Promise((resolve, reject) => {
            this.io.emit('coffee:register', record, (response) => {
                if (response.success) {
                    resolve(response.record);
                } else {
                    reject(new Error(response.error || 'Failed to register coffee'));
                }
            });
        });
    },
    
    /**
     * Mostrar indicador de digitação
     */
    showTypingIndicator(userName) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.textContent = `${userName} está digitando...`;
            indicator.style.display = 'block';
        }
    },
    
    /**
     * Esconder indicador de digitação
     */
    hideTypingIndicator(userName) {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    },
    
    /**
     * Atualizar lista de usuários online
     * 🔒 FONTE ÚNICA DE VERDADE: currentOnlineUsers
     * 🔒 CENTRALIZADO: Home e Chat usam esta fonte
     */
    updateOnlineUsers(users) {
        // 🔒 GUARDAR lista atual - FONTE ÚNICA DE VERDADE
        this.currentOnlineUsers = users || [];
        
        Logger.debug('🔄 Usuários online atualizados:', this.currentOnlineUsers);
        
        // 🆕 Chamar atualização do Chat (usa currentOnlineUsers internamente)
        if (window.Chat && typeof window.Chat.updateOnlineUsers === 'function') {
            window.Chat.updateOnlineUsers();
        }
        
        // 🆕 SEMPRE atualizar a home page
        this.updateHomeOnlineDisplay(users);
    },
    
    /**
     * 🆕 Atualizar exibição de usuários online na home page
     * Fonte de verdade: dados do WebSocket
     */
    updateHomeOnlineDisplay(users) {
        const container = document.getElementById('homeOnlineMembers');
        if (!container) return;
        
        const currentUser = State.getUser();
        
        // 🔒 Função de normalização consistente com Chat
        const normalize = (name) => {
            if (!name) return '';
            return name.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        };
        
        // Membros conhecidos do sistema
        const knownMembers = [
            { name: 'Wilmar', photo: null },
            { name: 'Renan', photo: 'membros/renan.jpeg' },
            { name: 'Pedrão', photo: 'membros/pedrao.jpeg' },
            { name: 'Atila', photo: 'membros/Atila.jpeg' },
            { name: 'Chris', photo: 'membros/chris.jpeg' },
            { name: 'Marcus', photo: 'membros/marcus.jpeg' }
        ];
        
        // 🔒 Normalizar lista de usuários online do servidor (mesma função que Chat)
        const onlineNormalized = new Set(users.map(u => normalize(u)));
        
        // Determinar status de cada membro
        const membersWithStatus = knownMembers.map(member => {
            const normalizedName = normalize(member.name);
            const normalizedCurrentUser = normalize(currentUser);
            const isOnline = onlineNormalized.has(normalizedName);
            const isCurrentUser = normalizedCurrentUser === normalizedName;
            
            return {
                ...member,
                isOnline: isOnline || isCurrentUser,
                isCurrentUser
            };
        });
        
        // Ordenar: usuário atual primeiro, depois online
        membersWithStatus.sort((a, b) => {
            if (a.isCurrentUser) return -1;
            if (b.isCurrentUser) return 1;
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return 0;
        });
        
        const onlineCount = membersWithStatus.filter(m => m.isOnline).length;
        
        // Renderizar avatares
        const getInitials = (name) => name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        const getColor = (name) => {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
            return colors[name.length % colors.length];
        };
        
        container.innerHTML = membersWithStatus.map(member => {
            const initials = getInitials(member.name);
            const color = getColor(member.name);
            const statusClass = member.isOnline ? '' : 'offline';
            const displayName = member.isCurrentUser ? 'Você' : member.name;
            
            if (member.photo) {
                return `
                    <div class="status-member-avatar ${statusClass}" title="${displayName}">
                        <img src="${member.photo}" alt="${member.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <span style="display:none; background:${color}; width:100%; height:100%; align-items:center; justify-content:center;">${initials}</span>
                        <span class="status-member-tooltip">${displayName}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="status-member-avatar ${statusClass}" style="background:${color}" title="${displayName}">
                        ${initials}
                        <span class="status-member-tooltip">${displayName}</span>
                    </div>
                `;
            }
        }).join('');
        
        // Atualizar contador
        this.updateHomeOnlineCount(onlineCount);
    },
    
    /**
     * 🆕 Atualizar contador de online na página inicial
     */
    updateHomeOnlineCount(count) {
        const homeCounter = document.getElementById('homeOnlineCount');
        if (homeCounter) {
            homeCounter.textContent = `${count} online`;
        }
    },
    
    /**
     * Atualizar indicador de status de conexão
     */
    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connectionStatus');
        if (indicator) {
            indicator.className = connected ? 'status-connected' : 'status-disconnected';
            indicator.title = connected ? 'Conectado em tempo real' : 'Desconectado';
        }
    },
    
    /**
     * Desconectar WebSocket
     */
    disconnect() {
        if (this.io) {
            this.io.disconnect();
            this.io = null;
            this.connected = false;
            Logger.info('WebSocket disconnected manually');
        }
    },
    
    /**
     * Reconectar WebSocket
     */
    reconnect() {
        this.disconnect();
        setTimeout(() => this.init(), 1000);
    },
    
    /**
     * Verificar se está conectado
     */
    isConnected() {
        return this.connected;
    }
};

// Expor globalmente para debug
window.Socket = Socket;
