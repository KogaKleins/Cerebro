/**
 * CHAT EVENTS MODULE
 * Gerencia todos os event handlers
 */

export const ChatEvents = {
    /**
     * Setup de handlers diretos para ações nas mensagens
     */
    setupMessageActions(replyToMessageCallback, copyMessageCallback, toggleReactionPickerCallback, loadMoreMessagesCallback, hasMoreMessages, isLoadingMore, PAGE_SIZE) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        // Handler com captura para garantir que pegue o evento
        chatContainer.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.action-btn');
            if (!actionBtn) return;
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            const action = actionBtn.dataset.action;
            const messageId = actionBtn.dataset.messageId;
            
            if (!action || !messageId) {
                console.warn('[Chat] Missing action or messageId');
                return;
            }
            
            switch (action) {
                case 'replyToMessage':
                    if (replyToMessageCallback) replyToMessageCallback(messageId);
                    break;
                case 'copyMessage':
                    if (copyMessageCallback) copyMessageCallback(messageId);
                    break;
                case 'toggleReactionPicker':
                    if (toggleReactionPickerCallback) toggleReactionPickerCallback(messageId);
                    break;
            }
        }, true);
        
        // Também adicionar handler no document como fallback
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.message-actions .action-btn');
            if (!actionBtn) return;
            
            if (!actionBtn.closest('#chatMessages')) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const action = actionBtn.dataset.action;
            const messageId = actionBtn.dataset.messageId;
            
            if (!action || !messageId) return;
            
            switch (action) {
                case 'replyToMessage':
                    if (replyToMessageCallback) replyToMessageCallback(messageId);
                    break;
                case 'copyMessage':
                    if (copyMessageCallback) copyMessageCallback(messageId);
                    break;
                case 'toggleReactionPicker':
                    if (toggleReactionPickerCallback) toggleReactionPickerCallback(messageId);
                    break;
            }
        });
        
        // Detectar scroll para cima para carregar mais mensagens
        chatContainer.addEventListener('scroll', () => {
            if (chatContainer.scrollTop < 100 && hasMoreMessages && !isLoadingMore) {
                if (loadMoreMessagesCallback) loadMoreMessagesCallback();
            }
        });
    },
    
    /**
     * Configura listener para navegação - garante scroll ao abrir chat
     */
    setupNavigationListener(forceScrollCallback) {
        const chatPage = document.getElementById('chat');
        if (!chatPage) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (chatPage.classList.contains('active')) {
                        // Chat foi aberto - forçar scroll para o final
                        if (forceScrollCallback) forceScrollCallback();
                    }
                }
            });
        });
        
        observer.observe(chatPage, { attributes: true });
    },
    
    /**
     * Listener para visibilidade da aba
     */
    setupVisibilityListener(forceFullSyncCallback, markAllAsReadCallback, validateDOMConsistencyCallback) {
        // Listener para quando a aba ganha/perde foco
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                console.log('[Chat] 🔄 Aba voltou ao foco - sincronizando...');
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Forçar reconstrução completa da UI
                if (forceFullSyncCallback) {
                    await forceFullSyncCallback(true);
                }
                
                // Marcar como lido
                if (markAllAsReadCallback) {
                    markAllAsReadCallback();
                }
            }
        });
        
        // Listener para quando a janela ganha foco
        window.addEventListener('focus', async () => {
            const now = Date.now();
            // Verificar se passou tempo suficiente desde última sync (5 segundos)
            // Isso será verificado externamente
        });
        
        // Listener adicional para quando navega entre páginas da aplicação
        const chatPage = document.getElementById('chat');
        if (chatPage) {
            const pageObserver = new MutationObserver(async (mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        if (chatPage.classList.contains('active')) {
                            console.log('[Chat] 📱 Página de chat ativada - sincronizando...');
                            
                            await new Promise(resolve => setTimeout(resolve, 50));
                            
                            // Verificar se dados estão desatualizados (será verificado externamente)
                            if (forceFullSyncCallback) {
                                await forceFullSyncCallback(true);
                            }
                            
                            if (forceFullSyncCallback) {
                                // Forçar scroll também
                            }
                        }
                    }
                }
            });
            
            pageObserver.observe(chatPage, { attributes: true });
        }
    },
    
    /**
     * Configurar atalhos de teclado no input
     */
    setupInputShortcuts(cancelReplyCallback) {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        input.addEventListener('keydown', (e) => {
            // Escape para cancelar resposta
            if (e.key === 'Escape' && cancelReplyCallback) {
                cancelReplyCallback();
            }
        });
    },
    
    /**
     * Setup do emoji picker
     */
    setupEmojiPicker(toggleEmojiPickerCallback, insertEmojiCallback) {
        const pickerBtn = document.getElementById('emojiPickerBtn');
        const picker = document.getElementById('emojiPicker');
        
        if (pickerBtn && toggleEmojiPickerCallback) {
            pickerBtn.addEventListener('click', () => toggleEmojiPickerCallback());
        }
        
        if (picker && insertEmojiCallback) {
            // Handler para cliques nos emojis
            picker.addEventListener('click', (e) => {
                const emojiItem = e.target.closest('.emoji-item');
                if (emojiItem) {
                    const emoji = emojiItem.dataset.emoji;
                    insertEmojiCallback(emoji);
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
     * Setup de listeners globais (reaction picker, mentions)
     */
    setupGlobalListeners(mentionUserCallback) {
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
                if (username && mentionUserCallback) {
                    mentionUserCallback(username);
                }
            }
        });
    }
};


