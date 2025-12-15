/**
 * MAIN APPLICATION FILE
 * Initializes and coordinates all modules
 */

import { Auth } from './auth.js';
import { Navigation } from './navigation.js';
import { Coffee } from './coffee.js';
import { Chat } from './chat.js';
import { User } from './user.js';
import { Quotes } from './quotes.js';
import { EasterEggs } from './easter-eggs.js';
import { State } from './state.js';
import { Utils } from './utils.js';
import { Theme } from './theme.js';
import { Notifications } from './notifications.js';
import { Logger } from './logger.js';
import { Achievements } from './achievements/index.js';
import { Levels } from './levels/index.js';
import { Lottery } from './lottery.js';
import { Stats } from './stats.js';
import { Preferences } from './preferences.js';
import { Shortcuts } from './shortcuts.js';
import { Admin } from './admin.js';
import { Socket } from './socket.js';

/**
 * Application initialization
 */
class CerebroApp {
    constructor() {
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }
    
    async start() {
        Logger.info('🧠 Cérebro - Iniciando aplicação...');
        
        // Initialize theme first (before any UI)
        Theme.init();
        
        // Register Service Worker for PWA
        this.registerServiceWorker();
        
        // Setup global event delegation first
        this.setupEventDelegation();
        
        // Initialize authentication first
        Auth.init();
        
        // Only initialize other modules if authenticated
        if (Auth.isAuthenticated()) {
            await this.initModules();
        } else {
            // Wait for login, then init modules
            this.waitForLogin();
        }
        
        Logger.success('Cérebro - Aplicação iniciada com sucesso!');
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                Logger.debug('Service Worker registrado:', registration.scope);
            } catch (error) {
                Logger.warn('Service Worker não registrado:', error);
            }
        }
    }
    
    async initModules() {
        // Primeiro, carregar dados do servidor
        await State.init();
        
        // Inicializar WebSocket para tempo real
        Socket.init();
        
        User.init();
        Navigation.init();
        Coffee.init();
        Chat.init();
        Quotes.init();
        EasterEggs.init();
        
        // New modules
        Notifications.init();
        Achievements.init();
        await Levels.init(); // Sistema de níveis
        Stats.init();
        Preferences.init();
        
        // Admin module (only for admins)
        if (Auth.isAdmin()) {
            Admin.init();
        }
        
        // Initialize shortcuts with callbacks
        Shortcuts.init();
        this.setupShortcuts();
        
        // Initialize home page dynamic content
        this.initHomePage();
        
        // Iniciar sincronização periódica (a cada 30 segundos)
        this.startAutoSync();
    }
    
    /**
     * Initialize home page with dynamic content
     */
    initHomePage() {
        this.updateDateTime();
        this.updateHomeActivity();
        this.updateCoffeeStatus();
        this.updateHomeOnlineMembers();
        
        // 🆕 Carregar comunicados e sugestões
        this.loadAnnouncements();
        this.loadMySuggestions();
        this.setupSuggestionForm();
        
        // Update time every minute
        setInterval(() => this.updateDateTime(), 60000);
        
        // Update activity every 2 minutes
        setInterval(() => this.updateHomeActivity(), 120000);
        
        // Update online members every 30 seconds (fallback)
        setInterval(() => this.updateHomeOnlineMembers(), 30000);
        
        // 🔒 NOVA: Atualizar Home quando usuários online mudam via WebSocket
        // Listener para eventos de Socket em tempo real
        if (window.Socket && window.Socket.io) {
            window.Socket.io.on('users:online', (users) => {
                // Atualizar contagem na home quando socket emite
                this.updateHomeOnlineMembers();
            });
            window.Socket.io.on('user:joined', (userName) => {
                this.updateHomeOnlineMembers();
            });
            window.Socket.io.on('user:left', (userName) => {
                this.updateHomeOnlineMembers();
            });
        }
    }
    
    /**
     * Update online members display on home page
     * 🔒 CORRIGIDO: Usar Socket como fonte de verdade
     */
    updateHomeOnlineMembers() {
        // 🔒 Se o Socket tem dados, usar diretamente (fonte de verdade)
        if (window.Socket && window.Socket.currentOnlineUsers && window.Socket.currentOnlineUsers.length > 0) {
            window.Socket.updateHomeOnlineDisplay(window.Socket.currentOnlineUsers);
            return;
        }
        
        const container = document.getElementById('homeOnlineMembers');
        if (!container) return;
        
        // Membros conhecidos do sistema
        const knownMembers = [
            { name: 'Wilmar', photo: null },
            { name: 'Renan', photo: 'membros/renan.jpeg' },
            { name: 'Pedrão', photo: 'membros/pedrao.jpeg' },
            { name: 'Atila', photo: 'membros/Atila.jpeg' },
            { name: 'Chris', photo: 'membros/chris.jpeg' },
            { name: 'Marcus', photo: 'membros/marcus.jpeg' }
        ];
        
        const currentUser = State.getUser();
        const messages = State.getChatMessages() || [];
        const now = Date.now();
        const ONLINE_THRESHOLD = 5 * 60 * 1000; // 5 minutos
        
        // 🔒 CORREÇÃO: Usar dados do WebSocket como fonte prioritária
        // Se Chat.onlineUsers existe, usar dados em tempo real do servidor
        let userActivity = new Map();
        
        if (window.Chat && window.Chat.onlineUsers && window.Chat.onlineUsers.size > 0) {
            // Usar dados do WebSocket (mais confiáveis e em tempo real)
            window.Chat.onlineUsers.forEach((userData, username) => {
                if (userData.status === 'online') {
                    userActivity.set(username.toLowerCase(), now);
                } else if (userData.lastSeen) {
                    userActivity.set(username.toLowerCase(), userData.lastSeen);
                }
            });
        } else {
            // Fallback: Determinar quem está online baseado nas mensagens recentes
            messages.forEach(msg => {
                if (msg.type !== 'system' && msg.author) {
                    const msgTime = new Date(msg.timestamp).getTime();
                    const existing = userActivity.get(msg.author.toLowerCase());
                    if (!existing || msgTime > existing) {
                        userActivity.set(msg.author.toLowerCase(), msgTime);
                    }
                }
            });
        }
        
        // Adicionar usuário atual como online
        if (currentUser) {
            userActivity.set(currentUser.toLowerCase(), now);
        }
        
        // Determinar status de cada membro
        const membersWithStatus = knownMembers.map(member => {
            const lastActivity = userActivity.get(member.name.toLowerCase()) || 0;
            const isOnline = (now - lastActivity) < ONLINE_THRESHOLD;
            const isCurrentUser = currentUser?.toLowerCase() === member.name.toLowerCase();
            
            return {
                ...member,
                isOnline: isOnline || isCurrentUser,
                isCurrentUser,
                lastActivity
            };
        });
        
        // Ordenar: online primeiro, depois usuário atual primeiro
        membersWithStatus.sort((a, b) => {
            if (a.isCurrentUser) return -1;
            if (b.isCurrentUser) return 1;
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return b.lastActivity - a.lastActivity;
        });
        
        const onlineCount = membersWithStatus.filter(m => m.isOnline).length;
        
        // Gerar avatares compactos
        container.innerHTML = membersWithStatus.map(member => {
            const initials = this.getInitials(member.name);
            const color = this.getAvatarColor(member.name);
            const statusClass = member.isOnline ? '' : 'offline';
            const displayName = member.isCurrentUser ? 'Você' : member.name;
            
            if (member.photo) {
                return `
                    <div class="status-member-avatar ${statusClass}" title="${displayName}">
                        <img src="${member.photo}" alt="${member.name}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <span style="display:none; background:${color}; width:100%; height:100%; align-items:center; justify-content:center;">${initials}</span>
                        <span class="status-member-tooltip">${displayName}</span>
                    </div>
                `;
            } else {
                return `
                    <div class="status-member-avatar ${statusClass}" style="background:${color}" title="${displayName}">
                        ${initials}
                        <span class="status-member-tooltip">${displayName}</span>
                    </div>
                `;
            }
        }).join('');
        
        // 🔒 CORREÇÃO: Atualizar contador sem duplicação
        let counter = container.parentElement.querySelector('.status-online-count');
        if (!counter) {
            // Criar contador se não existir
            container.insertAdjacentHTML('afterend', 
                `<span class="status-online-count" id="homeOnlineCount">${onlineCount} online</span>`
            );
        } else {
            // Atualizar contador existente (evita duplicação)
            counter.textContent = `${onlineCount} online`;
        }
        
        // Remover contadores duplicados se houver (fallback de segurança)
        const counters = container.parentElement.querySelectorAll('.status-online-count');
        if (counters.length > 1) {
            for (let i = 1; i < counters.length; i++) {
                counters[i].remove();
            }
        }
    }
    
    /**
     * Get initials from name
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
    
    /**
     * Get consistent avatar color based on name
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
            'linear-gradient(135deg, #6f4e37 0%, #8b7355 100%)'
        ];
        
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        return colors[Math.abs(hash) % colors.length];
    }
    
    /**
     * Update date and time on home page
     */
    updateDateTime() {
        const now = new Date();
        
        // Update date
        const dateEl = document.getElementById('todayDate');
        const weekdayEl = document.getElementById('todayWeekday');
        const timeEl = document.getElementById('currentTime');
        
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        }
        
        if (weekdayEl) {
            const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            weekdayEl.textContent = weekdays[now.getDay()];
        }
        
        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    /**
     * Update coffee status on home page
     */
    updateCoffeeStatus() {
        const statusEl = document.getElementById('coffeeStatus');
        const labelEl = document.getElementById('coffeeStatusLabel');
        
        if (!statusEl || !labelEl) return;
        
        const coffeeMade = State.getCoffeeMade();
        const today = new Date().toDateString();
        
        // Check if coffee was made today - buscar todos os cafés de hoje
        const todayCoffees = coffeeMade.filter(c => {
            const coffeeDate = new Date(c.date);
            return coffeeDate.toDateString() === today;
        });
        
        if (todayCoffees.length > 0) {
            // Pegar o mais recente de hoje
            const latestToday = todayCoffees.reduce((latest, current) => {
                return new Date(current.date) > new Date(latest.date) ? current : latest;
            });
            
            statusEl.textContent = '✅';
            labelEl.textContent = `Último: ${latestToday.name}`;
            statusEl.parentElement.classList.add('coffee-ready');
        } else {
            statusEl.textContent = '❓';
            labelEl.textContent = 'Sem café hoje...';
            statusEl.parentElement.classList.remove('coffee-ready');
        }
    }
    
    /**
     * Update recent activity timeline
     */
    updateHomeActivity() {
        const container = document.getElementById('activityTimeline');
        if (!container) return;
        
        const activities = [];
        
        // Get recent coffee activities
        const coffeeMade = State.getCoffeeMade().slice(0, 5);
        const coffeeBrought = State.getCoffeeBrought().slice(0, 5);
        const messages = State.getChatMessages().slice(0, 5);
        
        // Add coffee made activities
        coffeeMade.forEach(c => {
            activities.push({
                type: 'coffee-made',
                icon: 'fa-mug-hot',
                text: `${c.name} fez café`,
                time: new Date(c.date),
                color: '#6F4E37'
            });
        });
        
        // Add coffee brought activities
        coffeeBrought.forEach(c => {
            activities.push({
                type: 'coffee-brought',
                icon: 'fa-shopping-bag',
                text: `${c.name} trouxe café`,
                time: new Date(c.date),
                color: '#27ae60'
            });
        });
        
        // Add chat activities
        messages.forEach(m => {
            activities.push({
                type: 'message',
                icon: 'fa-comment',
                text: `${m.author}: "${m.text.substring(0, 30)}${m.text.length > 30 ? '...' : ''}"`,
                time: new Date(m.timestamp),
                color: '#3498db'
            });
        });
        
        // Sort by time (most recent first)
        activities.sort((a, b) => b.time - a.time);
        
        // Take only first 8
        const recentActivities = activities.slice(0, 8);
        
        if (recentActivities.length === 0) {
            container.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon"><i class="fas fa-inbox"></i></div>
                    <div class="activity-content">
                        <span class="activity-text">Nenhuma atividade recente</span>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon" style="background: ${activity.color}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <span class="activity-text">${this.escapeHtml(activity.text)}</span>
                    <span class="activity-time">${this.formatTimeAgo(activity.time)}</span>
                </div>
            </div>
        `).join('');
    }
    
    /**
     * Format time as "X minutes ago"
     */
    formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        if (seconds < 60) return 'Agora mesmo';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min atrás`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} dias atrás`;
        
        return date.toLocaleDateString('pt-BR');
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupShortcuts() {
        // Navigation shortcuts
        Shortcuts.register('navigate', (shortcut) => {
            Navigation.showPage(shortcut.page);
        });
        
        // Coffee shortcuts
        Shortcuts.register('newCoffee', () => Coffee.openModal('made'));
        Shortcuts.register('broughtCoffee', () => Coffee.openModal('brought'));
        Shortcuts.register('lottery', () => Lottery.openModal());
        
        // Theme toggle
        Shortcuts.register('toggleTheme', () => Theme.toggle());
        
        // Preferences
        Shortcuts.register('preferences', () => Preferences.openModal());
        
        // Chat
        Shortcuts.register('sendMessage', () => Chat.send());
        
        // Modals
        Shortcuts.register('closeModal', () => {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        });
        
        // Help
        Shortcuts.register('showHelp', () => Shortcuts.showHelp());
    }
    
    /**
     * Setup event delegation for all interactive elements
     * This removes the need for inline onclick handlers
     */
    setupEventDelegation() {
        document.addEventListener('click', async (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            
            const action = target.dataset.action;
            const params = target.dataset;
            
            switch (action) {
                // Coffee actions
                case 'openCoffeeModal':
                    Coffee.openModal(params.type);
                    break;
                case 'closeCoffeeModal':
                    Coffee.closeModal();
                    break;
                case 'registerCoffee':
                    await this.handleAsyncAction(target, async () => {
                        await Coffee.register();
                        // Notify others
                        Notifications.notifyCoffee(State.getUser());
                    });
                    break;
                case 'showRanking':
                    // Update tabs UI
                    document.querySelectorAll('.ranking-tabs .tab-btn').forEach(tab => tab.classList.remove('active'));
                    target.classList.add('active');
                    Coffee.showRanking(params.type);
                    break;
                    
                // 🆕 Handler centralizado para cliques no histórico
                case 'handleHistoryClick':
                    Coffee.handleHistoryClick(params.coffeeId, params.makerName, params.clickReason, params.actionType);
                    break;
                    
                case 'openRatingModal':
                    Coffee.openRatingModal(params.coffeeId, params.makerName);
                    break;
                case 'closeRatingModal':
                    Coffee.closeRatingModal();
                    break;
                case 'setModalRating':
                    Coffee.setModalRating(parseInt(params.value));
                    break;
                case 'submitRating':
                    await this.handleAsyncAction(target, async () => {
                        await Coffee.submitRating();
                    });
                    break;
                case 'rateTodayCoffee':
                    // 🆕 CORREÇÃO: Handler para avaliação rápida na home
                    await this.handleAsyncAction(target, async () => {
                        await Coffee.rateCoffee(parseInt(params.stars));
                    });
                    break;
                
                // 🆕 Toggle expandir histórico
                case 'toggleHistoryExpand':
                    Coffee.toggleHistoryExpand();
                    break;
                
                // PDF Manual actions
                case 'openPdfModal':
                    this.openPdfModal();
                    break;
                case 'closePdfModal':
                    this.closePdfModal();
                    break;
                    
                // Chat actions
                case 'sendMessage':
                    await this.handleAsyncAction(target, async () => {
                        await Chat.send();
                    });
                    break;
                case 'replyToMessage':
                    e.preventDefault();
                    e.stopPropagation();
                    Chat.replyToMessage(params.messageId);
                    break;
                case 'copyMessage':
                    e.preventDefault();
                    e.stopPropagation();
                    await Chat.copyMessage(params.messageId);
                    break;
                case 'toggleReactionPicker':
                    e.preventDefault();
                    e.stopPropagation();
                    Chat.toggleReactionPicker(params.messageId);
                    break;
                case 'addReaction':
                    e.preventDefault();
                    e.stopPropagation();
                    await Chat.addReaction(params.messageId, params.reaction);
                    break;
                case 'toggleReaction':
                    e.preventDefault();
                    e.stopPropagation();
                    await Chat.toggleReaction(params.messageId, params.reaction);
                    break;
                case 'clearChatSearch':
                    Chat.clearSearch();
                    break;
                    
                // Quote actions
                case 'changeQuote':
                    Quotes.change();
                    // Add rotation animation to icon
                    const icon = target.querySelector('i');
                    if (icon) {
                        icon.style.animation = 'spin 0.5s ease';
                        setTimeout(() => icon.style.animation = '', 500);
                    }
                    break;
                    
                // User actions
                case 'setUsername':
                    User.setUsername();
                    break;
                    
                // Auth actions
                case 'logout':
                    Auth.logout();
                    break;
                case 'clearData':
                    const confirmed = await Utils.confirm({
                        title: 'Limpar Todos os Dados',
                        message: 'Esta ação irá apagar TODOS os dados do sistema: histórico de café, mensagens do chat e avaliações. Esta ação não pode ser desfeita!',
                        type: 'danger',
                        confirmText: 'Sim, Limpar Tudo',
                        cancelText: 'Cancelar'
                    });
                    if (confirmed) {
                        await Auth.clearAllData();
                    }
                    break;
                
                // Theme actions
                case 'toggleTheme':
                    Theme.toggle();
                    break;
                
                // Notification actions
                case 'toggleNotifications':
                    Notifications.toggle();
                    break;
                
                // Lottery actions
                case 'openLotteryModal':
                    Lottery.openModal();
                    break;
                case 'closeLotteryModal':
                    Lottery.closeModal();
                    break;
                case 'spinLottery':
                    await Lottery.spin();
                    break;
                
                // Special Items actions
                case 'openSpecialItemModal':
                    Coffee.openSpecialItemModal();
                    break;
                case 'closeSpecialItemModal':
                    Coffee.closeSpecialItemModal();
                    break;
                case 'selectSpecialItem':
                    const itemKey = target.dataset.item || target.closest('[data-item]')?.dataset.item;
                    if (itemKey) {
                        Coffee.selectSpecialItem(itemKey);
                    }
                    break;
                case 'registerSpecialItem':
                    await Coffee.registerSpecialItem();
                    break;
                
                // Preferences actions
                case 'openPreferencesModal':
                    Preferences.openModal();
                    break;
                case 'closePreferencesModal':
                    Preferences.closeModal();
                    break;
                case 'savePreferences':
                    Preferences.saveFromForm();
                    break;
                
                // Shortcuts help
                case 'openShortcutsModal':
                    Shortcuts.showHelp();
                    break;
                case 'closeShortcutsModal':
                    Shortcuts.closeHelp();
                    break;
                
                // Stats period change
                case 'changePeriod':
                    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
                    target.classList.add('active');
                    Stats.updateDashboard();
                    break;

                // Home page quick actions
                case 'quickCoffee':
                    Coffee.openModal('made');
                    break;
                case 'goToChat':
                    Navigation.showPage('chat');
                    break;
                case 'goToStats':
                    Navigation.showPage('stats');
                    break;
                case 'refreshActivity':
                    this.updateHomeActivity();
                    Utils.showToast('Atividades atualizadas!', 'success');
                    break;
                    
                // 🆕 Sugestões
                case 'submitSuggestion':
                    await this.handleAsyncAction(target, async () => {
                        if (typeof window.submitSuggestion === 'function') {
                            await window.submitSuggestion();
                        } else {
                            console.error('submitSuggestion não está definido');
                            Utils.showToast('Erro interno. Recarregue a página.', 'error');
                        }
                    });
                    break;
                    
                default:
                    console.warn('Ação não reconhecida:', action);
            }
        });
        
        // Handle keyboard events for chat
        document.addEventListener('keypress', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter') {
                Chat.send();
            }
        });
        
        // Close PDF modal on Escape key or clicking outside
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closePdfModal();
            }
        });
        
        // Close PDF modal when clicking on overlay
        const pdfModal = document.getElementById('pdfModal');
        if (pdfModal) {
            pdfModal.addEventListener('click', (e) => {
                if (e.target === pdfModal) {
                    this.closePdfModal();
                }
            });
        }
        
        // Close reaction pickers when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.reaction-picker') && !e.target.closest('[data-action="toggleReactionPicker"]')) {
                document.querySelectorAll('.reaction-picker.active').forEach(p => p.classList.remove('active'));
            }
        });
    }
    
    /**
     * Handle async actions with loading state
     */
    async handleAsyncAction(button, action) {
        if (button.classList.contains('btn-loading')) return;
        
        Utils.setLoading(button, true);
        try {
            await action();
        } catch (error) {
            console.error('Erro na ação:', error);
            Utils.showToast('Ocorreu um erro. Tente novamente.', 'error');
        } finally {
            Utils.setLoading(button, false);
        }
    }
    
    startAutoSync() {
        // Sincronizar chat a cada 15 segundos - usar atualização incremental
        setInterval(async () => {
            if (Auth.isAuthenticated()) {
                await Chat.syncMessages();
            }
        }, 15000);
        
        // Sincronizar dados de café a cada 30 segundos
        setInterval(async () => {
            if (Auth.isAuthenticated()) {
                await State.refreshCoffeeData();
                Coffee.updateStats();
                Coffee.updateHistory();
                Coffee.updateRanking(State.getCoffeeType());
                Coffee.updateHomeStats();
                Coffee.updateTodayCoffee();
                Coffee.updateTopBaristas();
                Stats.updateDashboard();
            }
        }, 30000);
    }
    
    waitForLogin() {
        // Escutar evento customizado de login
        window.addEventListener('cerebroLogin', async (e) => {
            Logger.info('Login detectado, inicializando módulos...');
            await this.initModules();
        }, { once: true });
    }
    
    openPdfModal() {
        // URL do PDF - usar caminho relativo codificado
        const pdfUrl = encodeURI('assets/documents/CAFE 0001 PREPARO DE CAFÉ NO COADOR.pdf');
        
        // Detecta se é mobile/tablet
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                         || window.innerWidth <= 768
                         || ('ontouchstart' in window);
        
        if (isMobile) {
            // Em mobile, criar um link temporário e clicar nele
            // Isso contorna bloqueios de popup em navegadores móveis
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            // Para iOS Safari, usar download como fallback
            const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (isIOS) {
                // iOS tem problemas com PDFs - abrir via Google Docs Viewer ou download
                link.setAttribute('download', 'Manual-Cafe-POP.pdf');
            }
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            Utils.showToast('Abrindo o Manual do Café... 📖', 'success');
            return;
        }
        
        // Em desktop, usa o modal com iframe
        const modal = document.getElementById('pdfModal');
        const iframe = document.getElementById('pdfViewer');
        const loading = document.getElementById('pdfLoading');
        
        // Show modal
        modal.classList.add('active');
        
        // Reset loading state
        loading.classList.remove('hidden');
        
        // Set PDF source
        iframe.src = pdfUrl;
        
        // Hide loading when PDF is loaded
        iframe.onload = () => {
            loading.classList.add('hidden');
        };
        
        // Fallback timeout to hide loading
        setTimeout(() => {
            loading.classList.add('hidden');
        }, 3000);
    }
    
    closePdfModal() {
        const modal = document.getElementById('pdfModal');
        const iframe = document.getElementById('pdfViewer');
        
        modal.classList.remove('active');
        
        // Clear iframe src to stop any loading
        setTimeout(() => {
            iframe.src = '';
        }, 300);
    }

    // ============================================
    // 🆕 COMUNICADOS (ANNOUNCEMENTS)
    // ============================================

    async loadAnnouncements() {
        const { Api } = await import('./api.js');
        const container = document.getElementById('announcementsContent');
        const countBadge = document.getElementById('announcementsCount');
        const emptyState = document.getElementById('announcementsEmpty');
        
        if (!container) return;
        
        try {
            const result = await Api.getAnnouncements(5);
            
            if (!result || !result.announcements || result.announcements.length === 0) {
                container.innerHTML = '';
                if (emptyState) emptyState.style.display = 'flex';
                if (countBadge) countBadge.textContent = '0';
                return;
            }
            
            if (emptyState) emptyState.style.display = 'none';
            if (countBadge) countBadge.textContent = result.announcements.length;
            
            container.innerHTML = result.announcements.map(ann => {
                const priorityClass = `priority-${ann.priority.toLowerCase()}`;
                const priorityIcon = this.getAnnouncementIcon(ann.priority);
                const date = new Date(ann.createdAt).toLocaleDateString('pt-BR');
                
                return `
                    <div class="announcement-item ${priorityClass}">
                        <div class="announcement-item-header">
                            <span class="announcement-title">
                                <i class="${priorityIcon}"></i>
                                ${this.escapeHtml(ann.title)}
                            </span>
                            ${ann.priority === 'URGENT' || ann.priority === 'HIGH' ? 
                                `<span class="announcement-priority-badge ${ann.priority.toLowerCase()}">${ann.priority === 'URGENT' ? 'Urgente' : 'Alta'}</span>` : ''}
                        </div>
                        <div class="announcement-content">${this.escapeHtml(ann.content)}</div>
                        <div class="announcement-meta">
                            <span><i class="fas fa-user"></i> ${ann.author.name}</span>
                            <span><i class="fas fa-calendar"></i> ${date}</span>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Erro ao carregar comunicados:', error);
            container.innerHTML = `
                <div class="announcement-loading">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Erro ao carregar comunicados</span>
                </div>
            `;
        }
    }

    getAnnouncementIcon(priority) {
        switch (priority) {
            case 'URGENT': return 'fas fa-exclamation-circle';
            case 'HIGH': return 'fas fa-exclamation-triangle';
            case 'NORMAL': return 'fas fa-info-circle';
            case 'LOW': return 'fas fa-comment';
            default: return 'fas fa-bullhorn';
        }
    }

    // ============================================
    // 🆕 SUGESTÕES (SUGGESTIONS)
    // ============================================

    async loadMySuggestions() {
        const { Api } = await import('./api.js');
        const container = document.getElementById('mySuggestionsList');
        const section = document.getElementById('mySuggestions');
        
        if (!container || !section) return;
        
        try {
            const result = await Api.getMySuggestions();
            
            if (!result || !result.suggestions || result.suggestions.length === 0) {
                section.style.display = 'none';
                return;
            }
            
            section.style.display = 'block';
            
            container.innerHTML = result.suggestions.slice(0, 5).map(sug => {
                const date = new Date(sug.createdAt).toLocaleDateString('pt-BR');
                const statusLabel = this.getSuggestionStatusLabel(sug.status);
                
                return `
                    <div class="my-suggestion-item">
                        <div class="my-suggestion-info">
                            <div class="my-suggestion-title">${this.escapeHtml(sug.title)}</div>
                            <div class="my-suggestion-date">${date}</div>
                        </div>
                        <span class="my-suggestion-status ${sug.status.toLowerCase()}">${statusLabel}</span>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            console.error('Erro ao carregar minhas sugestões:', error);
            section.style.display = 'none';
        }
    }

    getSuggestionStatusLabel(status) {
        const labels = {
            'PENDING': 'Pendente',
            'REVIEWING': 'Em Análise',
            'APPROVED': 'Aprovada',
            'REJECTED': 'Rejeitada',
            'IMPLEMENTED': 'Implementada'
        };
        return labels[status] || status;
    }

    setupSuggestionForm() {
        const titleInput = document.getElementById('suggestionTitle');
        const contentTextarea = document.getElementById('suggestionContent');
        const charCount = document.getElementById('suggestionCharCount');
        
        if (contentTextarea && charCount) {
            contentTextarea.addEventListener('input', () => {
                charCount.textContent = contentTextarea.value.length;
            });
        }
        
        // Referência à instância para uso no closure
        const self = this;
        
        // Expor função global para enviar sugestão
        window.submitSuggestion = async () => {
            const { Api } = await import('./api.js');
            const title = titleInput?.value?.trim();
            const content = contentTextarea?.value?.trim();
            
            // Validações robustas
            if (!title || !content) {
                Utils.showToast('Preencha o título e a descrição da sugestão', 'warning');
                return;
            }
            
            if (title.length < 5) {
                Utils.showToast('O título deve ter pelo menos 5 caracteres', 'warning');
                return;
            }
            
            if (title.length > 100) {
                Utils.showToast('O título deve ter no máximo 100 caracteres', 'warning');
                return;
            }
            
            if (content.length < 10) {
                Utils.showToast('A descrição deve ter pelo menos 10 caracteres', 'warning');
                return;
            }
            
            if (content.length > 2000) {
                Utils.showToast('A descrição deve ter no máximo 2000 caracteres', 'warning');
                return;
            }
            
            try {
                const result = await Api.createSuggestion({ title, content });
                
                if (result && result.success) {
                    Utils.showToast('💡 Sugestão enviada com sucesso!', 'success');
                    titleInput.value = '';
                    contentTextarea.value = '';
                    if (charCount) charCount.textContent = '0';
                    // Recarregar lista de sugestões
                    await self.loadMySuggestions();
                } else {
                    throw new Error(result?.error || 'Erro ao enviar sugestão');
                }
            } catch (error) {
                console.error('Erro ao enviar sugestão:', error);
                Utils.showToast('❌ ' + (error.message || 'Erro ao enviar sugestão'), 'error');
            }
        };
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Start the application
new CerebroApp();

// Expor funções para o painel de administração
window.adminChangeTab = (tab) => Admin.changeTab(tab);

// Note: Window exports removed - using data-action attributes instead
