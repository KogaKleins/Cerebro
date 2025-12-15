/**
 * 🔔 ACHIEVEMENT NOTIFIER
 * Sistema de notificações de conquistas com efeitos especiais por raridade
 */

import { Notifications } from '../notifications.js';
import { Logger } from '../logger.js';
import { RARITY_CONFIG } from './definitions.js';

export const AchievementNotifier = {
    // Conquistas notificadas nesta sessão (evitar duplicatas)
    notifiedThisSession: new Set(),

    /**
     * Notifica conquistas desbloqueadas com efeitos especiais por raridade
     */
    async notify(achievements, userName) {
        for (const { id, achievement } of achievements) {
            // Evitar notificar duas vezes na mesma sessão
            const sessionKey = `${userName}:${id}`;
            if (this.notifiedThisSession.has(sessionKey)) continue;

            const rarity = achievement.rarity || 'common';
            const rarityConfig = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;

            Logger.info(`🔔 Notificando ${achievement.name} (${rarityConfig.name}) para ${userName}`);
            
            // Notificação customizada baseada na raridade
            await this.showAchievementToast(achievement, rarity, rarityConfig);

            this.notifiedThisSession.add(sessionKey);
            
            // Delay entre notificações para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    },

    /**
     * Mostra toast de conquista com estilo baseado na raridade
     */
    async showAchievementToast(achievement, rarity, rarityConfig) {
        // Criar elemento de toast personalizado
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `achievement-toast-special rarity-${rarity}`;
        
        // Efeitos especiais para conquistas raras
        let specialEffects = '';
        if (rarity === 'legendary' || rarity === 'platinum') {
            specialEffects = '<div class="achievement-particles"></div>';
        }
        
        toast.innerHTML = `
            ${specialEffects}
            <div class="achievement-toast-header">
                <span class="achievement-toast-rarity" style="background: ${rarityConfig.gradient}; box-shadow: ${rarityConfig.glow}">
                    ${rarityConfig.name}
                </span>
                <span class="achievement-toast-points">+${rarityConfig.points} pts</span>
            </div>
            <div class="achievement-toast-body">
                <div class="achievement-toast-icon ${rarity === 'platinum' ? 'platinum-shine' : ''}">${achievement.icon}</div>
                <div class="achievement-toast-info">
                    <h4>🎉 Conquista Desbloqueada!</h4>
                    <p class="achievement-toast-name">${achievement.name}</p>
                    <p class="achievement-toast-desc">${achievement.description}</p>
                </div>
            </div>
        `;
        
        // Adicionar ao container
        toastContainer.appendChild(toast);
        
        // Som de notificação (se disponível)
        this.playSound(rarity);
        
        // Animação de entrada
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Duração maior para conquistas raras
        const duration = rarity === 'platinum' ? 6000 : 
                        rarity === 'legendary' ? 5000 : 
                        rarity === 'epic' ? 4000 : 3000;
        
        // Remover após duração
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 500);
        }, duration);
    },
    
    /**
     * Cria container de toasts se não existir
     */
    createToastContainer() {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    },
    
    /**
     * Toca som de notificação baseado na raridade
     */
    playSound(rarity) {
        // Verificar se o navegador suporta Web Audio API
        if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
            return;
        }
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Frequências diferentes por raridade
            const frequencies = {
                common: [440, 550],
                rare: [523, 659, 784],
                epic: [523, 659, 784, 880],
                legendary: [440, 554, 659, 880, 1047],
                platinum: [523, 659, 784, 1047, 1319]
            };
            
            const freqs = frequencies[rarity] || frequencies.common;
            
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            
            // Tocar notas em sequência
            freqs.forEach((freq, i) => {
                setTimeout(() => {
                    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
                }, i * 100);
            });
            
            // Fade out
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + freqs.length * 0.1 + 0.5);
            
            setTimeout(() => {
                oscillator.stop();
                audioCtx.close();
            }, freqs.length * 100 + 600);
            
        } catch (e) {
            // Silenciosamente ignorar erros de áudio
            Logger.debug('Erro ao reproduzir som de conquista:', e);
        }
    },

    /**
     * Marca conquista como notificada no storage
     */
    markAsNotified(allAchievements, userName, achievementId) {
        if (!allAchievements[userName]) return;
        if (!allAchievements[userName][achievementId]) return;
        
        allAchievements[userName][achievementId].notified = true;
    },

    /**
     * Obtém conquistas não notificadas
     */
    getUnnotified(allAchievements, userName) {
        const userAchievements = allAchievements[userName] || {};
        const unnotified = [];

        for (const [id, data] of Object.entries(userAchievements)) {
            if (!data.notified) {
                unnotified.push(id);
            }
        }

        return unnotified;
    },

    /**
     * Limpa cache de sessão
     */
    clearSessionCache() {
        this.notifiedThisSession.clear();
        Logger.debug('Cache de notificações limpo');
    }
};
