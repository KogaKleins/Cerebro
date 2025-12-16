/**
 * CHAT REACTIONS MODULE
 * Sistema de reações em mensagens
 */

import { State } from '../state.js';
import { Utils } from '../utils.js';
import { normalizeUsername } from './utils.js';
import { ChatRender } from './render.js';

export const ChatReactions = {
    /**
     * Toggle emoji picker
     */
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
    
    /**
     * Adicionar reação a uma mensagem
     */
    async addReaction(messageId, reaction, reactions, onlineUsers) {
        const user = State.getUser();
        if (!user) return;
        
        // Update local state
        const messages = State.getChatMessages();
        const message = messages.find(m => m.id == messageId);
        
        if (message) {
            if (!message.reactions) message.reactions = {};
            
            // Encontrar chave existente (pode ter case diferente)
            const normalizedUser = normalizeUsername(user);
            let existingKey = null;
            let existingReaction = null;
            
            for (const [key, value] of Object.entries(message.reactions)) {
                if (normalizeUsername(key) === normalizedUser) {
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
            this.updateMessageReactions(messageId, message, reactions);
            
            // Save to state
            await State.updateChatMessage(messageId, message);
            
            // Persistir via WebSocket ou API
            const isWebSocketConnected = window.Socket && window.Socket.isConnected();
            
            if (isWebSocketConnected && !isRemoving) {
                try {
                    const response = await window.Socket.sendReaction(messageId, reaction);
                    
                    // Mostrar XP apenas se backend confirmar
                    if (response && response.xpAwarded) {
                        try {
                            const { Levels } = await import('../levels/index.js');
                            await Levels.awardXP(user, 'reaction-given', `reaction-given-${messageId}-${user}`, {
                                trackingType: 'reactions',
                                persistToBackend: false,
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
                this.persistReactionViaAPI(messageId, reaction, message, isRemoving);
            }
        }
        
        // Close picker
        const picker = document.getElementById(`reactionPicker-${messageId}`);
        if (picker) picker.classList.remove('active');
    },
    
    /**
     * Persistir reação via API REST
     */
    async persistReactionViaAPI(messageId, reaction, message, isRemoving) {
        try {
            const { Api } = await import('../api.js');
            
            if (isRemoving) {
                await Api.removeReaction(messageId, reaction);
            } else {
                await Api.addReaction(messageId, reaction, message.author);
            }
        } catch (apiError) {
            console.warn('Erro ao persistir reação no banco:', apiError);
        }
    },
    
    /**
     * Receber reação de outro usuário via WebSocket
     */
    handleReactionUpdate(data, reactions) {
        const { messageId, reactions: serverReactions, user, emoji, action } = data;
        const currentUser = State.getUser();
        
        // Ignorar se foi eu que enviei (já atualizei localmente)
        if (normalizeUsername(user) === normalizeUsername(currentUser)) {
            return;
        }
        
        // Atualizar state local
        const messages = State.getChatMessages();
        const message = messages.find(m => m.id == messageId);
        
        if (message) {
            // Atualizar reações com dados do servidor
            message.reactions = serverReactions;
            State.updateChatMessage(messageId, message);
            
            // Atualizar UI
            this.updateMessageReactions(messageId, message, reactions);
            
            // Notificar se alguém reagiu à minha mensagem
            if (message.author === currentUser && action === 'add') {
                Utils.showToast(`${user} reagiu com ${emoji} à sua mensagem`, 'info', null, 3000);
            }
        }
    },
    
    /**
     * Toggle reação (adicionar ou remover)
     */
    async toggleReaction(messageId, reaction, reactions, onlineUsers) {
        await this.addReaction(messageId, reaction, reactions, onlineUsers);
    },
    
    /**
     * Atualiza reações na UI de uma mensagem
     */
    updateMessageReactions(messageId, message, reactions) {
        const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!msgEl) return;
        
        const reactionsContainer = msgEl.querySelector('.message-reactions');
        if (reactionsContainer) {
            reactionsContainer.outerHTML = ChatRender.buildReactionsHtml(message, reactions);
        }
    }
};


