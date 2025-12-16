/**
 * CHAT API MODULE
 * Comunicação com servidor (loadMessages, sync, send)
 */

import { State } from '../state.js';
import { generateMessagesHash } from './utils.js';
import { ChatRender } from './render.js';
import { ChatState } from './state.js';

export const ChatAPI = {
    /**
     * Carrega mensagens com paginação (estilo WhatsApp)
     */
    loadMessages(reactions, scrollToMessageCallback, forceScrollCallback, updateOnlineUsersCallback) {
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        const messages = State.getChatMessages();
        
        // Limpar container primeiro
        chatContainer.innerHTML = '';
        
        // Reset paginação
        ChatState.currentPage = 1;
        ChatState.hasMoreMessages = true;
        
        // Resetar hash para permitir nova verificação
        ChatState.lastServerDataHash = null;
        ChatState.lastSyncTimestamp = Date.now();
        
        // Se não há mensagens, mostrar mensagem de boas-vindas
        if (!messages || messages.length === 0) {
            chatContainer.innerHTML = `
                <div class="chat-empty-state">
                    <div class="empty-icon">💬</div>
                    <p>Inicie uma conversa!</p>
                    <span>Seja o primeiro a enviar uma mensagem para a equipe</span>
                </div>
            `;
            ChatState.hasMoreMessages = false;
            ChatState.allMessages = [];
            return;
        }
        
        // Ordenar mensagens por timestamp (mais antigas primeiro)
        ChatState.allMessages = [...messages].sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Gerar hash inicial
        ChatState.lastServerDataHash = generateMessagesHash(ChatState.allMessages);
        
        // Pegar apenas as últimas PAGE_SIZE mensagens
        const totalMessages = ChatState.allMessages.length;
        const startIndex = Math.max(0, totalMessages - ChatState.PAGE_SIZE);
        const messagesToRender = ChatState.allMessages.slice(startIndex);
        
        // Se há mais mensagens antigas, mostrar indicador
        ChatState.hasMoreMessages = startIndex > 0;
        
        if (ChatState.hasMoreMessages) {
            ChatRender.addLoadMoreIndicator(chatContainer);
        }
        
        // Renderizar mensagens
        ChatRender.renderMessages(messagesToRender, chatContainer, false, reactions, scrollToMessageCallback);
        
        // Guardar o ID da última mensagem
        if (ChatState.allMessages.length > 0) {
            ChatState.lastMessageId = ChatState.allMessages[ChatState.allMessages.length - 1].id;
        }
        
        // Scroll para o final
        if (forceScrollCallback) {
            forceScrollCallback();
        }
        
        // Atualizar membros online
        if (updateOnlineUsersCallback) {
            updateOnlineUsersCallback();
        }
        
        // Marcar como lidas se a janela está focada
        if (document.hasFocus()) {
            // markAllAsRead será chamado externamente
        }
    },
    
    /**
     * Carrega mais mensagens antigas quando rola para cima
     */
    async loadMoreMessages(reactions, scrollToMessageCallback) {
        if (ChatState.isLoadingMore || !ChatState.hasMoreMessages) return;
        
        ChatState.isLoadingMore = true;
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) {
            ChatState.isLoadingMore = false;
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
        const totalMessages = ChatState.allMessages.length;
        const currentStartIndex = totalMessages - currentRenderedCount;
        const newStartIndex = Math.max(0, currentStartIndex - ChatState.PAGE_SIZE);
        const newMessages = ChatState.allMessages.slice(newStartIndex, currentStartIndex);
        
        if (newMessages.length === 0) {
            ChatState.hasMoreMessages = false;
            if (indicator) indicator.remove();
            ChatState.isLoadingMore = false;
            return;
        }
        
        // Verificar se ainda há mais
        ChatState.hasMoreMessages = newStartIndex > 0;
        
        // Renderizar novas mensagens no topo
        ChatRender.renderMessages(newMessages, chatContainer, true, reactions, scrollToMessageCallback);
        
        ChatState.isLoadingMore = false;
    },
    
    /**
     * Sincronização incremental - adiciona apenas mensagens novas
     */
    async syncMessages(appendMessageCallback, showNewMessagesButtonCallback, updateOnlineUsersCallback, loadMessagesCallback) {
        // Evitar sync se já há um em progresso
        if (ChatState.syncInProgress) return;
        
        const chatContainer = document.getElementById('chatMessages');
        if (!chatContainer) return;
        
        ChatState.syncInProgress = true;
        
        try {
            // Buscar mensagens atualizadas do servidor
            await State.refreshChatMessages();
            const messages = State.getChatMessages();
            
            if (!messages || messages.length === 0) {
                ChatState.syncInProgress = false;
                return;
            }
            
            // Ordenar mensagens por timestamp
            const sortedMessages = [...messages].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            // CRÍTICO: Atualizar allMessages para manter consistência
            ChatState.allMessages = sortedMessages;
            
            // Gerar hash para detectar mudanças
            const newHash = generateMessagesHash(sortedMessages);
            
            // Se não mudou, não precisa atualizar UI
            if (newHash === ChatState.lastServerDataHash) {
                ChatState.syncInProgress = false;
                return;
            }
            
            // Atualizar hash
            ChatState.lastServerDataHash = newHash;
            ChatState.lastSyncTimestamp = Date.now();
            
            // Encontrar mensagens que ainda não estão no DOM
            const existingIds = new Set(
                Array.from(chatContainer.querySelectorAll('[data-message-id]'))
                    .map(el => String(el.dataset.messageId))
            );
            
            const newMessages = sortedMessages.filter(msg => !existingIds.has(String(msg.id)));
            
            // Se não há novas mensagens no DOM, verificar se há mensagens faltando
            if (newMessages.length === 0) {
                const domCount = chatContainer.querySelectorAll('[data-message-id]').length;
                const expectedCount = Math.min(ChatState.PAGE_SIZE, sortedMessages.length);
                
                if (domCount < expectedCount * 0.8) {
                    console.log('[Chat] ⚠️ Detectada possível dessincronização - recarregando...');
                    if (loadMessagesCallback) loadMessagesCallback();
                }
                ChatState.syncInProgress = false;
                return;
            }
            
            console.log(`[Chat] 📨 Adicionando ${newMessages.length} novas mensagens`);
            
            // Verificar se está perto do final antes de adicionar
            const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
            
            // Adicionar apenas as novas mensagens
            newMessages.forEach(msg => {
                if (appendMessageCallback) appendMessageCallback(msg, false);
            });
            
            // Atualizar último ID
            if (sortedMessages.length > 0) {
                ChatState.lastMessageId = sortedMessages[sortedMessages.length - 1].id;
            }
            
            // Scroll para baixo apenas se estava no final e não está rolando
            if (wasAtBottom && !ChatState.isUserScrolling) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            } else if (ChatState.isUserScrolling && newMessages.length > 0) {
                // Mostrar botão de novas mensagens se o usuário está rolando
                if (showNewMessagesButtonCallback) showNewMessagesButtonCallback();
            }
            
            // Atualizar membros online
            if (updateOnlineUsersCallback) {
                updateOnlineUsersCallback();
            }
        } catch (error) {
            console.warn('Erro ao sincronizar mensagens:', error);
        } finally {
            ChatState.syncInProgress = false;
        }
    },
    
    /**
     * Força sincronização completa do servidor
     */
    async forceFullSync(forceRebuild, loadMessagesCallback, appendMessageCallback, showNewMessagesButtonCallback, updateOnlineUsersCallback) {
        // Evitar sincronizações simultâneas
        if (ChatState.syncInProgress) {
            console.log('[Chat] Sync já em progresso, ignorando...');
            return;
        }
        
        ChatState.syncInProgress = true;
        
        try {
            // Buscar mensagens frescas do servidor
            await State.refreshChatMessages();
            const serverMessages = State.getChatMessages();
            
            if (!serverMessages || serverMessages.length === 0) {
                ChatState.syncInProgress = false;
                return;
            }
            
            // Gerar hash para detectar se houve mudanças
            const newHash = generateMessagesHash(serverMessages);
            
            // Detectar se houve mudanças significativas
            const hasChanges = newHash !== ChatState.lastServerDataHash;
            const shouldRebuild = forceRebuild || hasChanges;
            
            // Se não mudou e não forçou rebuild, apenas atualizar timestamp
            if (!hasChanges && !forceRebuild) {
                console.log('[Chat] Nenhuma mudança detectada no servidor');
                ChatState.lastSyncTimestamp = Date.now();
                ChatState.syncInProgress = false;
                return;
            }
            
            console.log(`[Chat] 🔄 ${forceRebuild ? 'Rebuild forçado' : 'Mudanças detectadas'} - atualizando UI...`);
            
            // Atualizar hash
            ChatState.lastServerDataHash = newHash;
            
            // CRÍTICO: Atualizar allMessages com dados frescos do servidor
            ChatState.allMessages = [...serverMessages].sort((a, b) => {
                return new Date(a.timestamp) - new Date(b.timestamp);
            });
            
            const chatContainer = document.getElementById('chatMessages');
            if (!chatContainer) {
                ChatState.syncInProgress = false;
                return;
            }
            
            // Se forçar rebuild, reconstruir todo o DOM
            if (forceRebuild) {
                console.log('[Chat] 🔨 Reconstruindo DOM completo...');
                
                // Salvar posição relativa do scroll
                const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
                
                // Limpar e reconstruir
                if (loadMessagesCallback) {
                    loadMessagesCallback();
                }
                
                ChatState.lastSyncTimestamp = Date.now();
                ChatState.syncInProgress = false;
                return;
            }
            
            // Modo incremental: apenas adicionar mensagens novas
            const wasAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 100;
            
            // Verificar se há mensagens novas que não estão no DOM
            const domMessageIds = new Set(
                Array.from(chatContainer.querySelectorAll('[data-message-id]'))
                    .map(el => String(el.dataset.messageId))
            );
            
            const newMessages = ChatState.allMessages.filter(m => !domMessageIds.has(String(m.id)));
            
            if (newMessages.length > 0) {
                console.log(`[Chat] ${newMessages.length} novas mensagens encontradas`);
                
                // Se muitas mensagens novas, fazer rebuild completo
                if (newMessages.length > 10) {
                    console.log('[Chat] 🔨 Muitas mensagens novas - reconstruindo DOM...');
                    if (loadMessagesCallback) loadMessagesCallback();
                } else {
                    // Adicionar apenas as novas mensagens
                    newMessages.forEach(msg => {
                        if (appendMessageCallback) appendMessageCallback(msg, false);
                    });
                }
                
                // Se estava no final, rolar para baixo
                if (wasAtBottom && !ChatState.isUserScrolling) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                } else if (newMessages.length > 0) {
                    // Mostrar indicador de novas mensagens
                    if (showNewMessagesButtonCallback) showNewMessagesButtonCallback();
                }
            }
            
            // Atualizar último ID
            if (ChatState.allMessages.length > 0) {
                ChatState.lastMessageId = ChatState.allMessages[ChatState.allMessages.length - 1].id;
            }
            
            ChatState.lastSyncTimestamp = Date.now();
            
        } catch (error) {
            console.error('[Chat] Erro ao sincronizar:', error);
        } finally {
            ChatState.syncInProgress = false;
        }
    }
};


