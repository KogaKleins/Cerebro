/**
 * CHAT MODULE
 * Handles chat functionality with reactions and search
 * Enhanced with professional features like typing indicators, read receipts, etc.
 */

import { State } from './state.js';
import { Utils } from './utils.js';
import { Notifications } from './notifications.js';
import { ChatModeration } from './chat-moderation.js';

export const Chat = {
    // Available reactions
    reactions: ['👍', '❤️', '😂', '😮', '😢', '☕', '🔥', '👀'],
    searchQuery: '',
    lastMessageId: null,
    isUserScrolling: false,
    scrollTimeout: null,
    typingTimeout: null,
    isTyping: false,
    unreadCount: 0,
    lastReadMessageId: null,
    onlineUsers: new Map(), // Map de username -> { lastSeen, isTyping, status }
    activityInterval: null,
    ONLINE_THRESHOLD: 5 * 60 * 1000, // 5 minutos para considerar online
    TYPING_TIMEOUT: 3000, // 3 segundos sem digitar = parou
    replyingTo: null, // Mensagem sendo respondida
    
    // Paginação de mensagens (estilo WhatsApp)
    PAGE_SIZE: 50, // Mensagens por página
    currentPage: 1,
    allMessages: [], // Todas as mensagens carregadas
    isLoadingMore: false,
    hasMoreMessages: true,
    
    // 🔧 CORREÇÃO: Timestamp da última sincronização bem-sucedida
    lastSyncTimestamp: 0,
    lastServerDataHash: null, // Hash para detectar mudanças no servidor
    syncInProgress: false,
    
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
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        // Handler com captura para garantir que pegue o evento
        chatContainer.addEventListener('click', (e) => {
            // Verificar se clicou em um botão de ação ou no ícone dentro dele
            const actionBtn = e.target.closest('.action-btn');
            if (!actionBtn) return;
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const action = actionBtn.dataset.action;
            const messageId = actionBtn.dataset.messageId;
            
            console.log('[Chat] Action clicked:', action, 'messageId:', messageId); // Debug
            
            if (!action || !messageId) {
                console.warn('[Chat] Missing action or messageId');
                return;
            }
            
            switch (action) {
                case 'replyToMessage':
                    console.log('[Chat] Calling replyToMessage');
                    this.replyToMessage(messageId);
                    break;
                case 'copyMessage':
                    console.log('[Chat] Calling copyMessage');
                    this.copyMessage(messageId);
                    break;
                case 'toggleReactionPicker':
                    console.log('[Chat] Calling toggleReactionPicker');
                    this.toggleReactionPicker(messageId);
                    break;
            }
        }, true); // true = capture phase para pegar antes de outros handlers
        
        // Também adicionar handler no document como fallback
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.message-actions .action-btn');
            if (!actionBtn) return;
            
            // Verificar se está dentro do chatMessages
            if (!actionBtn.closest('#chatMessages')) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = actionBtn.dataset.action;
            const messageId = actionBtn.dataset.messageId;
            
            if (!action || !messageId) return;
            
            switch (action) {
                case 'replyToMessage':
                    this.replyToMessage(messageId);
                    break;
                case 'copyMessage':
                    this.copyMessage(messageId);
                    break;
                case 'toggleReactionPicker':
                    this.toggleReactionPicker(messageId);
                    break;
            }
        });
        
        // Detectar scroll para cima para carregar mais mensagens
        chatContainer.addEventListener('scroll', () => {
            // Se chegou perto do topo, carregar mais mensagens
            if (chatContainer.scrollTop < 100 && this.hasMoreMessages && !this.isLoadingMore) {
                this.loadMoreMessages();
            }
        });
    },
    
    /**
     * Força scroll para o final com múltiplas tentativas
     * Resolve problema de scroll não funcionar na primeira abertura
     */
    forceScrollToBottom() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        // Reset flag de scroll manual
        this.isUserScrolling = false;
        
        const doScroll = () => {
            if (chatContainer && chatContainer.scrollHeight > 0) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        };
        
        // Múltiplas tentativas em diferentes momentos
        doScroll();
        requestAnimationFrame(doScroll);
        setTimeout(doScroll, 50);
        setTimeout(doScroll, 150);
        setTimeout(doScroll, 300);
        setTimeout(doScroll, 500);
        
        // Observer para quando imagens/conteúdo carregarem
        if (!this._scrollObserver) {
            this._scrollObserver = new MutationObserver(() => {
                if (!this.isUserScrolling) {
                    doScroll();
                }
            });
        }
        
        this._scrollObserver.observe(chatContainer, { 
            childList: true, 
            subtree: true,
            attributes: true 
        });
        
        // Parar de observar após 2 segundos
        setTimeout(() => {
            if (this._scrollObserver) {
                this._scrollObserver.disconnect();
            }
        }, 2000);
    },
    
    /**
     * Configura listener para navegação - garante scroll ao abrir chat
     */
    setupNavigationListener() {
        // Observar mudanças na classe 'active' da página do chat
        const chatPage = document.getElementById('chat');
        if (!chatPage) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (chatPage.classList.contains('active')) {
                        // Chat foi aberto - forçar scroll para o final
                        this.forceScrollToBottom();
                    }
                }
            });
        });
        
        observer.observe(chatPage, { attributes: true });
    },
    
    /**
     * 🔧 CORREÇÃO: Listener para visibilidade da aba
     * Força sincronização completa quando usuário volta à aba
     * Isso resolve o bug de mensagens antigas aparecendo no lugar das novas
     */
    setupVisibilityListener() {
        // Listener para quando a aba ganha/perde foco
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                console.log('[Chat] 🔄 Aba voltou ao foco - sincronizando...');
                
                // Pequeno delay para evitar race conditions
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 🆕 Forçar reconstrução completa da UI para evitar inconsistências
                await this.forceFullSync(true); // true = forçar rebuild do DOM
                
                // Marcar como lido
                this.markAllAsRead();
            }
        });
        
        // Listener para quando a janela ganha foco (complementar)
        window.addEventListener('focus', async () => {
            // Verificar se passou tempo suficiente desde última sync (5 segundos)
            const now = Date.now();
            if (now - this.lastSyncTimestamp > 5000) {
                console.log('[Chat] 🔄 Janela ganhou foco - verificando atualizações...');
                await this.forceFullSync(false);
            }
        });
        
        // 🆕 Listener adicional para quando navega entre páginas da aplicação
        // Garante sincronização quando volta para a aba de chat
        const chatPage = document.getElementById('chat');
        if (chatPage) {
            const pageObserver = new MutationObserver(async (mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (chatPage.classList.contains('active')) {
                            console.log('[Chat] 📱 Página de chat ativada - sincronizando...');
                            
                            // Delay menor pois é navegação interna
                            await new Promise(resolve => setTimeout(resolve, 50));
                            
                            // Verificar se dados estão desatualizados
                            const timeSinceSync = Date.now() - this.lastSyncTimestamp;
                            if (timeSinceSync > 3000) { // 3 segundos
                                await this.forceFullSync(true);
                            } else {
                                // Apenas verificar se há inconsistências no DOM
                                this.validateDOMConsistency();
                            }
                            
                            this.forceScrollToBottom();
                        }
                    }
                }
            });
            
            pageObserver.observe(chatPage, { attributes: true });
        }
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
        // Evitar sincronizações simultâneas
        if (this.syncInProgress) {
            console.log('[Chat] Sync já em progresso, ignorando...');
            return;
        }
        
        this.syncInProgress = true;
        
        try {
            // Buscar mensagens frescas do servidor
            await State.refreshChatMessages();
            const serverMessages = State.getChatMessages();
            
            if (!serverMessages || serverMessages.length === 0) {
                this.syncInProgress = false;
                return;
            }
            
            // Gerar hash para detectar se houve mudanças
            const newHash = this.generateMessagesHash(serverMessages);
            
            // 🆕 Detectar se houve mudanças significativas
            const hasChanges = newHash !== this.lastServerDataHash;
            const shouldRebuild = forceRebuild || hasChanges;
            
            // Se não mudou e não forçou rebuild, apenas atualizar timestamp
            if (!hasChanges && !forceRebuild) {
                console.log('[Chat] Nenhuma mudança detectada no servidor');
                this.lastSyncTimestamp = Date.now();
                this.syncInProgress = false;
                return;
            }
            
            console.log(`[Chat] 🔄 ${forceRebuild ? 'Rebuild forçado' : 'Mudanças detectadas'} - atualizando UI...`);
            
            // Atualizar hash
            this.lastServerDataHash = newHash;
            
            // 🔧 CRÍTICO: Atualizar allMessages com dados frescos do servidor
            this.allMessages = [...serverMessages].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            const chatContainer = document.getElementById('chatMessages');
            if (!chatContainer) {
                this.syncInProgress = false;
                return;
            }
            
            // 🆕 Se forçar rebuild, reconstruir todo o DOM
            if (forceRebuild) {
                console.log('[Chat] 🔨 Reconstruindo DOM completo...');
                
                // Salvar posição relativa do scroll
                const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
                
                // Limpar e reconstruir
                this.loadMessages();
                
                // Restaurar posição de scroll se necessário
                if (!wasAtBottom && !this.isUserScrolling) {
                    // Manter posição do scroll se não estava no final
                } else {
                    this.forceScrollToBottom();
                }
                
                this.lastSyncTimestamp = Date.now();
                this.syncInProgress = false;
                return;
            }
            
            // Modo incremental: apenas adicionar mensagens novas
            // Salvar posição do scroll
            const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
            
            // Verificar se há mensagens novas que não estão no DOM
            const domMessageIds = new Set(
                Array.from(chatContainer.querySelectorAll('[data-message-id]'))
                    .map(el => String(el.dataset.messageId))
            );
            
            const newMessages = this.allMessages.filter(m => !domMessageIds.has(String(m.id)));
            
            if (newMessages.length > 0) {
                console.log(`[Chat] ${newMessages.length} novas mensagens encontradas`);
                
                // 🆕 Se muitas mensagens novas, fazer rebuild completo
                if (newMessages.length > 10) {
                    console.log('[Chat] 🔨 Muitas mensagens novas - reconstruindo DOM...');
                    this.loadMessages();
                } else {
                    // Adicionar apenas as novas mensagens
                    newMessages.forEach(msg => {
                        this.appendMessage(msg, false);
                    });
                }
                
                // Se estava no final, rolar para baixo
                if (wasAtBottom && !this.isUserScrolling) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                } else if (newMessages.length > 0) {
                    // Mostrar indicador de novas mensagens
                    this.showNewMessagesButton();
                }
            }
            
            // Atualizar último ID
            if (this.allMessages.length > 0) {
                this.lastMessageId = this.allMessages[this.allMessages.length - 1].id;
            }
            
            this.lastSyncTimestamp = Date.now();
            
        } catch (error) {
            console.error('[Chat] Erro ao sincronizar:', error);
        } finally {
            this.syncInProgress = false;
        }
    },
    
    /**
     * Gera hash das mensagens para detectar mudanças
     */
    generateMessagesHash(messages) {
        if (!messages || messages.length === 0) return 'empty';
        
        // Usar os últimos 20 IDs e timestamps para gerar hash
        const recent = messages.slice(-20);
        const hashInput = recent.map(m => `${m.id}:${m.timestamp}`).join('|');
        
        // Hash simples
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            const char = hashInput.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return `h${hash}_c${messages.length}`;
    },

    /**
     * Configurar atalhos de teclado no input
     */
    setupInputShortcuts() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        input.addEventListener('keydown', (e) => {
            // Escape para cancelar resposta
            if (e.key === 'Escape' && this.replyingTo) {
                this.cancelReply();
            }
        });
    },
    
    /**
     * Responder a uma mensagem
     */
    replyToMessage(messageId) {
        console.log('[Chat] replyToMessage called with messageId:', messageId);
        
        const messages = State.getChatMessages();
        // Comparar como string para suportar UUIDs e números
        const message = messages.find(m => String(m.id) === String(messageId));
        
        if (!message) {
            console.warn('[Chat] Message not found for reply:', messageId);
            Utils.showToast('Mensagem não encontrada', 'error', null, 2000);
            return;
        }
        
        this.replyingTo = message;
        
        // Mostrar UI de resposta
        this.showReplyPreview(message);
        
        // Focar no input
        const input = document.getElementById('chatInput');
        if (input) {
            input.focus();
        }
        
        Utils.showToast(`Respondendo a ${message.author}`, 'info', null, 2000);
    },
    
    /**
     * Mostrar preview da mensagem sendo respondida
     */
    showReplyPreview(message) {
        let replyPreview = document.getElementById('replyPreview');
        const inputContainer = document.querySelector('.chat-input-container');
        
        if (!replyPreview && inputContainer) {
            replyPreview = document.createElement('div');
            replyPreview.id = 'replyPreview';
            replyPreview.className = 'reply-preview';
            inputContainer.parentNode.insertBefore(replyPreview, inputContainer);
        }
        
        if (replyPreview) {
            const truncatedText = message.text.length > 60 
                ? message.text.substring(0, 60) + '...' 
                : message.text;
            
            replyPreview.innerHTML = `
                <div class="reply-preview-content">
                    <div class="reply-preview-bar"></div>
                    <div class="reply-preview-info">
                        <span class="reply-preview-author">Respondendo a ${Utils.escapeHtml(message.author)}</span>
                        <span class="reply-preview-text">${Utils.escapeHtml(truncatedText)}</span>
                    </div>
                </div>
                <button class="reply-preview-close" onclick="Chat.cancelReply()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            replyPreview.classList.add('visible');
        }
    },
    
    /**
     * Cancelar resposta
     */
    cancelReply() {
        this.replyingTo = null;
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) {
            replyPreview.classList.remove('visible');
            setTimeout(() => replyPreview.remove(), 200);
        }
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
        const pickerBtn = document.getElementById('emojiPickerBtn');
        const picker = document.getElementById('emojiPicker');
        
        if (pickerBtn) {
            pickerBtn.addEventListener('click', () => this.toggleEmojiPicker());
        }
        
        if (picker) {
            // Handler para cliques nos emojis
            picker.addEventListener('click', (e) => {
                const emojiItem = e.target.closest('.emoji-item');
                if (emojiItem) {
                    const emoji = emojiItem.dataset.emoji;
                    this.insertEmoji(emoji);
                }
            });
        }
        
        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#emojiPicker') && !e.target.closest('#emojiPickerBtn')) {
                const picker = document.getElementById('emojiPicker');
                if (picker) picker.classList.remove('active');
            }
        });
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
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        const now = Date.now();
        const normalizedUser = this.normalizeUsername(currentUser);
        this.onlineUsers.set(normalizedUser, {
            lastSeen: now,
            isTyping: false,
            status: 'online',
            displayName: currentUser // Guardar nome original para exibição
        });
        
        // Salvar no localStorage para persistência
        localStorage.setItem('cerebroLastSeen', now.toString());
        localStorage.setItem('cerebroPresence', JSON.stringify({
            user: currentUser,
            lastSeen: now
        }));
    },
    
    /**
     * Detecta quando o usuário está digitando
     */
    setupTypingDetection() {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        input.addEventListener('input', () => {
            if (!this.isTyping) {
                this.isTyping = true;
                this.emitTypingStart();
            }
            
            // Resetar timeout
            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.isTyping = false;
                this.emitTypingStop();
            }, this.TYPING_TIMEOUT);
        });
        
        // Parar de digitar ao enviar
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                this.isTyping = false;
                this.emitTypingStop();
            }
        });
    },
    
    /**
     * Emite evento de início de digitação
     */
    emitTypingStart() {
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        // 🔒 CORREÇÃO: Usar nome normalizado como chave
        const normalizedUser = this.normalizeUsername(currentUser);
        
        // Atualizar estado local
        const userData = this.onlineUsers.get(normalizedUser) || { lastSeen: Date.now(), status: 'online' };
        userData.isTyping = true;
        this.onlineUsers.set(normalizedUser, userData);
        
        // Emitir via WebSocket se disponível
        if (window.Socket && window.Socket.isConnected()) {
            window.Socket.startTyping();
        }
        
        this.updateTypingIndicator();
    },
    
    /**
     * Emite evento de parada de digitação
     */
    emitTypingStop() {
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        // 🔒 CORREÇÃO: Usar nome normalizado como chave
        const normalizedUser = this.normalizeUsername(currentUser);
        
        const userData = this.onlineUsers.get(normalizedUser);
        if (userData) {
            userData.isTyping = false;
            this.onlineUsers.set(normalizedUser, userData);
        }
        
        if (window.Socket && window.Socket.isConnected()) {
            window.Socket.stopTyping();
        }
        
        this.updateTypingIndicator();
    },
    
    /**
     * Atualiza indicador de digitação na UI
     */
    updateTypingIndicator() {
        const currentUser = State.getUser();
        const typingUsers = [];
        
        this.onlineUsers.forEach((data, user) => {
            if (data.isTyping && user !== currentUser) {
                typingUsers.push(user);
            }
        });
        
        let indicator = document.getElementById('typingIndicator');
        const chatContainer = document.querySelector('.chat-input-container');
        
        if (typingUsers.length > 0) {
            if (!indicator && chatContainer) {
                indicator = document.createElement('div');
                indicator.id = 'typingIndicator';
                indicator.className = 'typing-indicator';
                chatContainer.parentNode.insertBefore(indicator, chatContainer);
            }
            
            if (indicator) {
                let text = '';
                if (typingUsers.length === 1) {
                    text = `${typingUsers[0]} está digitando`;
                } else if (typingUsers.length === 2) {
                    text = `${typingUsers[0]} e ${typingUsers[1]} estão digitando`;
                } else {
                    text = `${typingUsers.length} pessoas estão digitando`;
                }
                
                indicator.innerHTML = `
                    <div class="typing-dots">
                        <span></span><span></span><span></span>
                    </div>
                    <span class="typing-text">${text}</span>
                `;
                indicator.classList.add('visible');
            }
        } else if (indicator) {
            indicator.classList.remove('visible');
        }
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
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight temporário
            messageEl.classList.add('highlight-flash');
            setTimeout(() => {
                messageEl.classList.remove('highlight-flash');
            }, 2000);
        }
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
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        chatContainer.addEventListener('scroll', () => {
            // Detectar se está perto do final (dentro de 100px)
            const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
            
            // Se não está perto do final, usuário está rolando
            this.isUserScrolling = !isNearBottom;
            
            // Esconder botão de novas mensagens se chegou ao final
            if (isNearBottom) {
                this.hideNewMessagesButton();
            }
            
            // Limpar timeout anterior
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            
            // Após 3 segundos sem scroll, considerar que parou
            this.scrollTimeout = setTimeout(() => {
                // Só resetar se estiver perto do final
                if (isNearBottom) {
                    this.isUserScrolling = false;
                }
            }, 3000);
        });
    },
    
    /**
     * Mostra o botão de novas mensagens
     */
    showNewMessagesButton() {
        let btn = document.getElementById('newMessagesBtn');
        const chatContainer = document.querySelector('.chat-container');
        
        if (!btn && chatContainer) {
            btn = document.createElement('button');
            btn.id = 'newMessagesBtn';
            btn.className = 'new-messages-btn';
            btn.innerHTML = '<i class="fas fa-arrow-down"></i> Novas mensagens';
            btn.addEventListener('click', () => {
                this.scrollToBottom();
                this.hideNewMessagesButton();
            });
            chatContainer.appendChild(btn);
        }
        
        if (btn) {
            btn.classList.add('visible');
        }
    },
    
    /**
     * Esconde o botão de novas mensagens
     */
    hideNewMessagesButton() {
        const btn = document.getElementById('newMessagesBtn');
        if (btn) {
            btn.classList.remove('visible');
        }
    },
    
    /**
     * Rola suavemente para o final do chat
     */
    scrollToBottom(instant = false) {
        const chatContainer = document.getElementById('chatMessages');
        if (chatContainer) {
            this.isUserScrolling = false;
            
            if (instant) {
                // Scroll instantâneo (mais confiável)
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else {
                // Scroll suave
                chatContainer.scrollTo({
                    top: chatContainer.scrollHeight,
                    behavior: 'smooth'
                });
            }
            
            // Garantir que chegou ao final
            requestAnimationFrame(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });
        }
    },
    
    setupSearch() {
        const searchInput = document.getElementById('chatSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.filterMessages();
            });
        }
    },
    
    filterMessages() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        const messages = chatContainer.querySelectorAll('.message');
        
        messages.forEach(msg => {
            if (!this.searchQuery) {
                msg.style.display = '';
                msg.classList.remove('search-highlight');
                return;
            }
            
            const text = msg.textContent.toLowerCase();
            if (text.includes(this.searchQuery)) {
                msg.style.display = '';
                msg.classList.add('search-highlight');
            } else {
                msg.style.display = 'none';
                msg.classList.remove('search-highlight');
            }
        });
        
        // Show/hide no results message
        const visibleMessages = chatContainer.querySelectorAll('.message:not([style*="display: none"])');
        let noResultsEl = chatContainer.querySelector('.no-search-results');
        
        if (visibleMessages.length === 0 && this.searchQuery) {
            if (!noResultsEl) {
                noResultsEl = document.createElement('div');
                noResultsEl.className = 'no-search-results';
                noResultsEl.innerHTML = '<i class="fas fa-search"></i><p>Nenhuma mensagem encontrada</p>';
                chatContainer.appendChild(noResultsEl);
            }
        } else if (noResultsEl) {
            noResultsEl.remove();
        }
    },
    
    clearSearch() {
        const searchInput = document.getElementById('chatSearch');
        if (searchInput) {
            searchInput.value = '';
            this.searchQuery = '';
            this.filterMessages();
        }
    },
    
    /**
     * Carrega mensagens com paginação (estilo WhatsApp)
     * Carrega apenas as últimas PAGE_SIZE mensagens inicialmente
     */
    loadMessages() {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        const messages = State.getChatMessages();
        
        // Limpar container primeiro
        chatContainer.innerHTML = '';
        
        // Reset paginação
        this.currentPage = 1;
        this.hasMoreMessages = true;
        
        // 🔧 CORREÇÃO: Resetar hash para permitir nova verificação
        this.lastServerDataHash = null;
        this.lastSyncTimestamp = Date.now();
        
        // Se não há mensagens, mostrar mensagem de boas-vindas
        if (!messages || messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="chat-empty-state">
                    <div class="empty-icon">💬</div>
                    <p>Inicie uma conversa!</p>
                    <span>Seja o primeiro a enviar uma mensagem para a equipe</span>
                </div>
            `;
            this.hasMoreMessages = false;
            this.allMessages = [];
            return;
        }
        
        // Ordenar mensagens por timestamp (mais antigas primeiro)
        this.allMessages = [...messages].sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Gerar hash inicial
        this.lastServerDataHash = this.generateMessagesHash(this.allMessages);
        
        // Pegar apenas as últimas PAGE_SIZE mensagens
        const totalMessages = this.allMessages.length;
        const startIndex = Math.max(0, totalMessages - this.PAGE_SIZE);
        const messagesToRender = this.allMessages.slice(startIndex);
        
        // Se há mais mensagens antigas, mostrar indicador
        this.hasMoreMessages = startIndex > 0;
        
        if (this.hasMoreMessages) {
            this.addLoadMoreIndicator(chatContainer);
        }
        
        // Renderizar mensagens
        this.renderMessages(messagesToRender, chatContainer, false);
        
        // Guardar o ID da última mensagem
        if (this.allMessages.length > 0) {
            this.lastMessageId = this.allMessages[this.allMessages.length - 1].id;
        }
        
        // Scroll para o final (última mensagem visível) - abordagem robusta
        this.forceScrollToBottom();
        
        // Atualizar membros online
        this.updateOnlineUsers();
        
        // Marcar como lidas se a janela está focada
        if (document.hasFocus()) {
            this.markAllAsRead();
        }
    },
    
    /**
     * Renderiza um conjunto de mensagens no container
     */
    renderMessages(messages, container, prepend = false) {
        let lastDate = null;
        const fragment = document.createDocumentFragment();
        
        // Se for prepend, precisamos pegar a data da primeira mensagem já renderizada
        if (prepend) {
            const firstExisting = container.querySelector('.message[data-message-id]');
            if (firstExisting) {
                const existingMsgs = this.allMessages.filter(m => 
                    container.querySelector(`[data-message-id="${m.id}"]`)
                );
                if (existingMsgs.length > 0) {
                    // Encontrar a data do primeiro existente para comparar
                }
            }
        }
        
        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.timestamp);
            const dateStr = this.formatDateSeparator(msgDate);
            
            // Adicionar separador de data se mudou o dia
            if (dateStr !== lastDate) {
                const separator = document.createElement('div');
                separator.className = 'date-separator';
                separator.innerHTML = `<span>${dateStr}</span>`;
                fragment.appendChild(separator);
                lastDate = dateStr;
            }
            
            // Verificar se é continuação da mensagem anterior
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isContinuation = prevMsg && 
                prevMsg.author === msg.author &&
                prevMsg.type === msg.type &&
                (new Date(msg.timestamp) - new Date(prevMsg.timestamp)) < 120000;
            
            const msgEl = this.createMessageElement(msg, isContinuation);
            fragment.appendChild(msgEl);
        });
        
        if (prepend) {
            // Remover indicador de "carregar mais" antigo
            const oldIndicator = container.querySelector('.load-more-indicator');
            if (oldIndicator) oldIndicator.remove();
            
            // Guardar altura atual para manter posição do scroll
            const scrollHeightBefore = container.scrollHeight;
            
            // Inserir no início
            container.insertBefore(fragment, container.firstChild);
            
            // Manter posição do scroll (ajustar pela altura adicionada)
            const scrollHeightAfter = container.scrollHeight;
            container.scrollTop = scrollHeightAfter - scrollHeightBefore;
            
            // Adicionar novo indicador se ainda há mais
            if (this.hasMoreMessages) {
                this.addLoadMoreIndicator(container);
            }
        } else {
            container.appendChild(fragment);
        }
    },
    
    /**
     * Cria elemento de mensagem (extraído de appendMessage para reutilização)
     */
    createMessageElement(message, isContinuation = false) {
        const div = document.createElement('div');
        div.dataset.messageId = message.id;
        
        const continuationClass = isContinuation ? ' continuation' : '';
        
        if (message.type === 'system') {
            div.className = `message system`;
            div.innerHTML = `
                <div class="system-message-content">
                    <i class="fas fa-info-circle"></i>
                    <p>${Utils.escapeHtml(message.text || '')}</p>
                </div>
            `;
        } else {
            const currentUser = State.getUser();
            const isSent = currentUser && message.author && 
                this.normalizeUsername(message.author) === this.normalizeUsername(currentUser);
            div.className = `message ${isSent ? 'sent' : 'received'}${continuationClass}`;
            
            const reactionsHtml = this.buildReactionsHtml(message);
            const avatarHtml = (!isSent && !isContinuation) ? this.getAvatarHtml(message.author) : '';
            const authorHtml = (!isSent && !isContinuation) 
                ? `<div class="message-author">${Utils.escapeHtml(message.author || 'Anônimo')}</div>` 
                : '';
            
            let replyHtml = '';
            if (message.replyTo) {
                const replyText = message.replyTo.text.length > 50 
                    ? message.replyTo.text.substring(0, 50) + '...' 
                    : message.replyTo.text;
                replyHtml = `
                    <div class="message-reply-preview" data-reply-id="${message.replyTo.id}">
                        <div class="reply-bar"></div>
                        <div class="reply-content">
                            <span class="reply-author">${Utils.escapeHtml(message.replyTo.author)}</span>
                            <span class="reply-text">${Utils.escapeHtml(replyText)}</span>
                        </div>
                    </div>
                `;
            }
            
            const readStatus = isSent ? `
                <span class="read-status" title="Enviada">
                    <i class="fas fa-check"></i>
                </span>
            ` : '';
            
            const actionsHtml = `
                <div class="message-actions">
                    <button class="action-btn" data-action="replyToMessage" data-message-id="${message.id}" title="Responder">
                        <i class="fas fa-reply"></i>
                    </button>
                    <button class="action-btn" data-action="copyMessage" data-message-id="${message.id}" title="Copiar">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="action-btn" data-action="toggleReactionPicker" data-message-id="${message.id}" title="Reagir">
                        <i class="far fa-smile"></i>
                    </button>
                </div>
            `;
            
            div.innerHTML = `
                ${avatarHtml}
                <div class="message-bubble">
                    ${actionsHtml}
                    <div class="message-content">
                        ${authorHtml}
                        ${replyHtml}
                        <div class="message-text">${this.formatMessageText(message.text || '')}</div>
                        <div class="message-footer">
                            <span class="message-time">${Utils.formatTime(message.timestamp)}</span>
                            ${readStatus}
                        </div>
                        ${reactionsHtml}
                    </div>
                </div>
                <div class="reaction-picker" id="reactionPicker-${message.id}">
                    ${this.reactions.map(r => `
                        <span class="reaction-option" data-action="addReaction" data-message-id="${message.id}" data-reaction="${r}">${r}</span>
                    `).join('')}
                </div>
            `;
            
            // Handler para reply preview
            const replyPreviewEl = div.querySelector('.message-reply-preview');
            if (replyPreviewEl) {
                replyPreviewEl.addEventListener('click', () => {
                    this.scrollToMessage(replyPreviewEl.dataset.replyId);
                });
            }
        }
        
        return div;
    },
    
    /**
     * Adiciona indicador de "carregar mais" no topo
     */
    addLoadMoreIndicator(container) {
        const existingIndicator = container.querySelector('.load-more-indicator');
        if (existingIndicator) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'load-more-indicator';
        indicator.innerHTML = `
            <div class="load-more-content">
                <i class="fas fa-arrow-up"></i>
                <span>Role para cima para ver mensagens anteriores</span>
            </div>
        `;
        container.insertBefore(indicator, container.firstChild);
    },
    
    /**
     * Carrega mais mensagens antigas quando rola para cima
     */
    async loadMoreMessages() {
        if (this.isLoadingMore || !this.hasMoreMessages) return;
        
        this.isLoadingMore = true;
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) {
            this.isLoadingMore = false;
            return;
        }
        
        // Mostrar loading
        const indicator = chatContainer.querySelector('.load-more-indicator');
        if (indicator) {
            indicator.innerHTML = `
                <div class="load-more-content loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Carregando mensagens...</span>
                </div>
            `;
        }
        
        // Pequeno delay para UX
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Calcular próximo lote de mensagens
        const currentRenderedCount = chatContainer.querySelectorAll('.message[data-message-id]').length;
        const totalMessages = this.allMessages.length;
        const alreadyLoaded = totalMessages - (totalMessages - currentRenderedCount);
        
        // Encontrar o índice de início do lote atual
        const currentStartIndex = totalMessages - currentRenderedCount;
        const newStartIndex = Math.max(0, currentStartIndex - this.PAGE_SIZE);
        const newMessages = this.allMessages.slice(newStartIndex, currentStartIndex);
        
        if (newMessages.length === 0) {
            this.hasMoreMessages = false;
            if (indicator) indicator.remove();
            this.isLoadingMore = false;
            return;
        }
        
        // Verificar se ainda há mais
        this.hasMoreMessages = newStartIndex > 0;
        
        // Renderizar novas mensagens no topo
        this.renderMessages(newMessages, chatContainer, true);
        
        this.isLoadingMore = false;
    },
    
    /**
     * Formata data para separador
     */
    formatDateSeparator(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        if (msgDay.getTime() === today.getTime()) {
            return 'Hoje';
        } else if (msgDay.getTime() === yesterday.getTime()) {
            return 'Ontem';
        } else {
            return date.toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
            });
        }
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
        // Evitar sync se já há um em progresso
        if (this.syncInProgress) return;
        
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        try {
            // Buscar mensagens atualizadas do servidor
            await State.refreshChatMessages();
            const messages = State.getChatMessages();
            
            if (!messages || messages.length === 0) return;
            
            // Ordenar mensagens por timestamp
            const sortedMessages = [...messages].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            // 🔧 CRÍTICO: Atualizar allMessages para manter consistência
            this.allMessages = sortedMessages;
            
            // Gerar hash para detectar mudanças
            const newHash = this.generateMessagesHash(sortedMessages);
            
            // Se não mudou, não precisa atualizar UI
            if (newHash === this.lastServerDataHash) {
                return;
            }
            
            // Atualizar hash
            this.lastServerDataHash = newHash;
            this.lastSyncTimestamp = Date.now();
            
            // Encontrar mensagens que ainda não estão no DOM
            const existingIds = new Set(
                Array.from(chatContainer.querySelectorAll('[data-message-id]'))
                    .map(el => String(el.dataset.messageId))
            );
            
            const newMessages = sortedMessages.filter(msg => !existingIds.has(String(msg.id)));
            
            // Se não há novas mensagens no DOM, verificar se há mensagens faltando
            if (newMessages.length === 0) {
                // Verificar se alguma mensagem sumiu do DOM (bug do cache)
                const domCount = chatContainer.querySelectorAll('[data-message-id]').length;
                const expectedCount = Math.min(this.PAGE_SIZE, sortedMessages.length);
                
                // Se há menos mensagens no DOM do que esperado, pode haver problema de cache
                if (domCount < expectedCount * 0.8) {
                    console.log('[Chat] ⚠️ Detectada possível dessincronização - recarregando...');
                    this.loadMessages();
                }
                return;
            }
            
            console.log(`[Chat] 📨 Adicionando ${newMessages.length} novas mensagens`);
            
            // Verificar se está perto do final antes de adicionar
            const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
            
            // Adicionar apenas as novas mensagens
            newMessages.forEach(msg => {
                this.appendMessage(msg, false);
            });
            
            // Atualizar último ID
            if (sortedMessages.length > 0) {
                this.lastMessageId = sortedMessages[sortedMessages.length - 1].id;
            }
            
            // Scroll para baixo apenas se estava no final e não está rolando
            if (wasAtBottom && !this.isUserScrolling) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else if (this.isUserScrolling && newMessages.length > 0) {
                // Mostrar botão de novas mensagens se o usuário está rolando
                this.showNewMessagesButton();
            }
            
            // Atualizar membros online
            this.updateOnlineUsers();
        } catch (error) {
            console.warn('Erro ao sincronizar mensagens:', error);
        }
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
        // Primeiro verificação local rápida
        let blockData = ChatModeration.isUserBlocked(currentUser);
        
        // Se tiver ban local OU se faz tempo que não verificou no servidor, fazer verificação robusta
        if (blockData || (Date.now() - ChatModeration.lastBanCheckTimestamp) > ChatModeration.BAN_CHECK_INTERVAL_MS) {
            blockData = await ChatModeration.isUserBlockedAsync(currentUser);
        }
        
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
        const spamCheck = ChatModeration.checkSpam(currentUser, text);
        
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
            
            // 🔧 CORREÇÃO: Bloquear usuário (agora async para salvar no banco)
            const newBlockData = await ChatModeration.blockUser(
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
        ChatModeration.addToHistory(currentUser, message);
        
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
                
                // 🔧 MOSTRAR XP APENAS SE BACKEND CONFIRMAR
                // Backend verifica limite diário e retorna xpGained > 0 se XP foi creditado
                if (response && response.xpGained > 0) {
                    try {
                        const { Levels } = await import('./levels/index.js');
                        // Atualizar UI local sem persistir (backend já persistiu)
                        await Levels.awardXP(currentUser, 'message-sent', `msg-${response.message?.id || message.id}`, {
                            trackingType: 'messages',
                            persistToBackend: false, // Backend já creditou
                            showNotification: true
                        });
                    } catch (xpError) {
                        console.warn('Erro ao mostrar XP:', xpError);
                    }
                }
            } catch (error) {
                console.warn('Erro WebSocket, usando fallback:', error);
                // Fallback: adicionar localmente e via API
                State.chatMessages.push(message);
                this.appendMessage(message, true);
                await State.addChatMessage(message);
            }
        } else {
            // Sem WebSocket: adicionar localmente e via API REST
            State.chatMessages.push(message);
            this.appendMessage(message, true);
            try {
                await State.addChatMessage(message);
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
        // Garantir que text seja uma string
        if (!text) return '';
        
        // Escape HTML first
        let formatted = Utils.escapeHtml(text);
        
        // Format bold: *texto* ou **texto**
        formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.+?)\*/g, '<strong>$1</strong>');
        
        // Format italic: _texto_
        formatted = formatted.replace(/_(.+?)_/g, '<em>$1</em>');
        
        // Format strikethrough: ~texto~
        formatted = formatted.replace(/~(.+?)~/g, '<del>$1</del>');
        
        // Format code: `código`
        formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
        
        // Format mentions with better styling
        formatted = formatted.replace(/@(\w+)/g, '<span class="mention" data-mention="$1">@$1</span>');
        
        // Format URLs with smart preview
        formatted = formatted.replace(
            /(https?:\/\/[^\s]+)/g, 
            (url) => {
                // Detectar tipo de link
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url);
                const isYoutube = /youtube\.com|youtu\.be/i.test(url);
                
                if (isImage) {
                    return `<a href="${url}" target="_blank" rel="noopener" class="image-link">
                        <img src="${url}" alt="Imagem" class="message-image" loading="lazy" onerror="this.parentElement.innerHTML='${url}'">
                    </a>`;
                } else if (isYoutube) {
                    return `<a href="${url}" target="_blank" rel="noopener" class="youtube-link">
                        <i class="fab fa-youtube"></i> ${url.length > 40 ? url.substring(0, 40) + '...' : url}
                    </a>`;
                }
                
                // Link normal com ícone
                const displayUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
                return `<a href="${url}" target="_blank" rel="noopener" class="external-link">
                    <i class="fas fa-external-link-alt"></i> ${displayUrl}
                </a>`;
            }
        );
        
        // Emojis comuns - converter atalhos
        const emojiMap = {
            ':)': '😊', ':D': '😄', ':(': '😢', ':P': '😛',
            ':O': '😮', '<3': '❤️', ':fire:': '🔥', ':coffee:': '☕',
            ':+1:': '👍', ':-1:': '👎', ':ok:': '👌', ':clap:': '👏'
        };
        
        Object.entries(emojiMap).forEach(([shortcut, emoji]) => {
            formatted = formatted.replace(new RegExp(shortcut.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), emoji);
        });
        
        return formatted;
    },
    
    buildReactionsHtml(message) {
        if (!message.reactions || Object.keys(message.reactions).length === 0) {
            return '<div class="message-reactions"></div>';
        }
        
        const reactionCounts = {};
        for (const [user, reaction] of Object.entries(message.reactions)) {
            if (!reactionCounts[reaction]) {
                reactionCounts[reaction] = { count: 0, users: [], normalizedUsers: [] };
            }
            reactionCounts[reaction].count++;
            reactionCounts[reaction].users.push(user);
            // Guardar versão normalizada para comparação
            reactionCounts[reaction].normalizedUsers.push(this.normalizeUsername(user));
        }
        
        const html = Object.entries(reactionCounts).map(([reaction, data]) => {
            const currentUser = State.getUser();
            // 🔧 CORREÇÃO: Usar comparação normalizada para verificar se já reagiu
            const normalizedCurrentUser = this.normalizeUsername(currentUser);
            const hasReacted = data.normalizedUsers.includes(normalizedCurrentUser);
            return `
                <span class="reaction-badge ${hasReacted ? 'reacted' : ''}" 
                      data-action="toggleReaction" 
                      data-message-id="${message.id}" 
                      data-reaction="${reaction}"
                      title="${data.users.join(', ')}">
                    ${reaction} ${data.count}
                </span>
            `;
        }).join('');
        
        return `<div class="message-reactions">${html}</div>`;
    },
    
    toggleReactionPicker(messageId) {
        const picker = document.getElementById(`reactionPicker-${messageId}`);
        if (picker) {
            // Close all other pickers first
            document.querySelectorAll('.reaction-picker.active').forEach(p => {
                if (p.id !== `reactionPicker-${messageId}`) {
                    p.classList.remove('active');
                }
            });
            picker.classList.toggle('active');
        }
    },
    
    async addReaction(messageId, reaction) {
        const user = State.getUser();
        if (!user) return;
        
        // Update local state
        const messages = State.getChatMessages();
        const message = messages.find(m => m.id == messageId);
        
        if (message) {
            if (!message.reactions) message.reactions = {};
            
            // 🔧 CORREÇÃO: Encontrar chave existente (pode ter case diferente)
            // Busca por nome normalizado para encontrar reação do mesmo usuário
            const normalizedUser = this.normalizeUsername(user);
            let existingKey = null;
            let existingReaction = null;
            
            for (const [key, value] of Object.entries(message.reactions)) {
                if (this.normalizeUsername(key) === normalizedUser) {
                    existingKey = key;
                    existingReaction = value;
                    break;
                }
            }
            
            // Verificar se está adicionando uma NOVA reação (não tinha antes)
            const hadReactionBefore = existingReaction === reaction;
            const isRemoving = hadReactionBefore;
            
            // Toggle reaction localmente (otimistic update)
            if (hadReactionBefore) {
                if (existingKey) {
                    delete message.reactions[existingKey];
                }
            } else {
                if (existingKey && existingKey !== user) {
                    delete message.reactions[existingKey];
                }
                message.reactions[user] = reaction;
            }
            
            // Update UI imediatamente (optimistic)
            this.updateMessageReactions(messageId, message);
            
            // Save to state
            await State.updateChatMessage(messageId, message);
            
            // ========== PERSISTIR E MOSTRAR XP APENAS SE BACKEND CONFIRMAR ==========
            const isWebSocketConnected = window.Socket && window.Socket.isConnected();
            
            if (isWebSocketConnected && !isRemoving) {
                try {
                    // WebSocket para sincronização em tempo real
                    const response = await window.Socket.sendReaction(messageId, reaction);
                    
                    // 🔧 MOSTRAR XP APENAS SE BACKEND CONFIRMAR
                    if (response && response.xpAwarded) {
                        try {
                            const { Levels } = await import('./levels/index.js');
                            // XP para quem reagiu - notificação após backend confirmar
                            await Levels.awardXP(user, 'reaction-given', `reaction-given-${messageId}-${user}`, {
                                trackingType: 'reactions',
                                persistToBackend: false, // Backend já creditou
                                showNotification: true
                            });
                        } catch (xpError) {
                            console.warn('Erro ao mostrar XP por reação:', xpError);
                        }
                    }
                } catch (wsError) {
                    console.warn('WebSocket reaction failed, using API fallback:', wsError);
                    this.persistReactionViaAPI(messageId, reaction, message, isRemoving);
                }
            } else {
                // API REST (não bloqueia, roda em background)
                this.persistReactionViaAPI(messageId, reaction, message, isRemoving);
            }
        }
        
        // Close picker
        const picker = document.getElementById(`reactionPicker-${messageId}`);
        if (picker) picker.classList.remove('active');
    },
    
    /**
     * Persistir reação via API REST (roda em background)
     */
    async persistReactionViaAPI(messageId, reaction, message, isRemoving) {
        try {
            const { Api } = await import('./api.js');
            
            if (isRemoving) {
                await Api.removeReaction(messageId, reaction);
            } else {
                await Api.addReaction(messageId, reaction, message.author);
            }
        } catch (apiError) {
            console.warn('Erro ao persistir reação no banco:', apiError);
            // XP já foi dado localmente - será sincronizado depois
        }
    },
    
    /**
     * 🆕 Receber reação de outro usuário via WebSocket
     */
    handleReactionUpdate(data) {
        const { messageId, reactions, user, emoji, action } = data;
        const currentUser = State.getUser();
        
        // Ignorar se foi eu que enviei (já atualizei localmente)
        if (this.normalizeUsername(user) === this.normalizeUsername(currentUser)) {
            return;
        }
        
        // Atualizar state local
        const messages = State.getChatMessages();
        const message = messages.find(m => m.id == messageId);
        
        if (message) {
            // Atualizar reações com dados do servidor
            message.reactions = reactions;
            State.updateChatMessage(messageId, message);
            
            // Atualizar UI
            this.updateMessageReactions(messageId, message);
            
            // Notificar se alguém reagiu à minha mensagem (usar toast verde)
            if (message.author === currentUser && action === 'add') {
                Utils.showToast(`${user} reagiu com ${emoji} à sua mensagem`, 'info', null, 3000);
            }
        }
    },
    
    async toggleReaction(messageId, reaction) {
        await this.addReaction(messageId, reaction);
    },
    
    updateMessageReactions(messageId, message) {
        const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!msgEl) return;
        
        const reactionsContainer = msgEl.querySelector('.message-reactions');
        if (reactionsContainer) {
            reactionsContainer.outerHTML = this.buildReactionsHtml(message);
        }
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
        if (!username || typeof username !== 'string') return '';
        // Normalize NFD (decompose), remove diacritics, lowercase, trim
        return username
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Remove diacritical marks
    },
    
    // Atualiza lista de membros online com melhor UX
    // 🔒 FONTE ÚNICA DE VERDADE: Socket.currentOnlineUsers (dados do WebSocket)
    updateOnlineUsers() {
        const onlineContainer = document.getElementById('onlineUsers');
        if (!onlineContainer) return;
        
        const currentUser = State.getUser();
        const now = Date.now();
        
        // 🔒 FONTE ÚNICA DE VERDADE: Lista de usuários online do WebSocket
        // Isso garante consistência com a Home Page
        const wsOnlineUsers = (window.Socket && window.Socket.currentOnlineUsers) || [];
        const wsOnlineNormalized = new Set(wsOnlineUsers.map(u => this.normalizeUsername(u)));
        
        // Lista de membros conhecidos do sistema (para garantir que apareçam)
        const knownMembers = ['Atila', 'Chris', 'Marcus', 'Renan', 'Pedrão', 'Wilmar'];
        
        // 🔒 USAR MAP COM NOMES NORMALIZADOS para garantir unicidade
        const userActivity = new Map();
        
        // Adicionar membros conhecidos com status baseado no WebSocket
        knownMembers.forEach(member => {
            const normalizedName = this.normalizeUsername(member);
            const isOnlineFromWS = wsOnlineNormalized.has(normalizedName);
            
            userActivity.set(normalizedName, {
                displayName: member,
                lastActivity: isOnlineFromWS ? now : 0,
                status: isOnlineFromWS ? 'online' : 'offline',
                isTyping: false
            });
        });
        
        // Adicionar usuários do WebSocket que não estão na lista de conhecidos
        wsOnlineUsers.forEach(userName => {
            const normalizedName = this.normalizeUsername(userName);
            if (!userActivity.has(normalizedName)) {
                userActivity.set(normalizedName, {
                    displayName: userName,
                    lastActivity: now,
                    status: 'online',
                    isTyping: false
                });
            }
        });
        
        // Garantir usuário atual na lista
        if (currentUser) {
            const normalizedCurrentUser = this.normalizeUsername(currentUser);
            if (!userActivity.has(normalizedCurrentUser)) {
                userActivity.set(normalizedCurrentUser, {
                    displayName: currentUser,
                    lastActivity: now,
                    status: 'online',
                    isTyping: false
                });
            } else {
                // Usuário atual sempre está online se está logado
                const existing = userActivity.get(normalizedCurrentUser);
                existing.lastActivity = now;
                existing.status = 'online';
            }
        }
        
        // 🔒 Sincronizar this.onlineUsers com os dados processados
        // Preservar estados de typing que podem ter vindo de eventos anteriores
        userActivity.forEach((data, normalizedName) => {
            const existingData = this.onlineUsers.get(normalizedName);
            this.onlineUsers.set(normalizedName, {
                lastSeen: data.lastActivity,
                status: data.status,
                isTyping: existingData?.isTyping || false,
                displayName: data.displayName
            });
        });
        
        // Remover usuários que não estão mais na lista
        Array.from(this.onlineUsers.keys()).forEach(key => {
            if (!userActivity.has(key)) {
                this.onlineUsers.delete(key);
            }
        });
        
        // Ordenar: online primeiro, depois usuário atual, depois por nome
        const sortedUsers = Array.from(this.onlineUsers.entries())
            .sort((a, b) => {
                const normalizedCurrent = this.normalizeUsername(currentUser);
                
                // Usuário atual sempre primeiro
                if (a[0] === normalizedCurrent) return -1;
                if (b[0] === normalizedCurrent) return 1;
                
                // Depois, ordenar por status (online > away > offline)
                const statusOrder = { online: 0, away: 1, offline: 2 };
                const statusDiff = (statusOrder[a[1].status] || 2) - (statusOrder[b[1].status] || 2);
                if (statusDiff !== 0) return statusDiff;
                
                // Por fim, por nome
                return a[1].displayName.localeCompare(b[1].displayName);
            });
        
        // Limpar container
        onlineContainer.innerHTML = '';
        
        // Criar cards de usuários
        sortedUsers.forEach(([normalizedUsername, userData]) => {
            const isCurrentUser = normalizedUsername === this.normalizeUsername(currentUser);
            const isOnline = userData.status === 'online';
            const isAway = userData.status === 'away';
            
            const card = document.createElement('div');
            card.className = `user-card ${isOnline ? 'online' : ''} ${isAway ? 'away' : ''} ${isCurrentUser ? 'current-user' : ''}`;
            card.dataset.username = normalizedUsername;
            
            // Avatar com foto ou iniciais
            const photo = this.getMemberPhoto(userData.displayName);
            const initials = this.getInitials(userData.displayName);
            const avatarColor = this.getAvatarColor(userData.displayName);
            
            let avatarInnerHtml = '';
            if (photo) {
                avatarInnerHtml = `<img src="${photo}" alt="${Utils.escapeHtml(userData.displayName)}" class="user-avatar-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <span class="user-avatar-fallback" style="display:none; background: ${avatarColor}">${initials}</span>`;
            } else {
                avatarInnerHtml = `<span class="user-avatar-initials">${initials}</span>`;
            }
            
            card.innerHTML = `
                <div class="user-avatar ${photo ? 'has-photo' : ''}" style="${!photo ? 'background:' + avatarColor : ''}">
                    ${avatarInnerHtml}
                    <span class="status-dot ${userData.status}"></span>
                </div>
                <div class="user-info">
                    <span class="user-name">${isCurrentUser ? 'Você' : Utils.escapeHtml(userData.displayName)}</span>
                    <span class="user-status-text">${this.getStatusText(userData.status)}</span>
                </div>
            `;
            
            // Click para mencionar usuário
            if (!isCurrentUser) {
                card.addEventListener('click', () => this.mentionUser(userData.displayName));
                card.style.cursor = 'pointer';
                card.title = `Clique para mencionar @${userData.displayName}`;
            }
            
            onlineContainer.appendChild(card);
        });
        
        // Atualizar contador no cabeçalho
        this.updateOnlineCount();
    },
    
    /**
     * Retorna o status do usuário baseado na última atividade
     */
    getUserStatus(lastActivity) {
        const now = Date.now();
        const diff = now - lastActivity;
        
        if (diff < this.ONLINE_THRESHOLD) {
            return 'online';
        } else if (diff < this.ONLINE_THRESHOLD * 2) {
            return 'away';
        } else {
            return 'offline';
        }
    },
    
    /**
     * Retorna texto do status
     */
    getStatusText(status) {
        switch (status) {
            case 'online': return 'Online agora';
            case 'away': return 'Ausente';
            default: return 'Offline';
        }
    },
    
    /**
     * Formata tempo decorrido
     */
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return 'agora';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}min`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
        return Utils.formatTime(new Date(timestamp));
    },
    
    /**
     * Obtém iniciais do nome
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    },
    
    /**
     * Mapeamento de nomes para fotos de perfil
     */
    memberPhotos: {
        'atila': 'membros/Atila.jpeg',
        'átila': 'membros/Atila.jpeg',
        'chris': 'membros/chris.jpeg',
        'christopher': 'membros/chris.jpeg',
        'marcus': 'membros/marcus.jpeg',
        'pedrao': 'membros/pedrao.jpeg',
        'pedrão': 'membros/pedrao.jpeg',
        'pedro': 'membros/pedrao.jpeg',
        'renan': 'membros/renan.jpeg'
    },
    
    /**
     * Verifica se o membro tem foto de perfil
     */
    getMemberPhoto(name) {
        if (!name) return null;
        const normalizedName = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Tentar match exato primeiro
        for (const [key, photo] of Object.entries(this.memberPhotos)) {
            const normalizedKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normalizedName === normalizedKey || normalizedName.includes(normalizedKey) || normalizedKey.includes(normalizedName)) {
                return photo;
            }
        }
        return null;
    },
    
    /**
     * Gera HTML do avatar (foto ou iniciais)
     */
    getAvatarHtml(name, size = 'normal') {
        const photo = this.getMemberPhoto(name);
        const sizeClass = size === 'small' ? 'avatar-small' : '';
        
        if (photo) {
            return `
                <div class="message-avatar has-photo ${sizeClass}">
                    <img src="${photo}" alt="${Utils.escapeHtml(name)}" class="avatar-photo" onerror="this.parentElement.innerHTML='${this.getInitials(name)}'; this.parentElement.style.background='${this.getAvatarColor(name)}'">
                </div>
            `;
        }
        
        return `
            <div class="message-avatar ${sizeClass}" style="background: ${this.getAvatarColor(name)}">
                ${this.getInitials(name)}
            </div>
        `;
    },
    
    /**
     * Gera cor consistente para avatar baseado no nome
     */
    getAvatarColor(name) {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
            'linear-gradient(135deg, #6f4e37 0%, #8b7355 100%)', // Coffee color
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
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
     * Atualiza contador de usuários online
     */
    updateOnlineCount() {
        const counter = document.getElementById('onlineCount');
        if (!counter) return;
        
        let onlineCount = 0;
        this.onlineUsers.forEach(data => {
            if (data.status === 'online') onlineCount++;
        });
        
        counter.textContent = onlineCount;
        
        // Atualizar também a barra de online compacta no chat
        this.updateOnlineBar();
    },
    
    /**
     * Atualiza a barra de avatares online no topo do chat
     */
    updateOnlineBar() {
        const container = document.getElementById('onlineBarAvatars');
        if (!container) return;
        
        const currentUser = State.getUser();
        const normalizedCurrent = this.normalizeUsername(currentUser);
        
        // Filtrar apenas usuários online (usando dados já processados de this.onlineUsers)
        const onlineUsers = Array.from(this.onlineUsers.entries())
            .filter(([username, data]) => data.status === 'online')
            .sort((a, b) => {
                // Usuário atual primeiro
                if (a[0] === normalizedCurrent) return -1;
                if (b[0] === normalizedCurrent) return 1;
                return (a[1].displayName || '').localeCompare(b[1].displayName || '');
            });
        
        container.innerHTML = '';
        
        // Mostrar no máximo 8 avatares, depois mostrar "+N"
        const maxAvatars = 8;
        const displayUsers = onlineUsers.slice(0, maxAvatars);
        const remainingCount = onlineUsers.length - maxAvatars;
        
        displayUsers.forEach(([normalizedUsername, userData]) => {
            const isCurrentUser = normalizedUsername === normalizedCurrent;
            const displayName = userData.displayName || normalizedUsername;
            const photo = this.getMemberPhoto(displayName);
            const color = this.getAvatarColor(displayName);
            const initials = this.getInitials(displayName);
            const shownName = isCurrentUser ? 'Você' : displayName;
            
            const avatar = document.createElement('div');
            avatar.className = 'online-bar-avatar';
            avatar.title = shownName;
            
            if (photo) {
                avatar.innerHTML = `
                    <img src="${photo}" alt="${Utils.escapeHtml(displayName)}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <span style="display:none; background:${color}; width:100%; height:100%; align-items:center; justify-content:center;">${initials}</span>
                    <span class="online-bar-name">${Utils.escapeHtml(shownName)}</span>
                `;
            } else {
                avatar.style.background = color;
                avatar.innerHTML = `
                    ${initials}
                    <span class="online-bar-name">${Utils.escapeHtml(shownName)}</span>
                `;
            }
            
            // Click para mencionar (usar displayName para @menção)
            if (!isCurrentUser) {
                avatar.addEventListener('click', () => this.mentionUser(displayName));
            }
            
            container.appendChild(avatar);
        });
        
        // Mostrar contador de restantes
        if (remainingCount > 0) {
            const moreAvatar = document.createElement('div');
            moreAvatar.className = 'online-bar-avatar more-count';
            moreAvatar.innerHTML = `+${remainingCount}`;
            moreAvatar.title = `Mais ${remainingCount} online`;
            container.appendChild(moreAvatar);
        }
    },
    
    // 🛡️ MÉTODOS DE MODERAÇÃO
    
    async deleteMessages(messageIds) {
        const messages = State.getChatMessages();
        const filtered = messages.filter(m => !messageIds.includes(m.id));
        
        await State.setChatMessages(filtered);
        this.loadMessages();
    },
    
    showModerationMessage(title, message, type = 'info', duration = 3000) {
        // Remover mensagem anterior se existir
        const existingMsg = document.getElementById('moderationMessage');
        if (existingMsg) {
            existingMsg.remove();
        }
        
        const msgDiv = document.createElement('div');
        msgDiv.id = 'moderationMessage';
        msgDiv.className = `moderation-message ${type}`;
        msgDiv.innerHTML = `
            <div class="moderation-message-content">
                <div class="moderation-message-title">${title}</div>
                <div class="moderation-message-text">${message}</div>
            </div>
            <button class="moderation-message-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.body.appendChild(msgDiv);
        
        // Auto-remover após duração
        if (duration > 0) {
            setTimeout(() => {
                if (msgDiv.parentElement) {
                    msgDiv.classList.add('fadeOut');
                    setTimeout(() => msgDiv.remove(), 300);
                }
            }, duration);
        }
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

