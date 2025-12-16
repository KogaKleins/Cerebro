/**
 * CHAT PRESENCE MODULE
 * Gerencia presença online, typing indicators e lista de usuários
 */

import { State } from '../state.js';
import { Utils } from '../utils.js';
import { normalizeUsername, getStatusText } from './utils.js';
import { ChatAvatars } from './avatars.js';
import { ChatState } from './state.js';

export const ChatPresence = {
    /**
     * Atualiza a presença do usuário atual
     */
    updatePresence(onlineUsers) {
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        const now = Date.now();
        const normalizedUser = normalizeUsername(currentUser);
        onlineUsers.set(normalizedUser, {
            lastSeen: now,
            isTyping: false,
            status: 'online',
            displayName: currentUser
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
    setupTypingDetection(isTypingRef, typingTimeoutRef, TYPING_TIMEOUT, emitTypingStartCallback, emitTypingStopCallback) {
        const input = document.getElementById('chatInput');
        if (!input) return;
        
        input.addEventListener('input', () => {
            if (!isTypingRef.value) {
                isTypingRef.value = true;
                emitTypingStartCallback();
            }
            
            // Resetar timeout
            clearTimeout(typingTimeoutRef.value);
            typingTimeoutRef.value = setTimeout(() => {
                isTypingRef.value = false;
                emitTypingStopCallback();
            }, TYPING_TIMEOUT);
        });
        
        // Parar de digitar ao enviar
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                isTypingRef.value = false;
                emitTypingStopCallback();
            }
        });
    },
    
    /**
     * Emite evento de início de digitação
     */
    emitTypingStart(onlineUsers) {
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        const normalizedUser = normalizeUsername(currentUser);
        const userData = onlineUsers.get(normalizedUser) || { lastSeen: Date.now(), status: 'online' };
        userData.isTyping = true;
        onlineUsers.set(normalizedUser, userData);
        
        // Emitir via WebSocket se disponível
        if (window.Socket && window.Socket.isConnected()) {
            window.Socket.startTyping();
        }
    },
    
    /**
     * Emite evento de parada de digitação
     */
    emitTypingStop(onlineUsers) {
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        const normalizedUser = normalizeUsername(currentUser);
        const userData = onlineUsers.get(normalizedUser);
        if (userData) {
            userData.isTyping = false;
            onlineUsers.set(normalizedUser, userData);
        }
        
        if (window.Socket && window.Socket.isConnected()) {
            window.Socket.stopTyping();
        }
    },
    
    /**
     * Atualiza indicador de digitação na UI
     */
    updateTypingIndicator(onlineUsers) {
        const currentUser = State.getUser();
        const typingUsers = [];
        
        onlineUsers.forEach((data, user) => {
            if (data.isTyping && normalizeUsername(user) !== normalizeUsername(currentUser)) {
                typingUsers.push(data.displayName || user);
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
     * Atualiza lista de membros online
     */
    updateOnlineUsers(mentionUserCallback) {
        const onlineContainer = document.getElementById('onlineUsers');
        if (!onlineContainer) return;
        
        const currentUser = State.getUser();
        const now = Date.now();
        
        // FONTE ÚNICA DE VERDADE: Lista de usuários online do WebSocket
        const wsOnlineUsers = (window.Socket && window.Socket.currentOnlineUsers) || [];
        const wsOnlineNormalized = new Set(wsOnlineUsers.map(u => normalizeUsername(u)));
        
        // Lista de membros conhecidos do sistema
        const knownMembers = ['Atila', 'Chris', 'Marcus', 'Renan', 'Pedrão', 'Wilmar'];
        
        // USAR MAP COM NOMES NORMALIZADOS para garantir unicidade
        const userActivity = new Map();
        
        // Adicionar membros conhecidos com status baseado no WebSocket
        knownMembers.forEach(member => {
            const normalizedName = normalizeUsername(member);
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
            const normalizedName = normalizeUsername(userName);
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
            const normalizedCurrentUser = normalizeUsername(currentUser);
            if (!userActivity.has(normalizedCurrentUser)) {
                userActivity.set(normalizedCurrentUser, {
                    displayName: currentUser,
                    lastActivity: now,
                    status: 'online',
                    isTyping: false
                });
            } else {
                const existing = userActivity.get(normalizedCurrentUser);
                existing.lastActivity = now;
                existing.status = 'online';
            }
        }
        
        // Sincronizar onlineUsers com os dados processados
        userActivity.forEach((data, normalizedName) => {
            const existingData = ChatState.onlineUsers.get(normalizedName);
            ChatState.onlineUsers.set(normalizedName, {
                lastSeen: data.lastActivity,
                status: data.status,
                isTyping: existingData?.isTyping || false,
                displayName: data.displayName
            });
        });
        
        // Remover usuários que não estão mais na lista
        Array.from(ChatState.onlineUsers.keys()).forEach(key => {
            if (!userActivity.has(key)) {
                ChatState.onlineUsers.delete(key);
            }
        });
        
        // Ordenar: online primeiro, depois usuário atual, depois por nome
        const normalizedCurrent = normalizeUsername(currentUser);
        const sortedUsers = Array.from(ChatState.onlineUsers.entries())
            .sort((a, b) => {
                // Usuário atual sempre primeiro
                if (a[0] === normalizedCurrent) return -1;
                if (b[0] === normalizedCurrent) return 1;
                
                // Depois, ordenar por status (online > away > offline)
                const statusOrder = { online: 0, away: 1, offline: 2 };
                const statusDiff = (statusOrder[a[1].status] || 2) - (statusOrder[b[1].status] || 2);
                if (statusDiff !== 0) return statusDiff;
                
                // Por fim, por nome
                return (a[1].displayName || '').localeCompare(b[1].displayName || '');
            });
        
        // Limpar container
        onlineContainer.innerHTML = '';
        
        // Criar cards de usuários
        sortedUsers.forEach(([normalizedUsername, userData]) => {
            const isCurrentUser = normalizedUsername === normalizedCurrent;
            const isOnline = userData.status === 'online';
            const isAway = userData.status === 'away';
            
            const card = document.createElement('div');
            card.className = `user-card ${isOnline ? 'online' : ''} ${isAway ? 'away' : ''} ${isCurrentUser ? 'current-user' : ''}`;
            card.dataset.username = normalizedUsername;
            
            // Avatar com foto ou iniciais
            const photo = ChatAvatars.getMemberPhoto(userData.displayName);
            const initials = ChatAvatars.getInitials(userData.displayName);
            const avatarColor = ChatAvatars.getAvatarColor(userData.displayName);
            
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
                    <span class="user-status-text">${getStatusText(userData.status)}</span>
                </div>
            `;
            
            // Click para mencionar usuário
            if (!isCurrentUser && mentionUserCallback) {
                card.addEventListener('click', () => mentionUserCallback(userData.displayName));
                card.style.cursor = 'pointer';
                card.title = `Clique para mencionar @${userData.displayName}`;
            }
            
            onlineContainer.appendChild(card);
        });
    },
    
    /**
     * Atualiza contador de usuários online
     */
    updateOnlineCount(onlineUsers) {
        const counter = document.getElementById('onlineCount');
        if (!counter) return;
        
        let onlineCount = 0;
        onlineUsers.forEach(data => {
            if (data.status === 'online') onlineCount++;
        });
        
        counter.textContent = onlineCount;
    },
    
    /**
     * Atualiza a barra de avatares online no topo do chat
     */
    updateOnlineBar(mentionUserCallback) {
        const container = document.getElementById('onlineBarAvatars');
        if (!container) return;
        
        const currentUser = State.getUser();
        const normalizedCurrent = normalizeUsername(currentUser);
        
        // Filtrar apenas usuários online
        const onlineUsersList = Array.from(ChatState.onlineUsers.entries())
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
        const displayUsers = onlineUsersList.slice(0, maxAvatars);
        const remainingCount = onlineUsersList.length - maxAvatars;
        
        displayUsers.forEach(([normalizedUsername, userData]) => {
            const isCurrentUser = normalizedUsername === normalizedCurrent;
            const displayName = userData.displayName || normalizedUsername;
            const photo = ChatAvatars.getMemberPhoto(displayName);
            const color = ChatAvatars.getAvatarColor(displayName);
            const initials = ChatAvatars.getInitials(displayName);
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
            
            // Click para mencionar usuário
            if (!isCurrentUser && mentionUserCallback) {
                avatar.addEventListener('click', () => mentionUserCallback(displayName));
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
    }
};

