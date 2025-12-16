/**
 * CHAT MODERATION MODULE
 * Integração com sistema de moderação
 */

import { ChatModeration } from '../chat-moderation.js';
import { State } from '../state.js';

export const ChatModerationIntegration = {
    /**
     * Mostra mensagem de moderação
     */
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
     * Deletar mensagens
     */
    async deleteMessages(messageIds, loadMessagesCallback) {
        const messages = State.getChatMessages();
        const filtered = messages.filter(m => !messageIds.includes(m.id));
        
        await State.setChatMessages(filtered);
        if (loadMessagesCallback) {
            loadMessagesCallback();
        }
    },
    
    /**
     * Verifica se usuário está bloqueado (com verificação robusta)
     */
    async checkUserBlocked(currentUser) {
        // Primeiro verificação local rápida
        let blockData = ChatModeration.isUserBlocked(currentUser);
        
        // Se tiver ban local OU se faz tempo que não verificou no servidor, fazer verificação robusta
        if (blockData || (Date.now() - ChatModeration.lastBanCheckTimestamp) > ChatModeration.BAN_CHECK_INTERVAL_MS) {
            blockData = await ChatModeration.isUserBlockedAsync(currentUser);
        }
        
        return blockData;
    },
    
    /**
     * Verifica spam e retorna resultado
     */
    checkSpam(currentUser, text) {
        return ChatModeration.checkSpam(currentUser, text);
    },
    
    /**
     * Bloqueia usuário
     */
    async blockUser(currentUser, reason, messagesToDelete) {
        return await ChatModeration.blockUser(currentUser, reason, messagesToDelete);
    },
    
    /**
     * Adiciona mensagem ao histórico de moderação
     */
    addToHistory(currentUser, message) {
        ChatModeration.addToHistory(currentUser, message);
    }
};


