/**
 * CHAT MODULE
 * Handles chat functionality with reactions and search
 * Enhanced with professional features like typing indicators, read receipts, etc.
 * 
 * REFATORADO: Agora usa módulos organizados em js/chat/
 */

import { State } from './state.js';
import { Utils } from './utils.js';
import { Notifications } from './notifications.js';
import { ChatModeration } from './chat-moderation.js';

// Importar módulos organizados
import { ChatState } from './chat/state.js';
import { normalizeUsername, formatDateSeparator, formatTimeAgo, getStatusText, getUserStatus, generateMessagesHash } from './chat/utils.js';
import { ChatAvatars } from './chat/avatars.js';
import { ChatRender } from './chat/render.js';
import { ChatReply } from './chat/reply.js';
import { ChatSearch } from './chat/search.js';
import { ChatScroll } from './chat/scroll.js';
import { ChatReactions } from './chat/reactions.js';
import { ChatPresence } from './chat/presence.js';
import { ChatAPI } from './chat/api.js';
import { ChatEvents } from './chat/events.js';
import { ChatModerationIntegration } from './chat/moderation.js';

export const Chat = {
    // Usar estado centralizado dos módulos
    get reactions() { return ChatState.reactions; },
    get searchQuery() { return ChatState.searchQuery; },
    set searchQuery(value) { ChatState.searchQuery = value; },
    get lastMessageId() { return ChatState.lastMessageId; },
    set lastMessageId(value) { ChatState.lastMessageId = value; },
    get isUserScrolling() { return ChatState.isUserScrolling; },
    set isUserScrolling(value) { ChatState.isUserScrolling = value; },
    get scrollTimeout() { return ChatState.scrollTimeout; },
    set scrollTimeout(value) { ChatState.scrollTimeout = value; },
    get typingTimeout() { return ChatState.typingTimeout; },
    set typingTimeout(value) { ChatState.typingTimeout = value; },
    get isTyping() { return ChatState.isTyping; },
    set isTyping(value) { ChatState.isTyping = value; },
    get unreadCount() { return ChatState.unreadCount; },
    set unreadCount(value) { ChatState.unreadCount = value; },
    get lastReadMessageId() { return ChatState.lastReadMessageId; },
    set lastReadMessageId(value) { ChatState.lastReadMessageId = value; },
    get onlineUsers() { return ChatState.onlineUsers; },
    get activityInterval() { return ChatState.activityInterval; },
    set activityInterval(value) { ChatState.activityInterval = value; },
    get ONLINE_THRESHOLD() { return ChatState.ONLINE_THRESHOLD; },
    get TYPING_TIMEOUT() { return ChatState.TYPING_TIMEOUT; },
    get replyingTo() { return ChatState.replyingTo; },
    set replyingTo(value) { ChatState.replyingTo = value; },
    get PAGE_SIZE() { return ChatState.PAGE_SIZE; },
    get currentPage() { return ChatState.currentPage; },
    set currentPage(value) { ChatState.currentPage = value; },
    get allMessages() { return ChatState.allMessages; },
    set allMessages(value) { ChatState.allMessages = value; },
    get isLoadingMore() { return ChatState.isLoadingMore; },
    set isLoadingMore(value) { ChatState.isLoadingMore = value; },
    get hasMoreMessages() { return ChatState.hasMoreMessages; },
    set hasMoreMessages(value) { ChatState.hasMoreMessages = value; },
    get lastSyncTimestamp() { return ChatState.lastSyncTimestamp; },
    set lastSyncTimestamp(value) { ChatState.lastSyncTimestamp = value; },
    get lastServerDataHash() { return ChatState.lastServerDataHash; },
    set lastServerDataHash(value) { ChatState.lastServerDataHash = value; },
    get syncInProgress() { return ChatState.syncInProgress; },
    set syncInProgress(value) { ChatState.syncInProgress = value; },
    get _scrollObserver() { return ChatState._scrollObserver; },
    set _scrollObserver(value) { ChatState._scrollObserver = value; },

    // Helpers de referência reativa para módulos de scroll (manter ChatState como fonte única)
    _ref(getter, setter) {
        return {
            get value() { return getter(); },
            set value(v) { setter(v); }
        };
    },
    _isUserScrollingRef() {
        return this._ref(() => ChatState.isUserScrolling, (v) => { ChatState.isUserScrolling = v; });
    },
    _scrollTimeoutRef() {
        return this._ref(() => ChatState.scrollTimeout, (v) => { ChatState.scrollTimeout = v; });
    },
    _scrollObserverRef() {
        return this._ref(() => ChatState._scrollObserver, (v) => { ChatState._scrollObserver = v; });
    },
    
    init() {
        this.loadMessages();
        this.setupSearch();
        this.setupScrollDetection();
        this.setupTypingDetection();
        this.setupInputShortcuts();
        this.setupEmojiPicker();
        this.setupMessageActions(); // Handler direto para botões
        this.updatePresence();
        this.startActivityTracking();
        this.loadUnreadState();
        this.restoreMembersPanelState();
        // 🔧 Carregar bans do banco (não bloqueia init)
        ChatModeration.init().catch(err => console.warn('Erro ao carregar moderação:', err));
        
        // Scroll para o final ao carregar - múltiplas tentativas
        this.forceScrollToBottom();
        
        // Listener para quando navega para o chat
        this.setupNavigationListener();
        
        // 🔧 CORREÇÃO: Listener para quando a aba volta ao foco - forçar sincronização
        this.setupVisibilityListener();
    },
    
    /**
     * Setup de handlers diretos para ações nas mensagens
     * Garante que botões funcionem mesmo com CSS complexo
     */
    setupMessageActions() {
        ChatEvents.setupMessageActions(
            (messageId) => this.replyToMessage(messageId),
            (messageId) => this.copyMessage(messageId),
            (messageId) => this.toggleReactionPicker(messageId),
            () => this.loadMoreMessages(),
            this.hasMoreMessages,
            this.isLoadingMore,
            this.PAGE_SIZE
        );
    },
    
    /**
     * Força scroll para o final com múltiplas tentativas
     * Resolve problema de scroll não funcionar na primeira abertura
     */
    forceScrollToBottom() {
        ChatScroll.forceScrollToBottom(
            this._isUserScrollingRef(),
            this._scrollObserverRef()
        );
    },
    
    /**
     * Configura listener para navegação - garante scroll ao abrir chat
     */
    setupNavigationListener() {
        ChatEvents.setupNavigationListener(() => this.forceScrollToBottom());
    },
    
    /**
     * 🔧 CORREÇÃO: Listener para visibilidade da aba
     * Força sincronização completa quando usuário volta à aba
     * Isso resolve o bug de mensagens antigas aparecendo no lugar das novas
     */
    setupVisibilityListener() {
        ChatEvents.setupVisibilityListener(
            (forceRebuild) => this.forceFullSync(forceRebuild),
            () => this.markAllAsRead(),
            () => this.validateDOMConsistency()
        );
        
        // Listener adicional para quando a janela ganha foco
        window.addEventListener('focus', async () => {
            const now = Date.now();
            if (now - this.lastSyncTimestamp > 5000) {
                console.log('[Chat] 🔄 Janela ganhou foco - verificando atualizações...');
                await this.forceFullSync(false);
            }
        });
    },
    
    /**
     * 🆕 Valida se o DOM está consistente com os dados em memória
     * Se não estiver, força reconstrução
     */
    validateDOMConsistency() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        const domMessages = chatContainer.querySelectorAll('[data-message-id]');
        const domMessageIds = Array.from(domMessages).map(el => String(el.dataset.messageId));
        
        // Verificar se todas as mensagens recentes estão no DOM
        const recentMessages = this.allMessages.slice(-this.PAGE_SIZE);
        const missingMessages = recentMessages.filter(m => !domMessageIds.includes(String(m.id)));
        
        if (missingMessages.length > 0) {
            console.log(`[Chat] ⚠️ ${missingMessages.length} mensagens faltando no DOM - reconstruindo...`);
            this.loadMessages();
            return;
        }
        
        // Verificar se há mensagens no DOM que não deveriam estar
        const validMessageIds = new Set(this.allMessages.map(m => String(m.id)));
        const orphanMessages = domMessageIds.filter(id => !validMessageIds.has(id));
        
        if (orphanMessages.length > 0) {
            console.log(`[Chat] ⚠️ ${orphanMessages.length} mensagens órfãs no DOM - reconstruindo...`);
            this.loadMessages();
        }
    },
    
    /**
     * 🔧 CORREÇÃO ROBUSTA: Força sincronização completa do servidor
     * @param {boolean} forceRebuild - Se true, reconstrói todo o DOM
     */
    async forceFullSync(forceRebuild = false) {
        await ChatAPI.forceFullSync(
            forceRebuild,
            () => this.loadMessages(),
            (msg, shouldScroll) => this.appendMessage(msg, shouldScroll),
            () => this.showNewMessagesButton(),
            () => this.updateOnlineUsers()
        );
    },
    
    /**
     * Gera hash das mensagens para detectar mudanças
     */
    generateMessagesHash(messages) {
        return generateMessagesHash(messages);
    },

    /**
     * Configurar atalhos de teclado no input
     */
    setupInputShortcuts() {
        ChatEvents.setupInputShortcuts(() => this.cancelReply());
    },
    
    /**
     * Responder a uma mensagem
     */
    replyToMessage(messageId) {
        const message = ChatReply.replyToMessage(messageId, this.scrollToMessage.bind(this));
        if (message) {
            this.replyingTo = message;
        }
    },
    
    /**
     * Mostrar preview da mensagem sendo respondida
     */
    showReplyPreview(message) {
        ChatReply.showReplyPreview(message);
    },
    
    /**
     * Cancelar resposta
     */
    cancelReply() {
        this.replyingTo = null;
        ChatReply.cancelReply();
    },
    
    /**
     * Toggle emoji picker
     */
    toggleEmojiPicker() {
        const picker = document.getElementById('emojiPicker');
        if (picker) {
            picker.classList.toggle('active');
        }
    },
    
    /**
     * Inserir emoji no input
     */
    insertEmoji(emoji) {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
        
        // Fechar picker após inserir
        this.toggleEmojiPicker();
    },
    
    /**
     * Setup do emoji picker
     */
    setupEmojiPicker() {
        ChatEvents.setupEmojiPicker(
            () => this.toggleEmojiPicker(),
            (emoji) => this.insertEmoji(emoji)
        );
    },
    
    /**
     * Copiar texto da mensagem para área de transferência E colar no input
     */
    async copyMessage(messageId) {
        console.log('[Chat] copyMessage called with messageId:', messageId);
        
        const messages = State.getChatMessages();
        // Comparar como string para suportar UUIDs e números
        const message = messages.find(m => String(m.id) === String(messageId));
        
        if (!message) {
            console.warn('[Chat] Message not found:', messageId);
            Utils.showToast('Mensagem não encontrada', 'error', null, 2000);
            return;
        }
        
        try {
            // Copiar para área de transferência
            await navigator.clipboard.writeText(message.text);
            
            // Também colar no input do chat
            const input = document.getElementById('chatInput');
            if (input) {
                input.value = message.text;
                input.focus();
                // Posicionar cursor no final
                input.setSelectionRange(input.value.length, input.value.length);
            }
            
            Utils.showToast('Mensagem copiada para o input!', 'success', null, 2000);
        } catch (error) {
            console.warn('[Chat] Clipboard API failed, using fallback:', error);
            // Fallback para navegadores antigos
            const textArea = document.createElement('textarea');
            textArea.value = message.text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            // Colar no input
            const input = document.getElementById('chatInput');
            if (input) {
                input.value = message.text;
                input.focus();
            }
            
            Utils.showToast('Mensagem copiada para o input!', 'success', null, 2000);
        }
    },
    
    /**
     * Inicia tracking de atividade dos usuários
     */
    startActivityTracking() {
        // Atualizar presença a cada 30 segundos
        this.activityInterval = setInterval(() => {
            this.updatePresence();
            this.updateOnlineUsers();
        }, 30000);
        
        // Atualizar ao focar na janela
        window.addEventListener('focus', () => {
            this.updatePresence();
            this.markAllAsRead();
        });
        
        // Inicial
        this.updateOnlineUsers();
    },
    
    /**
     * Atualiza a presença do usuário atual
     */
    updatePresence() {
        ChatPresence.updatePresence(this.onlineUsers);
    },
    
    /**
     * Detecta quando o usuário está digitando
     */
    setupTypingDetection() {
        ChatPresence.setupTypingDetection(
            { value: this.isTyping },
            { value: this.typingTimeout },
            this.TYPING_TIMEOUT,
            () => this.emitTypingStart(),
            () => this.emitTypingStop()
        );
    },
    
    /**
     * Emite evento de início de digitação
     */
    emitTypingStart() {
        ChatPresence.emitTypingStart(this.onlineUsers);
        this.updateTypingIndicator();
    },
    
    /**
     * Emite evento de parada de digitação
     */
    emitTypingStop() {
        ChatPresence.emitTypingStop(this.onlineUsers);
        this.updateTypingIndicator();
    },
    
    /**
     * Atualiza indicador de digitação na UI
     */
    updateTypingIndicator() {
        ChatPresence.updateTypingIndicator(this.onlineUsers);
    },
    
    /**
     * Marca mensagens como lidas
     */
    markAllAsRead() {
        const messages = State.getChatMessages();
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            this.lastReadMessageId = lastMsg.id;
            this.unreadCount = 0;
            localStorage.setItem('cerebroLastReadMsg', lastMsg.id);
            this.updateUnreadBadge();
        }
    },
    
    /**
     * Scroll para uma mensagem específica (para ir ao reply)
     */
    scrollToMessage(messageId) {
        ChatReply.scrollToMessage(messageId);
    },
    
    /**
     * Carrega estado de não lidas
     */
    loadUnreadState() {
        this.lastReadMessageId = localStorage.getItem('cerebroLastReadMsg');
    },
    
    /**
     * Atualiza badge de mensagens não lidas
     */
    updateUnreadBadge() {
        const badge = document.getElementById('chatUnreadBadge');
        const navItem = document.querySelector('[data-page="chat"]');
        
        if (this.unreadCount > 0) {
            if (!badge && navItem) {
                const badgeEl = document.createElement('span');
                badgeEl.id = 'chatUnreadBadge';
                badgeEl.className = 'unread-badge';
                badgeEl.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                navItem.appendChild(badgeEl);
            } else if (badge) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
            }
        } else if (badge) {
            badge.style.display = 'none';
        }
    },
    
    /**
     * Detecta se o usuário está rolando manualmente
     */
    setupScrollDetection() {
        ChatScroll.setupScrollDetection(
            this._isUserScrollingRef(),
            this._scrollTimeoutRef(),
            () => this.showNewMessagesButton(),
            () => this.hideNewMessagesButton()
        );
    },
    
    /**
     * Mostra o botão de novas mensagens
     */
    showNewMessagesButton() {
        ChatScroll.showNewMessagesButton(() => this.scrollToBottom());
    },
    
    /**
     * Esconde o botão de novas mensagens
     */
    hideNewMessagesButton() {
        ChatScroll.hideNewMessagesButton();
    },
    
    /**
     * Rola suavemente para o final do chat
     */
    scrollToBottom(instant = false) {
        ChatScroll.scrollToBottom(instant, this._isUserScrollingRef());
    },
    
    setupSearch() {
        ChatSearch.setupSearch(
            { value: this.searchQuery },
            () => this.filterMessages()
        );
    },
    
    filterMessages() {
        ChatSearch.filterMessages(this.searchQuery);
    },
    
    clearSearch() {
        ChatSearch.clearSearch(
            { value: this.searchQuery },
            () => this.filterMessages()
        );
    },
    
    /**
     * Carrega mensagens com paginação (estilo WhatsApp)
     * Carrega apenas as últimas PAGE_SIZE mensagens inicialmente
     */
    loadMessages() {
        ChatAPI.loadMessages(
            this.reactions,
            (messageId) => this.scrollToMessage(messageId),
            () => this.forceScrollToBottom(),
            () => this.updateOnlineUsers()
        );

        // Garantir que o botão de novas mensagens não fique visível ao iniciar
        this.hideNewMessagesButton();
        
        // Marcar como lidas se a janela está focada
        if (document.hasFocus()) {
            this.markAllAsRead();
        }
    },
    
    /**
     * Renderiza um conjunto de mensagens no container
     */
    renderMessages(messages, container, prepend = false) {
        ChatRender.renderMessages(
            messages,
            container,
            prepend,
            this.reactions,
            (messageId) => this.scrollToMessage(messageId)
        );
    },
    
    /**
     * Cria elemento de mensagem (extraído de appendMessage para reutilização)
     */
    createMessageElement(message, isContinuation = false) {
        return ChatRender.createMessageElement(
            message,
            isContinuation,
            this.reactions,
            (messageId) => this.scrollToMessage(messageId)
        );
    },
    
    /**
     * Adiciona indicador de "carregar mais" no topo
     */
    addLoadMoreIndicator(container) {
        ChatRender.addLoadMoreIndicator(container);
    },
    
    /**
     * Carrega mais mensagens antigas quando rola para cima
     */
    async loadMoreMessages() {
        await ChatAPI.loadMoreMessages(
            this.reactions,
            (messageId) => this.scrollToMessage(messageId)
        );
    },
    
    /**
     * Formata data para separador
     */
    formatDateSeparator(date) {
        return formatDateSeparator(date);
    },
    
    /**
     * Adiciona separador de data no chat
     */
    appendDateSeparator(container, dateStr) {
        const separator = document.createElement('div');
        separator.className = 'date-separator';
        separator.innerHTML = `<span>${dateStr}</span>`;
        container.appendChild(separator);
    },
    
    /**
     * Sincronização incremental - adiciona apenas mensagens novas
     * 🔧 CORREÇÃO: Agora também atualiza allMessages corretamente
     */
    async syncMessages() {
        await ChatAPI.syncMessages(
            (msg, shouldScroll) => this.appendMessage(msg, shouldScroll),
            () => this.showNewMessagesButton(),
            () => this.updateOnlineUsers(),
            () => this.loadMessages()
        );
    },
    
    async send() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        const text = input.value.trim();
        
        if (!text) return;
        
        const currentUser = State.getUser();
        if (!currentUser) {
            document.getElementById('usernameModal').classList.add('active');
            return;
        }
        
        // 🛡️ VERIFICAR SE USUÁRIO ESTÁ BLOQUEADO (verificação robusta com servidor)
        const blockData = await ChatModerationIntegration.checkUserBlocked(currentUser);
        
        if (blockData) {
            const timeRemaining = ChatModeration.getBlockTimeRemaining(currentUser);
            const formattedTime = ChatModeration.formatBlockTime(timeRemaining);
            
            this.showModerationMessage(
                `🚫 Você está temporariamente bloqueado de enviar mensagens.`,
                `Motivo: ${blockData.reason}<br>Tempo restante: ${formattedTime}`,
                'error'
            );
            input.value = '';
            return;
        }
        
        // 🛡️ VERIFICAR SPAM ANTES DE ENVIAR
        const spamCheck = ChatModerationIntegration.checkSpam(currentUser, text);
        
        // Mostrar avisos se houver
        if (spamCheck.warnings.length > 0) {
            this.showModerationMessage(
                '⚠️ Atenção',
                spamCheck.warnings.join('<br>'),
                'warning'
            );
        }
        
        // Se não passou na verificação, bloquear usuário
        if (!spamCheck.passed) {
            const blockConfig = ChatModeration.config.blocking;
            
            // Obter IDs das últimas mensagens para deletar
            let messagesToDelete = [];
            if (blockConfig?.deleteMessages) {
                const messages = State.getChatMessages();
                const userMessages = messages.filter(m => m.author === currentUser);
                messagesToDelete = userMessages
                    .slice(-blockConfig.messagesToDelete)
                    .map(m => m.id);
            }
            
            // Bloquear usuário
            const newBlockData = await ChatModerationIntegration.blockUser(
                currentUser,
                spamCheck.violations.join(', '),
                messagesToDelete
            );
            
            if (!newBlockData) {
                console.error('Erro ao bloquear usuário');
                input.value = '';
                return;
            }
            
            // Deletar mensagens spam
            if (blockConfig?.deleteMessages && messagesToDelete.length > 0) {
                await this.deleteMessages(messagesToDelete);
            }
            
            // Mostrar mensagem de bloqueio
            if (blockConfig?.enabled && ChatModeration.config.ui?.showBlockMessages) {
                const formattedTime = ChatModeration.formatBlockTime(blockConfig.duration);
                
                this.showModerationMessage(
                    '🚫 Você foi bloqueado temporariamente',
                    `Motivo: ${newBlockData.reason}<br>Duração: ${formattedTime}${blockConfig.deleteMessages ? '<br><br>Suas últimas mensagens foram removidas.' : ''}`,
                    'error',
                    ChatModeration.config.warnings?.duration || 5000
                );
            }
            
            // Adicionar mensagem do sistema
            if (blockConfig?.systemMessage) {
                await this.addSystemMessage(
                    `⚠️ ${currentUser} foi temporariamente bloqueado por comportamento suspeito.`
                );
            }
            
            input.value = '';
            return;
        }
        
        const message = {
            id: Date.now(),
            author: currentUser,
            text: text,
            timestamp: new Date().toISOString(),
            type: 'user',
            reactions: {},
            replyTo: this.replyingTo ? {
                id: this.replyingTo.id,
                author: this.replyingTo.author,
                text: this.replyingTo.text.substring(0, 100)
            } : null
        };
        
        // Limpar estado de resposta
        if (this.replyingTo) {
            this.cancelReply();
        }
        
        // Adicionar ao histórico de moderação
        ChatModerationIntegration.addToHistory(currentUser, message);
        
        // Quando o próprio usuário envia, sempre deve rolar para baixo
        this.isUserScrolling = false;
        
        // ========== XP CONTROLADO PELO BACKEND ==========
        // 🔧 CORREÇÃO: NÃO mostrar XP aqui - deixar o backend controlar
        // O backend verifica limite diário e retorna xpGained no callback
        // Isso evita dessincronização entre frontend/backend
        
        // ========== ENVIAR MENSAGEM ==========
        const isWebSocketConnected = window.Socket && window.Socket.isConnected();
        
        if (isWebSocketConnected) {
            // WebSocket: enviar para broadcast em tempo real
            try {
                // Enviar objeto completo com replyTo se houver
                const messageData = {
                    text: text,
                    replyTo: message.replyTo || null
                };
                const response = await window.Socket.sendChatMessage(messageData);

                // XP: aceitar formatos variados do backend
                const xpEarned = this._extractXp(response);
                if (xpEarned > 0) {
                    await this._awardXP(currentUser, xpEarned, `msg-${response?.message?.id || message.id}`);
                }
            } catch (error) {
                console.warn('Erro WebSocket, usando fallback:', error);
                // Fallback: adicionar localmente e via API
                State.chatMessages.push(message);
                this.appendMessage(message, true);
                const result = await State.addChatMessage(message);
                const xpEarned = this._extractXp(result);
                if (xpEarned > 0) {
                    await this._awardXP(currentUser, xpEarned, `msg-${message.id}`);
                }
            }
        } else {
            // Sem WebSocket: adicionar localmente e via API REST
            State.chatMessages.push(message);
            this.appendMessage(message, true);
            try {
                const result = await State.addChatMessage(message);
                const xpEarned = this._extractXp(result);
                if (xpEarned > 0) {
                    await this._awardXP(currentUser, xpEarned, `msg-${message.id}`);
                }
            } catch (apiError) {
                console.error('Falha ao enviar mensagem:', apiError);
            }
        }
        
        input.value = '';
        
        // Scroll to bottom - garantir que vá para baixo após enviar
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            // Pequeno delay para garantir que a mensagem foi adicionada
            requestAnimationFrame(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });
        }
        
        // Atualizar membros online
        this.updateOnlineUsers();
        
        // Check for mentions and notify
        this.checkMentions(text);
        
        // Check achievements after sending message
        try {
            const { Achievements } = await import('./achievements/index.js');
            if (currentUser) {
                await Achievements.checkAchievements(currentUser, null, {
                    action: 'message-sent',
                    time: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('Erro ao verificar conquistas:', error);
        }
        
        // 🔧 NOTA: XP é creditado INSTANTÂNEAMENTE via awardXP (antes de persistir)
        // Backend persiste em background - sem espera para UX
    },
    
    checkMentions(text) {
        const currentUser = State.getUser();
        // Simple mention detection: @Name
        const mentionRegex = /@(\w+)/g;
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            const mentionedName = match[1].toLowerCase();
            // Notify if mentioned user is not the sender
            if (mentionedName !== currentUser?.toLowerCase()) {
                Notifications.notifyMention(currentUser);
            }
        }
    },
    
    async addSystemMessage(text) {
        const message = {
            id: Date.now(),
            author: null,
            text: text,
            timestamp: new Date().toISOString(),
            type: 'system'
        };
        
        await State.addChatMessage(message);
        this.appendMessage(message);
    },
    
    /**
     * Adiciona uma mensagem ao chat (para novas mensagens em tempo real)
     * 🆕 ROBUSTEZ: Verificação dupla para evitar duplicação
     */
    appendMessage(message, shouldScroll = true, isContinuation = false) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        // 🆕 Normalizar ID para comparação consistente
        const messageId = String(message.id);
        
        // Remover estado vazio se existir
        const emptyState = chatContainer.querySelector('.chat-empty-state');
        if (emptyState) {
            emptyState.remove();
        }
        
        // Verificar se a mensagem já existe no DOM
        const existingMsg = chatContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (existingMsg) {
            console.log(`[Chat] ⏭️ appendMessage: Mensagem ${messageId} já existe no DOM`);
            return;
        }
        
        // Usar createMessageElement para criar o elemento
        const div = this.createMessageElement(message, isContinuation);
        
        // Adicionar classe de animação para mensagens novas
        if (shouldScroll) {
            div.classList.add('new-message');
            div.addEventListener('animationend', () => {
                div.classList.remove('new-message');
            }, { once: true });
        }
        
        chatContainer.appendChild(div);
        
        // Scroll para baixo apenas se solicitado e não está rolando
        if (shouldScroll && !this.isUserScrolling) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        // Incrementar contador de não lidas se não for do usuário atual
        if (shouldScroll && message.author !== State.getUser() && !document.hasFocus()) {
            this.unreadCount++;
            this.updateUnreadBadge();
        }
        
        // Adicionar à lista de todas mensagens se não estiver
        // 🆕 Usar String para comparação consistente
        if (!this.allMessages.find(m => String(m.id) === messageId)) {
            this.allMessages.push(message);
            // Manter ordenado
            this.allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
    },
    
    formatMessageText(text) {
        return ChatRender.formatMessageText(text);
    },
    
    buildReactionsHtml(message) {
        return ChatRender.buildReactionsHtml(message, this.reactions);
    },
    
    toggleReactionPicker(messageId) {
        ChatReactions.toggleReactionPicker(messageId);
    },
    
    async addReaction(messageId, reaction) {
        await ChatReactions.addReaction(messageId, reaction, this.reactions, this.onlineUsers);
    },
    
    /**
     * 🆕 Receber reação de outro usuário via WebSocket
     */
    handleReactionUpdate(data) {
        ChatReactions.handleReactionUpdate(data, this.reactions);
    },
    
    async toggleReaction(messageId, reaction) {
        await ChatReactions.toggleReaction(messageId, reaction, this.reactions, this.onlineUsers);
    },
    
    updateMessageReactions(messageId, message) {
        ChatReactions.updateMessageReactions(messageId, message, this.reactions);
    },
    
    handleKeypress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.send();
        }
    },
    
    /**
     * 🔒 FUNÇÃO CRÍTICA: Normalizar nome de usuário
     * TODOS os nomes devem ser normalizados da mesma forma
     * para evitar duplicatas (Pedrão vs pedrão vs PEDRO vs PEDRAO)
     * Remove acentos e converte para lowercase
     */
    normalizeUsername(username) {
        return normalizeUsername(username);
    },
    
    // Atualiza lista de membros online com melhor UX
    // 🔒 FONTE ÚNICA DE VERDADE: Socket.currentOnlineUsers (dados do WebSocket)
    updateOnlineUsers() {
        ChatPresence.updateOnlineUsers((username) => this.mentionUser(username));
        this.updateOnlineCount();
    },
    
    /**
     * Retorna o status do usuário baseado na última atividade
     */
    getUserStatus(lastActivity) {
        return getUserStatus(lastActivity, this.ONLINE_THRESHOLD);
    },
    
    /**
     * Retorna texto do status
     */
    getStatusText(status) {
        return getStatusText(status);
    },
    
    /**
     * Formata tempo decorrido
     */
    formatTimeAgo(timestamp) {
        return formatTimeAgo(timestamp);
    },
    
    /**
     * Obtém iniciais do nome
     */
    getInitials(name) {
        return ChatAvatars.getInitials(name);
    },
    
    /**
     * Verifica se o membro tem foto de perfil
     */
    getMemberPhoto(name) {
        return ChatAvatars.getMemberPhoto(name);
    },
    
    /**
     * Gera HTML do avatar (foto ou iniciais)
     */
    getAvatarHtml(name, size = 'normal') {
        return ChatAvatars.getAvatarHtml(name, size);
    },
    
    /**
     * Gera cor consistente para avatar baseado no nome
     */
    getAvatarColor(name) {
        return ChatAvatars.getAvatarColor(name);
    },
    
    /**
     * Mencionar usuário no input
     */
    mentionUser(username) {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        const currentText = input.value;
        const mention = `@${username} `;
        
        // Adicionar menção na posição do cursor ou no final
        if (currentText && !currentText.endsWith(' ')) {
            input.value = currentText + ' ' + mention;
        } else {
            input.value = currentText + mention;
        }
        
        input.focus();
        
        // Feedback visual (usando toast verde)
        Utils.showToast(`Mencionando @${username}`, 'info', null, 1500);
    },

    /**
     * Normaliza resposta de XP do backend (xpGained, xp, xpAwarded)
     */
    _extractXp(response) {
        if (!response) return 0;
        const raw = response.xpGained ?? response.xp ?? (typeof response.xpAwarded === 'number'
            ? response.xpAwarded
            : response.xpAwarded?.amount);
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    },

    /**
     * Mostra XP ganho (sem persistir - backend já tratou)
     */
    async _awardXP(user, amount, trackingId) {
        if (!user || !amount || amount <= 0) return;
        try {
            const { Levels } = await import('./levels/index.js');
            await Levels.awardXP(user, 'message-sent', trackingId, {
                trackingType: 'messages',
                persistToBackend: false,
                showNotification: true
            });
        } catch (xpError) {
            console.warn('Erro ao mostrar XP:', xpError);
        }
    },
    
    /**
     * Atualiza contador de usuários online
     */
    updateOnlineCount() {
        ChatPresence.updateOnlineCount(this.onlineUsers);
        this.updateOnlineBar();
    },
    
    /**
     * Atualiza a barra de avatares online no topo do chat
     */
    updateOnlineBar() {
        ChatPresence.updateOnlineBar((username) => this.mentionUser(username));
    },
    
    // 🛡️ MÉTODOS DE MODERAÇÃO
    
    async deleteMessages(messageIds) {
        await ChatModerationIntegration.deleteMessages(messageIds, () => this.loadMessages());
    },
    
    showModerationMessage(title, message, type = 'info', duration = 3000) {
        ChatModerationIntegration.showModerationMessage(title, message, type, duration);
    },
    
    /**
     * Toggle do painel de membros (expandir/colapsar)
     */
    toggleMembersPanel() {
        const panel = document.getElementById('chatUsersPanel');
        if (panel) {
            panel.classList.toggle('collapsed');
            // Salvar preferência
            localStorage.setItem('cerebroMembersPanelCollapsed', panel.classList.contains('collapsed'));
        }
    },
    
    /**
     * Restaurar estado do painel de membros
     */
    restoreMembersPanelState() {
        const isCollapsed = localStorage.getItem('cerebroMembersPanelCollapsed') === 'true';
        const panel = document.getElementById('chatUsersPanel');
        if (panel && isCollapsed) {
            panel.classList.add('collapsed');
        }
    }
};

// CSS agora está em css/pages/chat.css - não precisa mais injetar dinamicamente

// Export Chat globally for socket access
window.Chat = Chat;

// Setup de listeners globais (reaction picker, mentions) - após Chat estar definido
ChatEvents.setupGlobalListeners((username) => Chat.mentionUser(username));

// Export functions for global access
window.sendMessage = async () => await Chat.send();
window.handleChatKeypress = (event) => Chat.handleKeypress(event);
