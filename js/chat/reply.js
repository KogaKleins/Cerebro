/**
 * CHAT REPLY MODULE
 * Sistema de resposta a mensagens
 */

import { State } from '../state.js';
import { Utils } from '../utils.js';

export const ChatReply = {
    /**
     * Responder a uma mensagem
     */
    replyToMessage(messageId, scrollToMessageCallback) {
        console.log('[Chat] replyToMessage called with messageId:', messageId);
        
        const messages = State.getChatMessages();
        const message = messages.find(m => String(m.id) === String(messageId));
        
        if (!message) {
            console.warn('[Chat] Message not found for reply:', messageId);
            Utils.showToast('Mensagem não encontrada', 'error', null, 2000);
            return null;
        }
        
        // Mostrar UI de resposta
        this.showReplyPreview(message);
        
        // Focar no input
        const input = document.getElementById('chatInput');
        if (input) {
            input.focus();
        }
        
        Utils.showToast(`Respondendo a ${message.author}`, 'info', null, 2000);
        
        return message;
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
        const replyPreview = document.getElementById('replyPreview');
        if (replyPreview) {
            replyPreview.classList.remove('visible');
            setTimeout(() => replyPreview.remove(), 200);
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
    }
};


