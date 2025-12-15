/**
 * 🔔 LEVEL NOTIFIER
 * Sistema de notificações de XP e Level Up com efeitos especiais
 */

import { Logger } from '../logger.js';
import { getTierConfig, getMilestoneReward } from './definitions.js';

export const LevelNotifier = {
    // Evitar notificações duplicadas
    notifiedThisSession: new Set(),
    
    // Fila de notificações para evitar sobreposição
    notificationQueue: [],
    isProcessingQueue: false,

    /**
     * Notifica ganho de XP (toast simples)
     */
    notifyXPGain(xpAmount, reason, userName) {
        const key = `xp:${userName}:${Date.now()}`;
        
        this.showXPToast(xpAmount, reason);
    },

    /**
     * Notifica level up com efeitos especiais
     */
    async notifyLevelUp(levelUpData, userName) {
        const { level, rank, milestone } = levelUpData;
        
        // Evitar duplicatas
        const sessionKey = `levelup:${userName}:${level}`;
        if (this.notifiedThisSession.has(sessionKey)) return;
        this.notifiedThisSession.add(sessionKey);
        
        // Adicionar à fila
        this.notificationQueue.push({
            type: 'levelup',
            data: { level, rank, milestone },
            userName
        });
        
        this.processQueue();
    },

    /**
     * Processa fila de notificações
     */
    async processQueue() {
        if (this.isProcessingQueue || this.notificationQueue.length === 0) return;
        
        this.isProcessingQueue = true;
        
        while (this.notificationQueue.length > 0) {
            const notification = this.notificationQueue.shift();
            
            if (notification.type === 'levelup') {
                await this.showLevelUpModal(notification.data);
            }
            
            // Delay entre notificações
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        this.isProcessingQueue = false;
    },

    /**
     * Mostra toast de XP ganho
     */
    showXPToast(xpAmount, reason) {
        const container = this.getToastContainer();
        
        const toast = document.createElement('div');
        toast.className = 'xp-toast';
        toast.innerHTML = `
            <div class="xp-toast-content">
                <span class="xp-toast-icon">⚡</span>
                <span class="xp-toast-amount">+${xpAmount} XP</span>
                <span class="xp-toast-reason">${reason}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Animação de entrada
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Remover após 2 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },

    /**
     * Mostra modal de level up com efeitos épicos
     */
    async showLevelUpModal(data) {
        const { level, rank, milestone } = data;
        const tierConfig = getTierConfig(rank.tier);
        
        // Criar overlay
        const overlay = document.createElement('div');
        overlay.className = 'level-up-overlay';
        overlay.innerHTML = `
            <div class="level-up-modal tier-${rank.tier} ${tierConfig.animated ? 'animated' : ''}">
                <div class="level-up-particles"></div>
                <div class="level-up-glow"></div>
                
                <div class="level-up-content">
                    <div class="level-up-header">
                        <span class="level-up-label">🎉 LEVEL UP!</span>
                    </div>
                    
                    <div class="level-up-level">
                        <span class="level-number">${level}</span>
                    </div>
                    
                    <div class="level-up-rank" style="background: ${tierConfig.gradient}; box-shadow: ${tierConfig.glow}">
                        <span class="rank-icon">${rank.icon}</span>
                        <span class="rank-name">${rank.name}</span>
                    </div>
                    
                    <div class="level-up-tier">
                        <span class="tier-badge" style="color: ${tierConfig.color}">${tierConfig.name}</span>
                    </div>
                    
                    ${milestone ? `
                        <div class="level-up-milestone">
                            <span class="milestone-badge">${milestone.badge}</span>
                            <span class="milestone-title">${milestone.title}</span>
                            <span class="milestone-bonus">+${milestone.bonus} XP Bônus!</span>
                        </div>
                    ` : ''}
                    
                    <button class="level-up-close">Continuar ✨</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Som de level up
        this.playLevelUpSound(rank.tier);
        
        // Animação de entrada
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
        
        // Fechar ao clicar
        return new Promise(resolve => {
            const closeBtn = overlay.querySelector('.level-up-close');
            const close = () => {
                overlay.classList.remove('show');
                overlay.classList.add('hide');
                setTimeout(() => {
                    overlay.remove();
                    resolve();
                }, 500);
            };
            
            closeBtn.addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });
            
            // Auto-fechar após 8 segundos
            setTimeout(close, 8000);
        });
    },

    /**
     * Obtém ou cria container de toasts
     */
    getToastContainer() {
        let container = document.getElementById('xpToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'xpToastContainer';
            container.className = 'xp-toast-container';
            document.body.appendChild(container);
        }
        return container;
    },

    /**
     * Toca som de level up
     */
    playLevelUpSound(tier) {
        if (typeof AudioContext === 'undefined' && typeof webkitAudioContext === 'undefined') {
            return;
        }
        
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioContextClass();
            
            // Notas musicais para level up (fanfarra épica)
            const notes = {
                bronze: [261.63, 329.63, 392.00, 523.25],
                silver: [293.66, 369.99, 440.00, 587.33],
                gold: [329.63, 415.30, 493.88, 659.25],
                platinum: [349.23, 440.00, 523.25, 698.46],
                diamond: [392.00, 493.88, 587.33, 783.99],
                master: [440.00, 554.37, 659.25, 880.00],
                divine: [523.25, 659.25, 783.99, 1046.50, 1318.51]
            };
            
            const tierNotes = notes[tier] || notes.bronze;
            
            tierNotes.forEach((freq, i) => {
                setTimeout(() => {
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    
                    oscillator.type = 'sine';
                    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
                    
                    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                    
                    oscillator.start(audioCtx.currentTime);
                    oscillator.stop(audioCtx.currentTime + 0.5);
                }, i * 150);
            });
        } catch (error) {
            Logger.debug('Erro ao tocar som de level up:', error);
        }
    },

    /**
     * Mostra animação de XP flutuante no elemento
     */
    showFloatingXP(element, xpAmount) {
        if (!element) return;
        
        const rect = element.getBoundingClientRect();
        const floating = document.createElement('div');
        floating.className = 'floating-xp';
        floating.textContent = `+${xpAmount} XP`;
        floating.style.left = `${rect.left + rect.width / 2}px`;
        floating.style.top = `${rect.top}px`;
        
        document.body.appendChild(floating);
        
        requestAnimationFrame(() => {
            floating.classList.add('animate');
        });
        
        setTimeout(() => floating.remove(), 1500);
    }
};
