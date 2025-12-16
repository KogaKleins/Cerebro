/**
 * CHAT RENDER MODULE
 * Responsável pela renderização de mensagens e elementos da UI
 */

import { State } from '../state.js';
import { Utils } from '../utils.js';
import { ChatAvatars } from './avatars.js';
import { normalizeUsername } from './utils.js';
import { formatDateSeparator } from './utils.js';
import { ChatState } from './state.js';

export const ChatRender = {
    /**
     * Formata texto da mensagem (markdown, links, emojis)
     */
    formatMessageText(text) {
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
        
        // Format mentions
        formatted = formatted.replace(/@(\w+)/g, '<span class="mention" data-mention="$1">@$1</span>');
        
        // Format URLs with smart preview
        formatted = formatted.replace(
            /(https?:\/\/[^\s]+)/g, 
            (url) => {
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
    
    /**
     * Cria elemento de mensagem
     */
    createMessageElement(message, isContinuation = false, reactions, scrollToMessageCallback) {
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
                normalizeUsername(message.author) === normalizeUsername(currentUser);
            div.className = `message ${isSent ? 'sent' : 'received'}${continuationClass}`;
            
            const reactionsHtml = this.buildReactionsHtml(message, reactions);
            const avatarHtml = (!isSent && !isContinuation) ? ChatAvatars.getAvatarHtml(message.author) : '';
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
                    ${reactions.map(r => `
                        <span class="reaction-option" data-action="addReaction" data-message-id="${message.id}" data-reaction="${r}">${r}</span>
                    `).join('')}
                </div>
            `;
            
            // Handler para reply preview
            const replyPreviewEl = div.querySelector('.message-reply-preview');
            if (replyPreviewEl && scrollToMessageCallback) {
                replyPreviewEl.addEventListener('click', () => {
                    scrollToMessageCallback(replyPreviewEl.dataset.replyId);
                });
            }
        }
        
        return div;
    },
    
    /**
     * Constrói HTML de reações
     */
    buildReactionsHtml(message, reactions) {
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
            reactionCounts[reaction].normalizedUsers.push(normalizeUsername(user));
        }
        
        const currentUser = State.getUser();
        const normalizedCurrentUser = normalizeUsername(currentUser);
        
        const html = Object.entries(reactionCounts).map(([reaction, data]) => {
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
    
    /**
     * Renderiza um conjunto de mensagens no container
     */
    renderMessages(messages, container, prepend = false, reactions, scrollToMessageCallback) {
        let lastDate = null;
        const fragment = document.createDocumentFragment();
        
        messages.forEach((msg, index) => {
            const msgDate = new Date(msg.timestamp);
            const dateStr = formatDateSeparator(msgDate);
            
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
            
            const msgEl = this.createMessageElement(msg, isContinuation, reactions, scrollToMessageCallback);
            fragment.appendChild(msgEl);
        });
        
        if (prepend) {
            const oldIndicator = container.querySelector('.load-more-indicator');
            if (oldIndicator) oldIndicator.remove();
            
            const scrollHeightBefore = container.scrollHeight;
            container.insertBefore(fragment, container.firstChild);
            
            const scrollHeightAfter = container.scrollHeight;
            container.scrollTop = scrollHeightAfter - scrollHeightBefore;
        } else {
            container.appendChild(fragment);
        }
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
    }
};