// Add chat styles dynamically
const style = document.createElement('style');
style.textContent = `
    .message-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 4px;
    }
    
    .reaction-btn {
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.4;
        transition: opacity 0.2s ease, color 0.2s ease;
        padding: 4px 8px;
        font-size: 0.9rem;
        color: var(--text-secondary);
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    
    .message-content:hover .reaction-btn {
        opacity: 1;
    }
    
    .reaction-btn:hover {
        color: var(--primary-coffee);
        opacity: 1;
        transform: scale(1.1);
    }
    
    /* Sempre visível em telas pequenas */
    @media (max-width: 768px) {
        .reaction-btn {
            opacity: 0.6;
        }
    }
    
    .reaction-picker {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        background: var(--glass-bg-solid);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: var(--radius-lg);
        padding: 10px;
        display: none;
        gap: 4px;
        box-shadow: var(--shadow-xl), 0 0 30px rgba(0,0,0,0.1);
        z-index: 1000;
        border: 1px solid var(--glass-border);
        animation: pickerSlideIn 0.2s ease;
    }
    
    @keyframes pickerSlideIn {
        from {
            opacity: 0;
            transform: translateY(10px) scale(0.9);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    
    .reaction-picker.active {
        display: flex;
    }
    
    /* Ajustar posicionamento em mensagens enviadas */
    .message.sent .reaction-picker {
        right: 0;
        left: auto;
    }
    
    .message.received .reaction-picker {
        left: 50px;
        right: auto;
    }
    
    .reaction-option {
        cursor: pointer;
        font-size: 1.3rem;
        padding: 8px;
        border-radius: var(--radius-md);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .reaction-option:hover {
        background: var(--glass-bg-hover);
        transform: scale(1.3);
    }
    
    .reaction-option:active {
        transform: scale(1.1);
    }
    
    .message-reactions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
    }
    
    .reaction-badge {
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-full);
        padding: 4px 10px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        user-select: none;
    }
    
    .reaction-badge:hover {
        background: var(--glass-bg-hover);
        transform: scale(1.05);
    }
    
    .reaction-badge.reacted {
        background: rgba(111, 78, 55, 0.2);
        border-color: var(--primary-coffee);
        box-shadow: 0 0 0 2px rgba(111, 78, 55, 0.1);
    }
    
    .message {
        position: relative;
    }
    
    .message-content {
        position: relative;
    }
    
    .mention {
        color: var(--primary-coffee);
        font-weight: 600;
        background: rgba(111, 78, 55, 0.15);
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .mention:hover {
        background: rgba(111, 78, 55, 0.25);
    }
    
    .message.sent .mention {
        background: rgba(255, 255, 255, 0.2);
        color: white;
    }
    
    .chat-search {
        position: relative;
        padding: var(--spacing-sm) var(--spacing-md);
        border-bottom: 1px solid var(--glass-border);
        background: var(--glass-bg);
        flex-shrink: 0;
    }
    
    .chat-search input {
        width: 100%;
        padding: 12px 45px 12px 16px;
        border: 1px solid var(--glass-border);
        border-radius: var(--radius-lg);
        background: var(--glass-bg-solid);
        color: var(--text-primary);
        font-size: 0.9rem;
        transition: all 0.3s ease;
        box-sizing: border-box;
    }
    
    .chat-search input:focus {
        border-color: var(--primary-coffee-light);
        box-shadow: 0 0 0 3px rgba(111, 78, 55, 0.1);
        background: rgba(255, 255, 255, 0.95);
        outline: none;
    }
    
    .chat-search .search-icon {
        position: absolute;
        right: calc(var(--spacing-md) + 12px);
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-secondary);
        pointer-events: none;
        font-size: 0.9rem;
    }
    
    .chat-search .clear-search {
        position: absolute;
        right: calc(var(--spacing-md) + 35px);
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-secondary);
        display: none;
        padding: 5px;
        border-radius: 50%;
        transition: all 0.2s ease;
    }
    
    .chat-search .clear-search:hover {
        background: var(--glass-bg-hover);
        color: var(--primary-coffee);
    }
    
    .chat-search.has-query .clear-search {
        display: flex;
    }
    
    .search-highlight {
        background: rgba(251, 191, 36, 0.15);
        border-left: 3px solid #fbbf24;
        animation: highlightPulse 2s ease-in-out infinite;
    }
    
    @keyframes highlightPulse {
        0%, 100% { background: rgba(251, 191, 36, 0.15); }
        50% { background: rgba(251, 191, 36, 0.25); }
    }
    
    .no-search-results {
        text-align: center;
        padding: 40px;
        color: var(--text-secondary);
    }
    
    .no-search-results i {
        font-size: 2.5rem;
        margin-bottom: 15px;
        opacity: 0.4;
        display: block;
    }
    
    .no-search-results p {
        font-weight: 600;
        color: var(--text-primary);
    }
    
    /* Quick actions tooltip */
    .message-actions {
        position: absolute;
        top: -30px;
        right: 10px;
        background: var(--glass-bg-solid);
        border-radius: var(--radius-md);
        padding: 4px;
        display: none;
        gap: 2px;
        box-shadow: var(--shadow-md);
        border: 1px solid var(--glass-border);
    }
    
    .message:hover .message-actions {
        display: flex;
    }
    
    .action-btn {
        padding: 6px 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: var(--radius-sm);
        color: var(--text-secondary);
        transition: all 0.2s ease;
    }
    
    .action-btn:hover {
        background: var(--glass-bg-hover);
        color: var(--primary-coffee);
    }
`;
document.head.appendChild(style);

// Close reaction picker when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.reaction-picker') && !e.target.closest('.reaction-btn')) {
        document.querySelectorAll('.reaction-picker.active').forEach(picker => {
            picker.classList.remove('active');
        });
    }
});

// Handle mention clicks
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('mention')) {
        const username = e.target.dataset.mention;
        if (username) {
            Chat.mentionUser(username);
        }
    }
});

// Export Chat globally for socket access
window.Chat = Chat;

// Export functions for global access
window.sendMessage = async () => await Chat.send();
window.handleChatKeypress = (event) => Chat.handleKeypress(event);
