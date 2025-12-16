/**
 * CHAT AVATARS MODULE
 * Gerencia avatares, fotos de perfil e cores
 */

import { normalizeUsername } from './utils.js';
import { Utils } from '../utils.js';

export const ChatAvatars = {
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
     * Verifica se o membro tem foto de perfil
     */
    getMemberPhoto(name) {
        if (!name) return null;
        const normalizedName = normalizeUsername(name);
        
        // Tentar match exato primeiro
        for (const [key, photo] of Object.entries(this.memberPhotos)) {
            const normalizedKey = normalizeUsername(key);
            if (normalizedName === normalizedKey || 
                normalizedName.includes(normalizedKey) || 
                normalizedKey.includes(normalizedName)) {
                return photo;
            }
        }
        return null;
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
    }
};


