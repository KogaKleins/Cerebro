/**
 * 🏆 ACHIEVEMENTS MODULE - Refatorado
 * Sistema profissional de gamificação com conquistas
 * 
 * Arquitetura modular:
 * - definitions.js: Definições de conquistas
 * - storage.js: Persistência (API + localStorage)
 * - checker.js: Lógica de verificação
 * - notifier.js: Sistema de notificações
 * - index.js: API pública (este arquivo)
 */

import { achievementDefinitions, getAchievementsByCategory, getAchievementById, RARITY_CONFIG, updateRarityPointsFromConfig } from './definitions.js';
import { AchievementStorage } from './storage.js';
import { AchievementChecker } from './checker.js';
import { AchievementNotifier } from './notifier.js';
import { Logger } from '../logger.js';
import { State } from '../state.js';

export const Achievements = {
    // Definições de conquistas
    definitions: achievementDefinitions,

    // Conquistas de todos os usuários
    // Estrutura: { userName: { achievementId: { unlockedAt, metadata, notified } } }
    allAchievements: {},
    
    // Cache da config de XP do servidor
    cachedXPConfig: null,

    /**
     * Inicializa o sistema de conquistas
     */
    async init() {
        Logger.info('Inicializando sistema de conquistas...');
        
        // 🔧 CORREÇÃO: Carregar config XP do servidor PRIMEIRO
        // para sincronizar pontos de raridade com valores do admin
        await this.loadXPConfigFromServer();
        
        // Carregar conquistas
        this.allAchievements = await AchievementStorage.load();
        
        // Migrar formato antigo se necessário
        if (!AchievementStorage.isNewFormat(this.allAchievements)) {
            const currentUser = State.getUser();
            this.allAchievements = AchievementStorage.migrateOldFormat(
                this.allAchievements,
                currentUser
            );
            await this.saveAchievements();
        }
        
        // Verificar se precisa recalcular APENAS se não houver conquistas salvas
        const coffeeData = State.getCoffeeData();
        const messages = State.getChatMessages();
        const hasData = coffeeData.made.length > 0 || 
                       coffeeData.brought.length > 0 || 
                       messages.length > 0;
        const hasExistingAchievements = Object.keys(this.allAchievements).length > 0;
        if (!hasExistingAchievements && AchievementStorage.needsRecalculation(this.allAchievements, hasData)) {
            Logger.info('Primeira inicialização - recalculando conquistas...');
            await this.recalculateAllAchievements(true);
            AchievementStorage.markRecalculated();
        }
        this.updateDisplay();
        Logger.success('Sistema de conquistas inicializado');
    },
    
    /**
     * 🔧 Carrega configuração de XP do servidor e atualiza RARITY_CONFIG
     */
    async loadXPConfigFromServer() {
        try {
            const { Api } = await import('../api.js');
            const config = await Api.getXPConfig();
            if (config && Object.keys(config).length > 0) {
                this.cachedXPConfig = config;
                // Atualizar RARITY_CONFIG com valores do servidor
                updateRarityPointsFromConfig(config);
                // Salvar no localStorage para fallback
                localStorage.setItem('cerebro-xp-config', JSON.stringify(config));
                Logger.debug('XP Config carregada do servidor para conquistas');
                return config;
            }
        } catch (error) {
            Logger.debug('API de config XP não disponível, usando cache local');
        }
        
        // Fallback para localStorage
        try {
            const saved = localStorage.getItem('cerebro-xp-config');
            if (saved) {
                this.cachedXPConfig = JSON.parse(saved);
                updateRarityPointsFromConfig(this.cachedXPConfig);
            }
        } catch {
            // Ignorar erros de parse
        }
        
        return this.cachedXPConfig;
    },

    /**
     * Verifica conquistas para um usuário
     */
    async checkAchievements(userName, stats = null, metadata = {}) {
        if (!userName) return [];
        
        // Calcular stats se não fornecido
        if (!stats) {
            const coffeeData = State.getCoffeeData();
            const messages = State.getChatMessages();
            const ratingsObj = State.getRatings();
            
            // Converter objeto de ratings para array
            const ratings = this.convertRatingsToArray(ratingsObj);
            
            stats = AchievementChecker.calculateStats(userName, coffeeData, messages, ratings);
        }
        
        // Verificar novas conquistas
        const newUnlocks = AchievementChecker.check(
            userName,
            stats,
            metadata,
            this.allAchievements
        );
        
        // Desbloquear e notificar
        for (const unlock of newUnlocks) {
            this.unlock(unlock.id, userName, unlock.metadata, false); // false = salvar individualmente
        }
        
        return newUnlocks;
    },

    /**
     * Desbloqueia uma conquista
     * @param {boolean} skipSave - Se true, não salva automaticamente (útil para batch operations)
     */
    async unlock(achievementId, userName, metadata = {}, skipSave = false) {
        if (!userName) return false;
        if (this.isUnlocked(achievementId, userName)) return false;
        
        const achievement = this.definitions[achievementId];
        if (!achievement) return false;
        
        // Inicializar estrutura do usuário
        if (!this.allAchievements[userName]) {
            this.allAchievements[userName] = {};
        }
        
        // Salvar conquista
        this.allAchievements[userName][achievementId] = {
            unlockedAt: new Date().toISOString(),
            notified: false,
            metadata: metadata
        };
        
        Logger.success(`Conquista desbloqueada: ${achievement.name} - ${userName}`);
        
        // ========== NOTA CRÍTICA ==========
        // ❌ NÃO ADICIONAR XP AQUI NO FRONTEND!
        // O XP deve ser creditado APENAS no backend via Points Engine
        // O backend já creditca o XP quando desbloqueia a conquista
        // Frontend é APENAS para exibição e notificação
        // Se adicionar XP aqui, vai duplicar: Backend + Frontend = 2x XP!
        // ===================================
        
        // Salvar apenas se não for batch operation
        if (!skipSave) {
            this.saveAchievements();
            this.updateDisplay();
            
            // ⚠️ Notificação ainda é feita aqui
            // Mas deve estar sincronizada com backend
            // Se backend já notificou, não notificar novamente!
            Logger.info('💡 Conquista salva localmente para ${achievement.name}', { userName });
            
            // Opcionalmente notificar de forma discreta
            // AchievementNotifier.notify([{ id: achievementId, achievement }], userName);
        }
        
        return true;
    },

    /**
     * Verifica se uma conquista está desbloqueada
     */
    isUnlocked(achievementId, userName) {
        if (!userName) return false;
        return !!(this.allAchievements[userName]?.[achievementId]);
    },

    /**
     * Obtém conquistas de um usuário
     */
    getUserAchievements(userName) {
        return this.allAchievements[userName] || {};
    },

    /**
     * Salva conquistas
     */
    async saveAchievements() {
        await AchievementStorage.save(this.allAchievements);
    },

    /**
     * Recalcula todas as conquistas retroativamente
     */
    async recalculateAllAchievements(silent = false) {
        Logger.info('Iniciando recalculo de conquistas...');
        
        const coffeeData = State.getCoffeeData();
        const messages = State.getChatMessages();
        const ratingsObj = State.getRatings();
        
        // Converter objeto de ratings para array
        const ratings = this.convertRatingsToArray(ratingsObj);
        
        // Coletar todos os usuários
        const users = new Set();
        coffeeData.made.forEach(c => users.add(c.name));
        coffeeData.brought.forEach(c => users.add(c.name));
        messages.forEach(m => {
            // Mensagens podem ter 'author' ou 'name'
            const userName = m.author || m.name;
            if (userName) users.add(userName);
        });
        ratings.forEach(r => {
            if (r.maker) users.add(r.maker);
            if (r.rater) users.add(r.rater);
        });
        
        // Limpar conquistas antigas
        this.allAchievements = {};
        
        // Recalcular para cada usuário (batch mode - salvar apenas no final)
        let totalUnlocked = 0;
        for (const userName of users) {
            const stats = AchievementChecker.calculateStats(
                userName,
                coffeeData,
                messages,
                ratings
            );
            
            // Verificar conquistas
            const newUnlocks = AchievementChecker.check(
                userName,
                stats,
                {},
                this.allAchievements
            );
            
            // Desbloquear sem salvar (batch mode)
            for (const unlock of newUnlocks) {
                this.unlock(unlock.id, userName, unlock.metadata, true); // true = skip save
                totalUnlocked++;
                
                // Marcar como notificado (não notificar retroativamente)
                if (silent) {
                    AchievementNotifier.markAsNotified(this.allAchievements, userName, unlock.id);
                }
            }
        }
        
        // Salvar tudo de uma vez
        await this.saveAchievements();
        this.updateDisplay();
        
        Logger.success(`Recalculo concluído: ${totalUnlocked} conquistas para ${users.size} usuários`);
        
        return {
            users: Array.from(users),
            totalUnlocked,
            timestamp: Date.now()
        };
    },

    /**
     * Atualiza display de conquistas na UI
     * 🔧 CORREÇÃO: Agora é async para aguardar renderAchievements
     */
    async updateDisplay() {
        const user = State.getUser();
        if (!user) return;
        
        const userAchievements = this.getUserAchievements(user);
        const unlockedCount = Object.keys(userAchievements).length;
        const totalCount = Object.keys(this.definitions).length;
        
        // Atualizar badge de conquistas
        const badge = document.querySelector('[data-page="achievements"] .badge');
        if (badge) {
            badge.textContent = unlockedCount;
        }
        
        // Renderizar conquistas na página (agora async)
        await this.renderAchievements();
        
        Logger.debug(`Conquistas: ${unlockedCount}/${totalCount}`);
    },

    /**
     * 🆕 Cache de stats do servidor para evitar muitas requisições
     */
    cachedServerStats: null,
    cachedServerStatsTime: 0,
    SERVER_STATS_CACHE_TTL: 30000, // 30 segundos

    /**
     * 🆕 Buscar stats do servidor com cache
     */
    async getServerStats(username) {
        const now = Date.now();
        // Usar cache se ainda válido
        if (this.cachedServerStats && (now - this.cachedServerStatsTime) < this.SERVER_STATS_CACHE_TTL) {
            return this.cachedServerStats;
        }
        
        try {
            const { Api } = await import('../api.js');
            const stats = await Api.getAchievementStats(username);
            if (stats) {
                this.cachedServerStats = stats;
                this.cachedServerStatsTime = now;
                Logger.debug('📊 Stats carregados do servidor para progresso', stats);
            }
            return stats;
        } catch (error) {
            Logger.warn('Erro ao buscar stats do servidor, usando cache local', error);
            return null;
        }
    },

    /**
     * 🆕 Invalidar cache de stats (chamar após ações do usuário)
     */
    invalidateStatsCache() {
        this.cachedServerStats = null;
        this.cachedServerStatsTime = 0;
        Logger.debug('🗑️ Cache de stats invalidado');
    },

    /**
     * Renderiza conquistas na página
     * 🔧 CORREÇÃO: Usa stats do servidor quando disponível
     */
    async renderAchievements() {
        const container = document.getElementById('achievementsGrid');
        if (!container) return;
        
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        // 🆕 CORREÇÃO: Tentar buscar stats do servidor PRIMEIRO
        // Isso garante que o progresso seja calculado com dados reais do banco
        let userStats = await this.getServerStats(currentUser);
        
        // Fallback para cálculo local se servidor não disponível
        if (!userStats) {
            const coffeeData = State.getCoffeeData();
            const messages = State.getChatMessages();
            const ratingsObj = State.getRatings();
            const ratings = this.convertRatingsToArray(ratingsObj);
            userStats = AchievementChecker.calculateStats(currentUser, coffeeData, messages, ratings);
            Logger.debug('📊 Usando stats locais (fallback)');
        }
        
        // Agrupar conquistas por categoria
        const byCategory = {};
        for (const [id, achievement] of Object.entries(this.definitions)) {
            if (!byCategory[achievement.category]) {
                byCategory[achievement.category] = [];
            }
            byCategory[achievement.category].push({ id, ...achievement });
        }
        
        // Títulos das categorias
        const categoryTitles = {
            coffee: '☕ Café',
            supply: '🛒 Suprimentos',
            rating: '⭐ Avaliações',
            chat: '💬 Chat',
            special: '✨ Especiais',
            streak: '🔥 Sequências',
            milestone: '🏆 Marcos',
            fun: '🎮 Diversão'
        };
        
        // Calcular estatísticas
        const userAchievements = this.getUserAchievements(currentUser);
        const unlockedCount = Object.keys(userAchievements).length;
        const totalCount = Object.keys(this.definitions).length;
        
        // Calcular pontos totais
        let totalPoints = 0;
        const rarityCount = { common: 0, rare: 0, epic: 0, legendary: 0, platinum: 0 };
        
        for (const [id, data] of Object.entries(userAchievements)) {
            const achievement = this.definitions[id];
            if (achievement) {
                const rarity = achievement.rarity || 'common';
                const points = RARITY_CONFIG[rarity]?.points || 10;
                totalPoints += points;
                rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
            }
        }
        
        // Renderizar estatísticas
        let statsHtml = `
            <div class="achievements-stats">
                <div class="achievement-stat">
                    <span class="achievement-stat-icon">🏆</span>
                    <div class="achievement-stat-info">
                        <span class="achievement-stat-value">${unlockedCount}/${totalCount}</span>
                        <span class="achievement-stat-label">Conquistas</span>
                    </div>
                </div>
                <div class="total-points-display">
                    <i class="fas fa-star"></i>
                    <span>${totalPoints} Pontos</span>
                </div>
            </div>
            <div class="rarity-filters">
                <button class="rarity-filter-btn active" data-rarity="all">Todas</button>
                <button class="rarity-filter-btn" data-rarity="common">Comum (${rarityCount.common || 0})</button>
                <button class="rarity-filter-btn" data-rarity="rare">Raro (${rarityCount.rare || 0})</button>
                <button class="rarity-filter-btn" data-rarity="epic">Épico (${rarityCount.epic || 0})</button>
                <button class="rarity-filter-btn" data-rarity="legendary">Lendário (${rarityCount.legendary || 0})</button>
                <button class="rarity-filter-btn" data-rarity="platinum">Platina (${rarityCount.platinum || 0})</button>
            </div>
        `;
        
        // Renderizar conquistas por categoria
        let html = statsHtml;
        
        for (const [category, achievements] of Object.entries(byCategory)) {
            html += `
                <div class="achievement-category">
                    <h4 class="achievement-category-title">${categoryTitles[category] || category}</h4>
                    <div class="achievements-grid">
            `;
            
            // Ordenar por raridade (mais raras primeiro)
            const rarityOrder = ['platinum', 'legendary', 'epic', 'rare', 'common'];
            achievements.sort((a, b) => {
                const aRarity = rarityOrder.indexOf(a.rarity || 'common');
                const bRarity = rarityOrder.indexOf(b.rarity || 'common');
                return aRarity - bRarity;
            });
            
            for (const achievement of achievements) {
                const isUnlocked = this.isUnlocked(achievement.id, currentUser);
                const unlockedClass = isUnlocked ? 'unlocked' : 'locked';
                const rarity = achievement.rarity || 'common';
                const rarityConfig = RARITY_CONFIG[rarity] || RARITY_CONFIG.common;
                const points = rarityConfig.points;
                const isSecret = achievement.secret;
                
                let unlockedDate = '';
                let progressHtml = '';
                
                if (isUnlocked) {
                    const unlockData = this.allAchievements[currentUser]?.[achievement.id];
                    if (unlockData?.unlockedAt) {
                        const date = new Date(unlockData.unlockedAt);
                        unlockedDate = `<div class="achievement-date">Desbloqueada em ${date.toLocaleDateString('pt-BR')}</div>`;
                    }
                } else if (!isSecret && achievement.requirement) {
                    // Calcular progresso para conquistas não desbloqueadas
                    const progress = this.getAchievementProgress(achievement, userStats);
                    if (progress !== null) {
                        const progressPercent = Math.min(100, (progress.current / progress.target) * 100);
                        progressHtml = `
                            <div class="achievement-progress">
                                <div class="achievement-progress-bar">
                                    <div class="achievement-progress-fill" style="width: ${progressPercent}%"></div>
                                </div>
                                <div class="achievement-progress-text">${progress.current}/${progress.target}</div>
                            </div>
                        `;
                    }
                }
                
                // Para conquistas secretas não desbloqueadas, ocultar info
                const displayName = (isSecret && !isUnlocked) ? '???' : achievement.name;
                const displayDesc = (isSecret && !isUnlocked) ? 'Conquista secreta - Continue explorando!' : achievement.description;
                const displayIcon = (isSecret && !isUnlocked) ? '❓' : achievement.icon;
                
                // 🆕 Tooltip com explicação detalhada dos requisitos
                // 🔧 CORREÇÃO: Conquistas secretas mostram enigmas misteriosos
                let tooltipText;
                if (isSecret && !isUnlocked) {
                    // Enigmas misteriosos para conquistas secretas (todas as 9)
                    const secretHints = {
                        'speed-typer': '⚡ "Velocidade é a essência do tempo..." Será que seus dedos conseguem acompanhar seus pensamentos em um único minuto?',
                        'coffee-duo': '👥 "Dois corações, um aroma..." Alguns momentos são melhores quando compartilhados no mesmo dia.',
                        'triple-threat': '🎯 "O mestre não é quem domina uma arte, mas quem domina todas..." Três ações diferentes, um único dia, uma lenda nasce.',
                        'night-shift': '🌙 "Quando o mundo dorme, os verdadeiros guerreiros despertam..." O relógio passou da meia-noite e ainda há café?',
                        'silent-hero': '🦸 "O verdadeiro herói não busca glória, apenas serve..." Ajude muitas vezes sem jamais pedir nada em troca.',
                        'perfect-month': '📅 "Consistência é a chave de toda conquista..." Um mês inteiro de dedicação, sem faltar um único dia útil.',
                        'comeback-king': '👑 "A fênix sempre renasce das cinzas..." Mesmo após uma longa ausência, o guerreiro retorna mais forte.',
                        'double-rainbow': '🌈 "Quando dois sóis brilham no mesmo céu..." Uma única criação, duas avaliações perfeitas. Coincidência ou destino?',
                        'unanimous': '🏛️ "Quando todas as vozes se unem em harmonia..." Cinco estrelas de cinco pessoas. A perfeição absoluta.'
                    };
                    tooltipText = secretHints[achievement.id] || '🔮 Uma conquista envolta em mistério... Continue sua jornada para descobrir.';
                } else {
                    tooltipText = achievement.tooltip || achievement.description;
                }
                
                // Escapar aspas para não quebrar o atributo data-tooltip
                const safeTooltip = tooltipText.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                
                html += `
                    <div class="achievement-card ${unlockedClass} rarity-${rarity} ${isSecret ? 'secret' : ''}" data-rarity="${rarity}" data-tooltip="${safeTooltip}">
                        <span class="rarity-badge ${rarity}">${rarityConfig.name}</span>
                        <span class="achievement-points"><i class="fas fa-star"></i> ${points}</span>
                        ${isUnlocked 
                            ? '<span class="unlock-badge"><i class="fas fa-check"></i></span>' 
                            : ''}
                        <div class="achievement-icon">${displayIcon}</div>
                        <div class="achievement-name">${displayName}</div>
                        <div class="achievement-desc">${displayDesc}</div>
                        ${unlockedDate}
                        ${progressHtml}
                    </div>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Adicionar filtros de raridade
        this.setupRarityFilters();
        
        // 🔧 NOVO: Configurar tooltips com posicionamento inteligente
        this.setupSmartTooltips();
        
        // Atualizar contador
        const summaryEl = document.getElementById('achievementsSummary');
        if (summaryEl) {
            summaryEl.textContent = `${unlockedCount}/${totalCount}`;
        }
    },
    
    /**
     * 🆕 Configura tooltips com posicionamento inteligente
     * Usa um elemento de tooltip global para evitar problemas de overflow/clipping
     */
    setupSmartTooltips() {
        // Criar elemento de tooltip global se não existir
        let tooltip = document.getElementById('achievement-tooltip-global');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'achievement-tooltip-global';
            tooltip.className = 'achievement-tooltip-global';
            tooltip.style.cssText = `
                position: fixed;
                background: linear-gradient(135deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 40, 0.98) 100%);
                color: #fff;
                padding: 12px 16px;
                border-radius: 12px;
                font-size: 0.85rem;
                font-weight: 500;
                line-height: 1.5;
                max-width: 300px;
                min-width: 180px;
                z-index: 99999;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.15);
                pointer-events: none;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s ease, visibility 0.2s ease;
                text-align: left;
                word-wrap: break-word;
            `;
            document.body.appendChild(tooltip);
        }

        const cards = document.querySelectorAll('.achievement-card[data-tooltip]');
        
        cards.forEach(card => {
            // Mouseenter - mostrar tooltip
            card.addEventListener('mouseenter', (e) => {
                const tooltipText = card.getAttribute('data-tooltip');
                if (!tooltipText) return;
                
                tooltip.textContent = tooltipText;
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
                
                // Posicionar o tooltip
                this.positionTooltip(card, tooltip);
            });
            
            // Mousemove - reposicionar conforme o mouse move
            card.addEventListener('mousemove', (e) => {
                if (tooltip.style.visibility === 'visible') {
                    this.positionTooltip(card, tooltip);
                }
            });
            
            // Mouseleave - esconder tooltip
            card.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            });
        });
    },
    
    /**
     * Posiciona o tooltip de forma inteligente para nunca sair da tela
     */
    positionTooltip(card, tooltip) {
        const cardRect = card.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Centralizar horizontalmente sobre o card
        let left = cardRect.left + (cardRect.width / 2) - (tooltipRect.width / 2);
        
        // Posição vertical: acima do card por padrão
        let top = cardRect.top - tooltipRect.height - 12;
        
        // 🔧 Ajuste horizontal: não deixar sair da tela
        const margin = 15;
        
        // Verificar borda esquerda (considerando sidebar ~250px)
        const sidebarWidth = 250;
        if (left < sidebarWidth + margin) {
            left = sidebarWidth + margin;
        }
        
        // Verificar borda direita
        if (left + tooltipRect.width > viewportWidth - margin) {
            left = viewportWidth - tooltipRect.width - margin;
        }
        
        // 🔧 Ajuste vertical: se não couber acima, mostrar abaixo
        if (top < margin) {
            top = cardRect.bottom + 12;
        }
        
        // Se ainda não couber abaixo, mostrar ao lado
        if (top + tooltipRect.height > viewportHeight - margin) {
            top = Math.max(margin, cardRect.top);
            // Mostrar à direita do card
            left = cardRect.right + 12;
            
            // Se não couber à direita, mostrar à esquerda
            if (left + tooltipRect.width > viewportWidth - margin) {
                left = cardRect.left - tooltipRect.width - 12;
            }
        }
        
        // Garantir que left nunca seja negativo
        left = Math.max(margin, left);
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },
    
    /**
     * Calcula o progresso de uma conquista baseado nos stats do usuário
     */
    getAchievementProgress(achievement, stats) {
        if (!achievement.requirement) return null;
        
        let current = 0;
        const target = achievement.requirement;
        
        switch (achievement.type) {
            case 'coffee-made':
                current = stats.coffeeMade || 0;
                break;
            case 'coffee-brought':
                current = stats.coffeeBrought || 0;
                break;
            case 'messages-sent':
                current = stats.messagesSent || 0;
                break;
            case 'ratings-given':
                current = stats.ratingsGiven || 0;
                break;
            case 'five-star-received':
                current = stats.fiveStarsReceived || 0;
                break;
            case 'average-rating':
                current = stats.averageRating || 0;
                break;
            case 'streak':
                current = stats.currentStreak || 0;
                break;
            case 'days-active':
                current = stats.daysActive || 0;
                break;
            case 'reactions-received':
                current = stats.reactionsReceived || 0;
                break;
            case 'reactions-given':
                current = stats.reactionsGiven || 0;
                break;
            case 'unique-emojis':
                current = stats.uniqueEmojis || 0;
                break;
            default:
                // Para tipos booleanos ou especiais, não mostrar progresso
                return null;
        }
        
        return { current, target };
    },
    
    /**
     * Configura filtros de raridade
     */
    setupRarityFilters() {
        const filterBtns = document.querySelectorAll('.rarity-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remover active de todos
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const rarity = btn.dataset.rarity;
                const cards = document.querySelectorAll('.achievement-card');
                
                cards.forEach(card => {
                    if (rarity === 'all' || card.dataset.rarity === rarity) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        });
    },

    /**
     * Converte objeto de ratings para array usado pelo checker
     * 🔧 CORREÇÃO: Verificar múltiplos campos possíveis para o maker
     */
    convertRatingsToArray(ratingsObj) {
        const ratingsArray = [];
        
        for (const [coffeeId, ratingData] of Object.entries(ratingsObj)) {
            // Para cada avaliador, criar um registro
            if (ratingData.raters) {
                for (const rater of ratingData.raters) {
                    // 🔧 CORREÇÃO: Verificar todos os campos possíveis para o maker
                    // Pode vir como makerName, ownerName, maker.username, name, etc.
                    const makerName = ratingData.makerName || 
                                     ratingData.ownerName || 
                                     ratingData.maker?.username ||
                                     ratingData.maker?.name ||
                                     ratingData.name ||
                                     ratingData.username;
                    
                    ratingsArray.push({
                        coffeeId: coffeeId,
                        maker: makerName,
                        rater: rater.name || rater.username,
                        rating: rater.stars,
                        date: rater.date || rater.timestamp || ratingData.date
                    });
                }
            }
        }
        
        return ratingsArray;
    },

    /**
     * Utilitários públicos
     */
    getAchievementsByCategory,
    getAchievementById
};

// Expor no window para debug
if (Logger.isDebugMode) {
    window.Achievements = Achievements;
}