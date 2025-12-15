/**
 * NOTIFICATIONS MODULE
 * Handles browser push notifications
 */

export const Notifications = {
    permission: 'default',
    enabled: false,
    
    async init() {
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.log('❌ Notificações não suportadas neste navegador');
            return false;
        }
        
        // Load saved preference
        this.enabled = localStorage.getItem('cerebroNotifications') === 'true';
        this.permission = Notification.permission;
        
        // If previously enabled, make sure we still have permission
        if (this.enabled && this.permission !== 'granted') {
            this.enabled = false;
            localStorage.setItem('cerebroNotifications', 'false');
        }
        
        return this.enabled;
    },
    
    async requestPermission() {
        if (!('Notification' in window)) {
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                this.enabled = true;
                localStorage.setItem('cerebroNotifications', 'true');
                this.show('🔔 Notificações Ativadas!', {
                    body: 'Você receberá alertas sobre café e mensagens.',
                    icon: '☕'
                });
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Erro ao solicitar permissão:', error);
            return false;
        }
    },
    
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.requestPermission();
        }
    },
    
    disable() {
        this.enabled = false;
        localStorage.setItem('cerebroNotifications', 'false');
    },
    
    isEnabled() {
        return this.enabled && this.permission === 'granted';
    },
    
    show(title, options = {}) {
        if (!this.isEnabled()) return;
        
        const defaultOptions = {
            icon: '🧠',
            badge: '🧠',
            vibrate: [200, 100, 200],
            tag: 'cerebro-notification',
            renotify: true,
            ...options
        };
        
        try {
            const notification = new Notification(title, defaultOptions);
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            
            // Auto close after 5 seconds
            setTimeout(() => notification.close(), 5000);
            
            return notification;
        } catch (error) {
            console.error('Erro ao mostrar notificação:', error);
        }
    },
    
    // Specific notification types
    notifyCoffee(makerName) {
        this.show('☕ Café Novo!', {
            body: `${makerName} acabou de fazer café fresquinho!`,
            tag: 'coffee-made'
        });
    },
    
    notifyCoffeeBrought(bringerName) {
        this.show('🛒 Café Chegou!', {
            body: `${bringerName} trouxe café novo para o setor!`,
            tag: 'coffee-brought'
        });
    },
    
    notifyMessage(authorName, preview) {
        this.show(`💬 ${authorName}`, {
            body: preview.substring(0, 100) + (preview.length > 100 ? '...' : ''),
            tag: 'chat-message'
        });
    },
    
    notifyAchievement(achievementName, achievementIcon) {
        this.show('🏆 Conquista Desbloqueada!', {
            body: `${achievementIcon} ${achievementName}`,
            tag: 'achievement'
        });
    },
    
    notifyMention(authorName) {
        this.show('📢 Você foi mencionado!', {
            body: `${authorName} mencionou você no chat`,
            tag: 'mention'
        });
    }
};
