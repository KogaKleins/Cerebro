/**
 * 📊 LEVEL SYSTEM - API Pública
 * Sistema de níveis gamificado integrado com conquistas e ações
 * 
 * Arquitetura modular:
 * - definitions.js: Definições de níveis, ranks e XP
 * - storage.js: Persistência de dados
 * - calculator.js: Cálculos de XP e níveis
 * - notifier.js: Sistema de notificações
 * - index.js: API pública (este arquivo)
 */

import { 
    XP_ACTIONS, 
    RANKS, 
    TIER_CONFIG,
    getXPForLevel,
    getRankForLevel,
    getTierConfig,
    isMilestone,
    getMilestoneReward,
    updateXPActionsFromConfig,
    getXPForAction
} from './definitions.js';
import { LevelStorage } from './storage.js';
import { LevelCalculator } from './calculator.js';
import { LevelNotifier } from './notifier.js';
import { Logger } from '../logger.js';
import { State } from '../state.js';

export const Levels = {
    // Dados de todos os usuários
    // Estrutura: { userName: { xp, level, totalXP, history, ... } }
    allLevelData: {},
    
    // Flag de inicialização
    initialized: false,
    
    // Cache da config de XP carregada do servidor
    cachedXPConfig: null,

    /**
     * Inicializa o sistema de níveis
     */
    async init() {
        if (this.initialized) return;
        
        Logger.info('📊 Inicializando sistema de níveis...');
        
        // Carregar config XP do servidor PRIMEIRO (para garantir valores atualizados)
        await this.loadXPConfigFromServer();
        
        // Carregar dados salvos do servidor (prioridade) ou localStorage
        this.allLevelData = await LevelStorage.load();
        
        // Verificar se precisa recalcular APENAS na primeira execução
        // Para evitar oscilação, NÃO recalcular se já temos dados
        const coffeeData = State.getCoffeeData();
        const messages = State.getChatMessages();
        const hasData = coffeeData.made.length > 0 || 
                       coffeeData.brought.length > 0 || 
                       messages.length > 0;
        
        const hasExistingLevelData = Object.keys(this.allLevelData).length > 0;
        
        // Só recalcular se não temos NENHUM dado de nível e temos dados históricos
        if (!hasExistingLevelData && LevelStorage.needsRecalculation(this.allLevelData, hasData)) {
            Logger.info('Primeira inicialização - calculando XP retroativo...');
            await this.recalculateAllLevels();
            LevelStorage.markRecalculated();
        }
        
        // Verificar login diário do usuário atual
        const currentUser = State.getUser();
        if (currentUser) {
            await this.checkDailyLogin(currentUser);
        }
        
        // Atualizar display
        this.updateDisplay();
        
        this.initialized = true;
        Logger.success('Sistema de níveis inicializado!');
        
        // Sincronizar com servidor a cada 5 minutos para garantir dados atualizados
        setInterval(() => this.syncWithServer(), 5 * 60 * 1000);
    },
    
    /**
     * Carrega config XP do servidor e atualiza cache local
     * 🔧 CORREÇÃO: Também atualiza XP_ACTIONS com valores do servidor
     */
    async loadXPConfigFromServer() {
        try {
            const { Api } = await import('../api.js');
            const config = await Api.getXPConfig();
            if (config && Object.keys(config).length > 0) {
                this.cachedXPConfig = config;
                // 🔧 CORREÇÃO: Atualizar XP_ACTIONS com valores do servidor
                updateXPActionsFromConfig(config);
                // Atualizar localStorage para consistência
                localStorage.setItem('cerebro-xp-config', JSON.stringify(config));
                Logger.debug('XP Config carregada do servidor e XP_ACTIONS atualizado');
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
                // 🔧 CORREÇÃO: Também atualizar XP_ACTIONS do cache
                updateXPActionsFromConfig(this.cachedXPConfig);
            }
        } catch {
            // Ignorar erros de parse
        }
        
        return this.cachedXPConfig;
    },

    /**
     * Adiciona XP para um usuário por uma ação
     */
    async addXP(userName, actionType, metadata = {}) {
        if (!userName) return null;
        
        // Verificar se há config customizada (usa cache primeiro, fallback para localStorage)
        const customConfig = this.cachedXPConfig || this.getCustomXPConfig();
        const action = customConfig?.[actionType] || XP_ACTIONS[actionType];
        
        if (!action) {
            Logger.warn(`Ação desconhecida: ${actionType}`);
            return null;
        }
        
        // Inicializar dados do usuário se necessário
        if (!this.allLevelData[userName]) {
            // 🔒 Normalizar dados ao criar novo usuário
            this.allLevelData[userName] = LevelStorage.normalizeUserData(
                LevelStorage.createDefaultUserData()
            );
        }
        
        const userData = this.allLevelData[userName];
        const xpAmount = action.xp;
        
        // Adicionar XP
        const result = LevelCalculator.addXP(userData, xpAmount, `${actionType}: ${action.name}`);
        
        // Salvar
        await this.save();
        
        // Só notificar se for o usuário atual (para não mostrar toast de outros usuários)
        const currentUser = State.getUser();
        const isCurrentUser = currentUser && currentUser === userName;
        
        if (isCurrentUser) {
            // Notificar ganho de XP
            LevelNotifier.notifyXPGain(xpAmount, action.name, userName);
            
            // Notificar level ups
            if (result.levelUps.length > 0) {
                for (const levelUp of result.levelUps) {
                    await LevelNotifier.notifyLevelUp(levelUp, userName);
                }
            }
            
            // Atualizar display
            this.updateDisplay();
        }
        
        Logger.debug(`+${xpAmount} XP para ${userName} (${actionType})`);
        
        return result;
    },

    /**
     * Adiciona XP para uma ação única (rastreada por ID)
     * Evita XP duplicado para a mesma ação
     * @param {string} userName - Nome do usuário
     * @param {string} actionType - Tipo da ação (ex: 'rating-given')
     * @param {string} trackingType - Tipo de rastreamento ('ratings', 'reactions', 'fiveStars', 'messages')
     * @param {string} actionId - ID único da ação (ex: coffeeId, messageId)
     * @returns {Object|null} Resultado do XP ou null se já foi rastreado
     */
    async addTrackedXP(userName, actionType, trackingType, actionId) {
        if (!userName || !actionId) return null;
        
        // Inicializar dados do usuário se necessário
        if (!this.allLevelData[userName]) {
            // 🔒 Normalizar dados ao criar novo usuário
            this.allLevelData[userName] = LevelStorage.normalizeUserData(
                LevelStorage.createDefaultUserData()
            );
        }
        
        const userData = this.allLevelData[userName];
        
        // Verificar se já ganhou XP por essa ação
        if (LevelStorage.hasTrackedAction(userData, trackingType, actionId)) {
            Logger.debug(`XP já concedido para ${userName} (${trackingType}: ${actionId})`);
            return null; // Já ganhou XP por isso
        }
        
        // 🆕 Verificar limite diário para reactions e messages
        if (trackingType === 'reactions' || trackingType === 'messages') {
            const limitCheck = this.checkDailyLimit(userName, trackingType);
            if (!limitCheck.allowed) {
                // Mostrar notificação de limite atingido
                const { Utils } = await import('../utils.js');
                const limitType = trackingType === 'reactions' ? 'reações' : 'mensagens';
                Utils.showToast(`Limite diário de XP por ${limitType} atingido! 🎯`, 'info', 'Limite de XP', 3000);
                Logger.debug(`Limite diário de ${trackingType} atingido para ${userName}`);
                return null;
            }
        }
        
        // Registrar a ação como rastreada
        LevelStorage.trackAction(userData, trackingType, actionId);
        
        // 🆕 Incrementar contador de limite diário
        if (trackingType === 'reactions' || trackingType === 'messages') {
            this.incrementDailyLimit(userName, trackingType);
        }
        
        // Adicionar XP normalmente
        return this.addXP(userName, actionType);
    },
    
    /**
     * 🆕 Verifica se o usuário atingiu o limite diário de XP para um tipo de ação
     * @param {string} userName - Nome do usuário
     * @param {string} limitType - 'reactions' ou 'messages'
     * @returns {Object} { allowed: boolean, remaining: number }
     */
    checkDailyLimit(userName, limitType) {
        const DAILY_LIMIT = 10; // 10 XP por dia = 10 ações de 1 XP
        
        if (!this.allLevelData[userName]) return { allowed: true, remaining: DAILY_LIMIT };
        
        const userData = this.allLevelData[userName];
        
        // Garantir que dailyLimits existe
        if (!userData.dailyLimits) {
            userData.dailyLimits = {
                reactions: { count: 0, date: null },
                messages: { count: 0, date: null }
            };
        }
        
        const limitData = userData.dailyLimits[limitType];
        if (!limitData) return { allowed: true, remaining: DAILY_LIMIT };
        
        // Verificar se é um novo dia
        const today = new Date().toDateString();
        if (limitData.date !== today) {
            // Resetar contador para novo dia
            limitData.count = 0;
            limitData.date = today;
        }
        
        const remaining = DAILY_LIMIT - limitData.count;
        return {
            allowed: limitData.count < DAILY_LIMIT,
            remaining: Math.max(0, remaining)
        };
    },
    
    /**
     * 🆕 Incrementa o contador de limite diário
     * @param {string} userName - Nome do usuário
     * @param {string} limitType - 'reactions' ou 'messages'
     */
    incrementDailyLimit(userName, limitType) {
        if (!this.allLevelData[userName]) return;
        
        const userData = this.allLevelData[userName];
        
        // Garantir que dailyLimits existe
        if (!userData.dailyLimits) {
            userData.dailyLimits = {
                reactions: { count: 0, date: null },
                messages: { count: 0, date: null }
            };
        }
        
        const today = new Date().toDateString();
        const limitData = userData.dailyLimits[limitType];
        
        // Resetar se for um novo dia
        if (limitData.date !== today) {
            limitData.count = 0;
            limitData.date = today;
        }
        
        limitData.count++;
        Logger.debug(`${limitType} contador diário para ${userName}: ${limitData.count}/10`);
    },

    /**
     * 🆕 FUNÇÃO PADRONIZADA: Adicionar XP com feedback instantâneo
     * 
     * Esta é a função principal para dar XP ao usuário.
     * Garante:
     * 1. Notificação INSTANTÂNEA para o usuário (Optimistic UI)
     * 2. Persistência no backend em background
     * 3. Prevenção de duplicação via sourceId
     * 
     * @param {string} userName - Nome do usuário
     * @param {string} actionType - Tipo da ação (ex: 'coffee-made', 'message-sent')
     * @param {string} sourceId - ID único da ação para evitar duplicação
     * @param {Object} options - Opções adicionais
     * @param {string} options.trackingType - Tipo de rastreamento local ('ratings', 'reactions', 'messages', 'coffees')
     * @param {boolean} options.persistToBackend - Se deve persistir no backend (default: true)
     * @param {string} options.apiEndpoint - Endpoint da API para persistência
     * @param {Object} options.apiPayload - Payload para a API
     * @returns {Object|null} Resultado do XP ou null se já foi rastreado
     */
    async awardXP(userName, actionType, sourceId, options = {}) {
        if (!userName || !sourceId) return null;
        
        const {
            trackingType = null,
            persistToBackend = true,
            apiEndpoint = null,
            apiPayload = null
        } = options;
        
        // Verificar se já ganhou XP por essa ação (evita duplicação local)
        if (trackingType) {
            if (this.hasAlreadyEarnedXP(userName, trackingType, sourceId)) {
                Logger.debug(`XP já concedido localmente para ${userName} (${trackingType}: ${sourceId})`);
                return null;
            }
            
            // Verificar limite diário para mensagens e reações
            if (trackingType === 'reactions' || trackingType === 'messages') {
                const limitCheck = this.checkDailyLimit(userName, trackingType);
                if (!limitCheck.allowed) {
                    const { Utils } = await import('../utils.js');
                    const limitType = trackingType === 'reactions' ? 'reações' : 'mensagens';
                    Utils.showToast(`Limite diário de XP por ${limitType} atingido! 🎯`, 'info', 'Limite de XP', 3000);
                    return null;
                }
            }
        }
        
        // ============ PASSO 1: NOTIFICAÇÃO INSTANTÂNEA ============
        // Mostrar XP imediatamente para o usuário (Optimistic UI)
        const result = await this.addXP(userName, actionType);
        
        if (!result) {
            Logger.warn(`Ação de XP desconhecida: ${actionType}`);
            return null;
        }
        
        // Registrar ação localmente para evitar duplicação
        if (trackingType) {
            const userData = this.allLevelData[userName];
            if (userData) {
                LevelStorage.trackAction(userData, trackingType, sourceId);
                
                // Incrementar limite diário
                if (trackingType === 'reactions' || trackingType === 'messages') {
                    this.incrementDailyLimit(userName, trackingType);
                }
            }
        }
        
        // ============ PASSO 2: PERSISTIR NO BACKEND (BACKGROUND) ============
        // Enviar para o servidor em background - não bloqueia UI
        if (persistToBackend && apiEndpoint && apiPayload) {
            this.persistXPToBackend(apiEndpoint, apiPayload, sourceId).catch(error => {
                Logger.warn(`Erro ao persistir XP no backend (${sourceId}):`, error);
                // XP já foi dado localmente, backend vai sincronizar depois
            });
        }
        
        return result;
    },
    
    /**
     * 🆕 Persistir XP no backend (não bloqueia, roda em background)
     */
    async persistXPToBackend(endpoint, payload, sourceId) {
        try {
            const { Api } = await import('../api.js');
            // A API do backend usa sourceId para evitar duplicação
            await Api.post(endpoint, { ...payload, sourceId });
            Logger.debug(`XP persistido no backend: ${sourceId}`);
        } catch (error) {
            // Não é crítico - XP já foi dado localmente
            // Backend vai sincronizar na próxima oportunidade
            Logger.debug(`Falha ao persistir XP (${sourceId}), será sincronizado depois:`, error);
        }
    },

    /**
     * Verifica se o usuário já ganhou XP por uma ação específica
     */
    hasAlreadyEarnedXP(userName, trackingType, actionId) {
        if (!userName || !actionId) return false;
        
        const userData = this.allLevelData[userName];
        if (!userData) return false;
        
        return LevelStorage.hasTrackedAction(userData, trackingType, actionId);
    },
    
    /**
     * Obtém configuração customizada de XP (do Admin)
     * Tenta buscar do servidor primeiro, fallback para localStorage
     */
    async getCustomXPConfigAsync() {
        try {
            const { Api } = await import('../api.js');
            const config = await Api.getXPConfig();
            if (config && Object.keys(config).length > 0) {
                // Atualizar cache local
                localStorage.setItem('cerebro-xp-config', JSON.stringify(config));
                return config;
            }
        } catch (error) {
            console.debug('API de config XP não disponível, usando cache local');
        }
        
        // Fallback para localStorage
        try {
            const saved = localStorage.getItem('cerebro-xp-config');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    },

    /**
     * Obtém configuração customizada de XP (síncrono - usa cache)
     */
    getCustomXPConfig() {
        try {
            const saved = localStorage.getItem('cerebro-xp-config');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    },

    /**
     * Sincroniza dados de níveis com o servidor
     * Carrega dados mais recentes para garantir consistência
     * 
     * ✓ CORREÇÃO #6: Merge ao invés de overwrite
     * Preserva dados locais não sincronizados
     */
    async syncWithServer() {
        try {
            const { Api } = await import('../api.js');
            const serverData = await Api.getLevels();
            
            if (serverData && Object.keys(serverData).length > 0) {
                // ✓ MERGE ao invés de SOBRESCREVER
                for (const [username, serverUserData] of Object.entries(serverData)) {
                    // 🔒 Normalizar dados do servidor
                    const normalizedServerData = LevelStorage.normalizeUserData(serverUserData);
                    
                    // Verificar se temos dados locais mais recentes
                    const localData = this.allLevelData[username];
                    
                    if (!localData) {
                        // Não temos local → usar servidor
                        this.allLevelData[username] = normalizedServerData;
                        Logger.debug(`${username}: usando dados do servidor (local não existia)`);
                    } else {
                        // Comparar timestamps
                        const serverTime = new Date(normalizedServerData.updatedAt || 0).getTime();
                        const localTime = new Date(localData.updatedAt || 0).getTime();
                        
                        if (serverTime > localTime) {
                            // Servidor é mais recente → usar servidor
                            this.allLevelData[username] = normalizedServerData;
                            Logger.debug(`${username}: usando dados do servidor (mais recente)`);
                        } else if (localTime > serverTime) {
                            // Local é mais recente → MANTER LOCAL E ENVIAR AO SERVIDOR
                            Logger.debug(`${username}: mantendo dados locais (mais recente)`);
                            // Enviar dados locais ao servidor para sincronizar
                            try {
                                await Api.post(`/api/v2/levels/${username}`, localData);
                                Logger.debug(`${username}: dados locais enviados ao servidor`);
                            } catch (err) {
                                Logger.warn(`${username}: erro ao enviar dados ao servidor`, err);
                            }
                        }
                    }
                }
                
                Logger.debug('Dados de níveis sincronizados (merge)');
                
                // Salvar no localStorage com dados merged
                await LevelStorage.save(this.allLevelData);
                
                this.updateDisplay();
            }
        } catch (error) {
            Logger.debug('Erro ao sincronizar com servidor:', error);
            // Ignorar erro de sincronização - não é crítico
        }
    },

    /**
     * Sincroniza apenas o nível do usuário logado
     * Útil para executar logo após login
     */
    async syncCurrentUserLevel() {
        try {
            const currentUser = State.getUser();
            if (!currentUser) {
                Logger.debug('Nenhum usuário logado para sincronizar');
                return;
            }

            const { Api } = await import('../api.js');
            
            // Buscar nível do usuário logado do servidor
            const serverUserLevel = await Api.get(`/api/v2/levels/${currentUser}`);
            
            if (serverUserLevel) {
                // 🔒 Normalizar dados do servidor antes de usar
                const normalizedServerData = LevelStorage.normalizeUserData(serverUserLevel);
                
                // Atualizar dados locais com dados do servidor (normalizados)
                this.allLevelData[currentUser] = normalizedServerData;
                
                // Salvar no localStorage também
                await LevelStorage.save(this.allLevelData);
                
                Logger.info(`✓ Nível do usuário "${currentUser}" sincronizado do servidor`);
                this.updateDisplay();
                
                return serverUserLevel;
            }
        } catch (error) {
            Logger.debug('Erro ao sincronizar nível atual:', error);
        }
    },

    /**
     * Adiciona XP por conquista desbloqueada
     */
    async addAchievementXP(userName, achievementRarity) {
        const actionType = `achievement-${achievementRarity}`;
        return this.addXP(userName, actionType);
    },

    /**
     * Verifica e aplica bônus de login diário
     */
    async checkDailyLogin(userName) {
        if (!userName) return null;
        
        // Inicializar dados do usuário se necessário
        if (!this.allLevelData[userName]) {
            this.allLevelData[userName] = LevelStorage.createDefaultUserData();
        }
        
        const userData = this.allLevelData[userName];
        const dailyResult = LevelCalculator.calculateDailyStreak(userData);
        
        if (dailyResult.isNew && dailyResult.xpGained > 0) {
            // Aplicar XP do daily
            const result = LevelCalculator.addXP(
                userData, 
                dailyResult.xpGained, 
                `Login diário (${dailyResult.streak} dias)`
            );
            
            await this.save();
            
            // Notificar
            const streakText = dailyResult.streak > 1 
                ? `🔥 ${dailyResult.streak} dias seguidos!` 
                : 'Bem-vindo!';
            LevelNotifier.notifyXPGain(dailyResult.xpGained, streakText, userName);
            
            // Level ups
            if (result.levelUps.length > 0) {
                for (const levelUp of result.levelUps) {
                    await LevelNotifier.notifyLevelUp(levelUp, userName);
                }
            }
            
            this.updateDisplay();
            
            return result;
        }
        
        return null;
    },

    /**
     * Obtém dados de nível de um usuário
     */
    getUserLevel(userName) {
        if (!userName) return null;
        
        if (!this.allLevelData[userName]) {
            this.allLevelData[userName] = LevelStorage.createDefaultUserData();
        }
        
        return LevelCalculator.generateStats(this.allLevelData[userName]);
    },

    /**
     * Obtém rank de um usuário
     */
    getUserRank(userName) {
        const stats = this.getUserLevel(userName);
        return stats ? stats.rank : getRankForLevel(1);
    },

    /**
     * Recalcula XP para todos os usuários baseado em dados históricos
     * Inclui XP de ações E XP de conquistas
     */
    async recalculateAllLevels() {
        Logger.info('Recalculando níveis para todos os usuários...');
        
        const coffeeData = State.getCoffeeData();
        const messages = State.getChatMessages();
        const ratingsObj = State.getRatings();
        
        // Obter configuração customizada de XP
        const customConfig = await this.getCustomXPConfigAsync();
        
        // Converter ratings para array
        const ratings = this.convertRatingsToArray(ratingsObj);
        
        // Coletar todos os usuários
        const users = new Set();
        coffeeData.made.forEach(c => users.add(c.name));
        coffeeData.brought.forEach(c => users.add(c.name));
        messages.forEach(m => {
            const userName = m.author || m.name;
            if (userName) users.add(userName);
        });
        ratings.forEach(r => {
            if (r.maker) users.add(r.maker);
            if (r.rater) users.add(r.rater);
        });
        
        // Buscar conquistas para calcular XP de conquistas
        let allAchievements = {};
        try {
            const { Achievements } = await import('./achievements/index.js');
            allAchievements = Achievements.allAchievements || {};
        } catch (e) {
            Logger.warn('Não foi possível carregar conquistas para recálculo');
        }
        
        // Recalcular para cada usuário
        this.allLevelData = {};
        
        for (const userName of users) {
            // Criar dados do usuário
            this.allLevelData[userName] = LevelStorage.createDefaultUserData();
            
            // Calcular XP retroativo de ações (usando config customizada)
            const { totalXP: actionsXP, breakdown } = LevelCalculator.calculateRetroactiveXP(
                userName, 
                coffeeData, 
                messages, 
                ratings,
                customConfig
            );
            
            // Calcular XP de conquistas
            let achievementXP = 0;
            const userAchievements = allAchievements[userName] || {};
            
            // Importar definições de conquistas para obter raridade
            try {
                const { AchievementDefinitions } = await import('./achievements/definitions.js');
                
                for (const achievementId of Object.keys(userAchievements)) {
                    const achievement = AchievementDefinitions[achievementId];
                    if (achievement) {
                        const rarity = achievement.rarity || 'common';
                        const actionKey = `achievement-${rarity}`;
                        
                        // Usar config customizada ou padrão
                        if (customConfig && customConfig[actionKey]) {
                            achievementXP += customConfig[actionKey].xp;
                        } else {
                            achievementXP += XP_ACTIONS[actionKey]?.xp || 0;
                        }
                    }
                }
            } catch (e) {
                Logger.warn('Não foi possível calcular XP de conquistas');
            }
            
            // Aplicar XP total (ações + conquistas)
            const totalXP = actionsXP + achievementXP;
            const userData = this.allLevelData[userName];
            userData.totalXP = totalXP;
            userData.level = LevelCalculator.calculateLevel(totalXP);
            userData.xp = LevelCalculator.calculateCurrentLevelXP(totalXP, userData.level);
            
            Logger.debug(`${userName}: ${totalXP} XP total (${actionsXP} ações + ${achievementXP} conquistas), Nível ${userData.level}`);
        }
        
        // Salvar
        await this.save();
        
        Logger.success(`Recálculo concluído: ${users.size} usuários processados`);
        
        return { usersProcessed: users.size };
    },

    /**
     * Salva dados de níveis
     */
    async save() {
        await LevelStorage.save(this.allLevelData);
    },

    /**
     * Atualiza display na UI
     */
    updateDisplay() {
        const currentUser = State.getUser();
        if (!currentUser) return;
        
        const stats = this.getUserLevel(currentUser);
        if (!stats) return;
        
        // Atualizar elementos na sidebar/header
        this.updateSidebarLevel(stats);
        
        // Atualizar página de níveis se existir
        this.renderLevelPage(stats);
        
        // Atualizar badge de nível nos cards de usuário
        this.updateUserBadges();
    },

    /**
     * Atualiza nível na sidebar
     */
    updateSidebarLevel(stats) {
        const tierConfig = getTierConfig(stats.rank.tier);
        
        // Atualizar círculo de nível
        const levelCircle = document.getElementById('sidebarLevelCircle');
        if (levelCircle) {
            // Remover classes de tier anteriores
            levelCircle.className = `sidebar-level-circle tier-${stats.rank.tier}`;
        }
        
        // Atualizar número do nível
        const levelNumber = document.getElementById('sidebarLevelNumber');
        if (levelNumber) {
            levelNumber.textContent = stats.level;
        }
        
        // Atualizar ring de progresso (rotação baseada no progresso)
        const levelRing = document.getElementById('sidebarLevelRing');
        if (levelRing) {
            const rotation = (stats.progress / 100) * 360;
            levelRing.style.background = `conic-gradient(${tierConfig.color} ${rotation}deg, rgba(255,255,255,0.2) ${rotation}deg)`;
            levelRing.style.borderColor = 'transparent';
        }
        
        // Atualizar ícone e nome do rank
        const rankIcon = document.getElementById('sidebarRankIcon');
        if (rankIcon) {
            rankIcon.textContent = stats.rank.icon;
        }
        
        const rankName = document.getElementById('sidebarRankName');
        if (rankName) {
            rankName.textContent = stats.rank.name;
            rankName.style.color = tierConfig.color;
        }
        
        // Progress bar na sidebar
        const levelProgress = document.getElementById('userLevelProgress');
        if (levelProgress) {
            levelProgress.style.width = `${stats.progress}%`;
        }
        
        // XP info
        const xpInfo = document.getElementById('userXPInfo');
        if (xpInfo) {
            if (stats.isMaxLevel) {
                xpInfo.textContent = `${stats.totalXP.toLocaleString()} XP - MÁXIMO!`;
            } else {
                xpInfo.textContent = `${stats.currentLevelXP}/${stats.xpForNextLevel} XP`;
            }
        }
        
        // Atualizar badge na navegação
        const navBadge = document.getElementById('navLevelBadge');
        if (navBadge) {
            navBadge.textContent = `Nv.${stats.level}`;
        }
        
        // Legacy support - userLevelBadge (se ainda existir)
        const levelBadge = document.getElementById('userLevelBadge');
        if (levelBadge) {
            levelBadge.innerHTML = `
                <span class="level-badge tier-${stats.rank.tier}" style="background: ${tierConfig.gradient}" 
                      onclick="document.querySelector('[data-page=levels]').click()" 
                      title="Clique para ver detalhes">
                    <span class="level-icon">${stats.rank.icon}</span>
                    <span class="level-number">Nv. ${stats.level}</span>
                </span>
            `;
        }
    },

    /**
     * Renderiza página completa de níveis
     */
    renderLevelPage(stats) {
        const container = document.getElementById('levelPageContent');
        if (!container) return;
        
        const tierConfig = getTierConfig(stats.rank.tier);
        const currentUser = State.getUser();
        
        let html = `
            <!-- User Level Card -->
            <div class="level-card-main tier-${stats.rank.tier}">
                <div class="level-card-bg" style="background: ${tierConfig.gradient}"></div>
                <div class="level-card-content">
                    <div class="level-card-rank">
                        <span class="rank-icon-large">${stats.rank.icon}</span>
                        <div class="rank-info">
                            <span class="rank-name">${stats.rank.name}</span>
                            <span class="rank-tier" style="color: ${tierConfig.color}">${tierConfig.name}</span>
                        </div>
                    </div>
                    
                    <div class="level-card-level">
                        <span class="level-label">NÍVEL</span>
                        <span class="level-value">${stats.level}</span>
                    </div>
                    
                    <div class="level-card-xp">
                        <div class="xp-bar-container">
                            <div class="xp-bar-fill" style="width: ${stats.progress}%; background: ${tierConfig.gradient}"></div>
                        </div>
                        <div class="xp-info">
                            ${stats.isMaxLevel 
                                ? `<span class="xp-max">✨ NÍVEL MÁXIMO ALCANÇADO! ✨</span>`
                                : `<span class="xp-current">${stats.currentLevelXP.toLocaleString()} / ${stats.xpForNextLevel.toLocaleString()} XP</span>`
                            }
                        </div>
                        <div class="total-xp">
                            <i class="fas fa-star"></i> ${stats.totalXP.toLocaleString()} XP Total
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Stats Grid -->
            <div class="level-stats-grid">
                <div class="level-stat-card">
                    <span class="stat-icon">🔥</span>
                    <span class="stat-value">${stats.streak}</span>
                    <span class="stat-label">Dias Seguidos</span>
                </div>
                <div class="level-stat-card">
                    <span class="stat-icon">🏆</span>
                    <span class="stat-value">${stats.bestStreak}</span>
                    <span class="stat-label">Melhor Sequência</span>
                </div>
                <div class="level-stat-card">
                    <span class="stat-icon">📅</span>
                    <span class="stat-value">${this.formatMemberSince(stats.memberSince)}</span>
                    <span class="stat-label">Membro Desde</span>
                </div>
            </div>
            
            <!-- Next Milestone -->
            ${stats.nextMilestone ? `
                <div class="next-milestone-card">
                    <h4><i class="fas fa-flag-checkered"></i> Próximo Marco</h4>
                    <div class="milestone-preview">
                        <span class="milestone-badge">${stats.nextMilestone.badge}</span>
                        <div class="milestone-info">
                            <span class="milestone-level">Nível ${stats.nextMilestone.level}</span>
                            <span class="milestone-title">${stats.nextMilestone.title}</span>
                            <span class="milestone-bonus">+${stats.nextMilestone.bonus} XP Bônus</span>
                        </div>
                        <div class="milestone-progress">
                            <span>${stats.level}/${stats.nextMilestone.level}</span>
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <!-- XP Actions Info -->
            <div class="xp-actions-card">
                <h4><i class="fas fa-bolt"></i> Como Ganhar XP</h4>
                <div class="xp-actions-grid">
                    ${this.renderXPActions()}
                </div>
            </div>
            
            <!-- Ranking de Níveis -->
            <div class="level-ranking-card">
                <h4><i class="fas fa-users"></i> Ranking de Níveis</h4>
                <div class="level-ranking-list">
                    ${this.renderLevelRanking()}
                </div>
            </div>
            
            <!-- Ranks Available -->
            <div class="ranks-showcase-card">
                <h4><i class="fas fa-medal"></i> Ranks Disponíveis</h4>
                <div class="ranks-grid">
                    ${this.renderRanksShowcase(stats.level)}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    },

    /**
     * Renderiza lista de ações de XP
     */
    renderXPActions() {
        const actions = [
            'coffee-made', 'coffee-brought', 'rating-given', 
            'five-star-received', 'message-sent', 'daily-login'
        ];
        // Buscar config do backend (XPConfig atualizado)
        const config = this.cachedXPConfig || this.getCustomXPConfig() || {};
        return actions.map(actionId => {
            // Pega do config atualizado, senão do XP_ACTIONS
            const action = config[actionId] || XP_ACTIONS[actionId];
            return `
                <div class="xp-action-item">
                    <span class="action-icon">${action.icon}</span>
                    <div class="action-info">
                        <span class="action-name">${action.name}</span>
                        <span class="action-desc">${action.description}</span>
                    </div>
                    <span class="action-xp">+${action.xp} XP</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Renderiza ranking de níveis
     */
    renderLevelRanking() {
        const users = Object.entries(this.allLevelData)
            .map(([name, data]) => ({
                name,
                level: data.level || 1,
                totalXP: data.totalXP || 0,
                rank: getRankForLevel(data.level || 1)
            }))
            .sort((a, b) => b.totalXP - a.totalXP)
            .slice(0, 10);
        
        if (users.length === 0) {
            return '<p class="no-data">Nenhum usuário ainda...</p>';
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        
        return users.map((user, index) => {
            const tierConfig = getTierConfig(user.rank.tier);
            return `
                <div class="ranking-user-item">
                    <span class="ranking-position">${medals[index] || (index + 1)}</span>
                    <div class="ranking-user-info">
                        <span class="ranking-user-name">${user.name}</span>
                        <span class="ranking-user-rank" style="color: ${tierConfig.color}">
                            ${user.rank.icon} ${user.rank.name}
                        </span>
                    </div>
                    <div class="ranking-user-stats">
                        <span class="ranking-level">Nv. ${user.level}</span>
                        <span class="ranking-xp">${user.totalXP.toLocaleString()} XP</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Renderiza showcase de ranks
     */
    renderRanksShowcase(currentLevel) {
        // Mostrar ranks em intervalos
        const showcaseRanks = RANKS.filter((r, i, arr) => {
            // Primeiro e último de cada tier
            const prevTier = arr[i - 1]?.tier;
            const nextTier = arr[i + 1]?.tier;
            return !prevTier || r.tier !== prevTier || !nextTier || r.tier !== nextTier;
        }).slice(0, 15);
        
        return showcaseRanks.map(rank => {
            const tierConfig = getTierConfig(rank.tier);
            const isUnlocked = currentLevel >= rank.minLevel;
            const isCurrent = currentLevel >= rank.minLevel && 
                             (!showcaseRanks.find(r => r.minLevel > rank.minLevel && currentLevel >= r.minLevel));
            
            return `
                <div class="rank-showcase-item ${isUnlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}" 
                     style="${isUnlocked ? `border-color: ${tierConfig.border}` : ''}">
                    <span class="rank-showcase-icon ${isUnlocked ? '' : 'grayscale'}">${rank.icon}</span>
                    <span class="rank-showcase-name">${isUnlocked ? rank.name : '???'}</span>
                    <span class="rank-showcase-level">Nv. ${rank.minLevel}</span>
                    <span class="rank-showcase-tier" style="color: ${isUnlocked ? tierConfig.color : '#666'}">
                        ${tierConfig.name}
                    </span>
                </div>
            `;
        }).join('');
    },

    /**
     * Atualiza badges de nível em cards de usuário
     */
    updateUserBadges() {
        // Atualizar badges em outros lugares da UI
        document.querySelectorAll('[data-user-level-badge]').forEach(el => {
            const userName = el.dataset.userLevelBadge;
            const stats = this.getUserLevel(userName);
            if (stats) {
                const tierConfig = getTierConfig(stats.rank.tier);
                el.innerHTML = `
                    <span class="user-level-mini tier-${stats.rank.tier}" 
                          style="color: ${tierConfig.color}" 
                          title="${stats.rank.name} - Nível ${stats.level}">
                        ${stats.rank.icon} ${stats.level}
                    </span>
                `;
            }
        });
    },

    /**
     * Formata data de membro
     */
    formatMemberSince(dateStr) {
        if (!dateStr) return 'Hoje';
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return `${diffDays} dias`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} sem.`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
        return `${Math.floor(diffDays / 365)} anos`;
    },

    /**
     * Converte objeto de ratings para array
     */
    convertRatingsToArray(ratingsObj) {
        const ratingsArray = [];
        
        for (const [coffeeId, ratingData] of Object.entries(ratingsObj)) {
            if (ratingData.raters) {
                for (const rater of ratingData.raters) {
                    ratingsArray.push({
                        coffeeId: coffeeId,
                        maker: ratingData.makerName || ratingData.odername,
                        rater: rater.name,
                        rating: rater.stars
                    });
                }
            }
        }
        
        return ratingsArray;
    },

    // Expor definições para uso externo
    XP_ACTIONS,
    RANKS,
    TIER_CONFIG
};

// Navegação para a página de níveis
window.navigateToLevels = () => {
    const levelsNav = document.querySelector('[data-page="levels"]');
    if (levelsNav) {
        levelsNav.click();
    }
};

// Expor no window para debug
if (typeof window !== 'undefined' && window.Logger?.isDebugMode) {
    window.Levels = Levels;
}
