/**
 * 💾 LEVEL STORAGE
 * Gerenciamento de persistência de dados de XP e níveis
 */

import { Logger } from '../logger.js';

export const LevelStorage = {
    STORAGE_KEY: 'cerebroLevels',
    
    /**
     * Carrega dados de níveis da API ou localStorage
     * PRIORIDADE: API > localStorage (para evitar oscilação)
     */
    async load() {
        try {
            // Tentar carregar da API primeiro (source of truth)
            const { Api } = await import('../api.js');
            
            try {
                const data = await Api.getLevels();
                if (data && Object.keys(data).length > 0) {
                    Logger.success('Dados de níveis carregados da API');
                    // 🔒 Normalizar dados carregados
                    const normalized = {};
                    for (const [userName, userData] of Object.entries(data)) {
                        normalized[userName] = this.normalizeUserData(userData);
                    }
                    // Atualizar cache local com dados do servidor (fonte da verdade)
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalized));
                    return normalized;
                }
            } catch (apiError) {
                Logger.debug('Erro ao carregar da API, tentando localStorage');
            }
            
            // Se API retornou vazio ou falhou, usar dados locais
            const localData = this.loadFromLocalStorage();
            if (Object.keys(localData).length > 0) {
                Logger.info('Usando dados locais (API não disponível)');
                return localData;
            }
            
            return {};
        } catch (error) {
            Logger.debug('Carregando dados de níveis do localStorage');
            return this.loadFromLocalStorage();
        }
    },

    /**
     * Carrega dados do localStorage
     */
    loadFromLocalStorage() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (!saved) return {};
        
        try {
            const data = JSON.parse(saved);
            Logger.debug('Dados de níveis carregados do localStorage');
            // 🔒 Normalizar dados carregados
            const normalized = {};
            for (const [userName, userData] of Object.entries(data)) {
                normalized[userName] = this.normalizeUserData(userData);
            }
            return normalized;
        } catch (error) {
            Logger.error('Erro ao parsear dados de níveis:', error);
            return {};
        }
    },

    /**
     * Salva dados de níveis
     */
    async save(levelData) {
        // Sempre salvar no localStorage primeiro (backup)
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(levelData));
            Logger.debug('Dados de níveis salvos no localStorage');
        } catch (error) {
            Logger.error('Erro ao salvar níveis no localStorage:', error);
        }
        
        // Tentar salvar na API
        try {
            const { Api } = await import('../api.js');
            const result = await Api.saveLevels(levelData);
            if (result) {
                Logger.debug('Dados de níveis salvos na API');
            }
        } catch (error) {
            Logger.debug('API de níveis não disponível para salvar');
        }
    },

    /**
     * Obtém dados de um usuário específico
     */
    getUserData(allData, userName) {
        if (!allData[userName]) {
            allData[userName] = this.createDefaultUserData();
        } else {
            // Migrar dados antigos para incluir trackedActions
            allData[userName] = this.migrateUserData(allData[userName]);
        }
        return allData[userName];
    },

    /**
     * Cria dados padrão para um novo usuário
     */
    createDefaultUserData() {
        return {
            xp: 0,
            level: 1,
            totalXP: 0,
            history: [],
            lastDaily: null,
            streak: 0,
            bestStreak: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Tracking de ações únicas para evitar XP duplicado
            trackedActions: {
                ratings: [],      // IDs de cafés avaliados
                reactions: [],    // IDs de mensagens reagidas
                fiveStars: [],    // IDs de cafés que deram 5 estrelas
                messages: []      // IDs de mensagens enviadas (para XP)
            },
            // 🆕 Limites diários de XP
            dailyLimits: {
                reactions: { count: 0, date: null },  // Limite: 10 reações/dia
                messages: { count: 0, date: null }    // Limite: 10 mensagens/dia
            }
        };
    },

    /**
     * 🔒 CORREÇÃO: Normalizar dados carregados para garantir estrutura correta
     * Problema: Dados vindos do servidor ou localStorage podem estar malformados
     */
    normalizeUserData(userData) {
        if (!userData) return this.createDefaultUserData();
        
        return {
            xp: Number(userData.xp) || 0,
            level: Number(userData.level) || 1,
            totalXP: Number(userData.totalXP) || 0,
            // 🔒 CRÍTICO: Garantir que history é um array
            history: Array.isArray(userData.history) ? userData.history : [],
            lastDaily: userData.lastDaily || null,
            streak: Number(userData.streak) || 0,
            bestStreak: Number(userData.bestStreak) || 0,
            createdAt: userData.createdAt || new Date().toISOString(),
            updatedAt: userData.updatedAt || new Date().toISOString(),
            trackedActions: {
                ratings: Array.isArray(userData.trackedActions?.ratings) ? userData.trackedActions.ratings : [],
                reactions: Array.isArray(userData.trackedActions?.reactions) ? userData.trackedActions.reactions : [],
                fiveStars: Array.isArray(userData.trackedActions?.fiveStars) ? userData.trackedActions.fiveStars : [],
                messages: Array.isArray(userData.trackedActions?.messages) ? userData.trackedActions.messages : []
            },
            // 🆕 Limites diários de XP
            dailyLimits: {
                reactions: userData.dailyLimits?.reactions || { count: 0, date: null },
                messages: userData.dailyLimits?.messages || { count: 0, date: null }
            }
        };
    },

    /**
     * Verifica se uma ação única já foi rastreada
     */
    hasTrackedAction(userData, actionType, actionId) {
        if (!userData.trackedActions) {
            userData.trackedActions = { ratings: [], reactions: [], fiveStars: [] };
        }
        
        const tracked = userData.trackedActions[actionType];
        if (!tracked) return false;
        
        return tracked.includes(actionId);
    },

    /**
     * Registra uma ação única como rastreada
     */
    trackAction(userData, actionType, actionId) {
        if (!userData.trackedActions) {
            userData.trackedActions = { ratings: [], reactions: [], fiveStars: [] };
        }
        
        if (!userData.trackedActions[actionType]) {
            userData.trackedActions[actionType] = [];
        }
        
        if (!userData.trackedActions[actionType].includes(actionId)) {
            userData.trackedActions[actionType].push(actionId);
            
            // Limitar tamanho para não crescer infinitamente (últimos 500)
            if (userData.trackedActions[actionType].length > 500) {
                userData.trackedActions[actionType] = userData.trackedActions[actionType].slice(-500);
            }
        }
    },

    /**
     * Verifica se precisa recalcular (migração ou primeira execução)
     * IMPORTANTE: Recálculo deve ser feito APENAS quando realmente necessário
     * para evitar oscilação de XP e perda de dados
     */
    needsRecalculation(levelData, hasHistoricalData) {
        // Se não tem dados históricos, não precisa recalcular
        if (!hasHistoricalData) return false;
        
        // Se não tem dados de níveis salvos E tem dados históricos, precisa calcular
        if (!levelData || Object.keys(levelData).length === 0) {
            Logger.info('Sem dados de níveis - recálculo necessário');
            return true;
        }
        
        // Verificar versão do sistema (v3 = versão estável sem recálculos automáticos)
        const version = localStorage.getItem('cerebroLevelsVersion');
        if (!version || parseInt(version.replace('v', '')) < 3) {
            // Apenas marcar como v3, NÃO recalcular automaticamente
            // O recálculo deve ser feito manualmente pelo admin se necessário
            Logger.info('Atualizando versão do sistema de níveis para v3');
            this.markRecalculated();
            return false; // Não recalcular automaticamente
        }
        
        return false;
    },

    /**
     * Marca que o recálculo foi feito
     */
    markRecalculated() {
        localStorage.setItem('cerebroLevelsVersion', 'v3');
        Logger.debug('Versão do sistema de níveis marcada como v3');
    },

    /**
     * Migra dados antigos para incluir trackedActions
     */
    migrateUserData(userData) {
        if (!userData.trackedActions) {
            userData.trackedActions = {
                ratings: [],
                reactions: [],
                fiveStars: []
            };
        }
        return userData;
    },

    /**
     * Limpa dados inválidos/antigos do localStorage
     * Chamado quando sincroniza com servidor para evitar cache stale
     */
    clearStaleCache() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem('cerebroLevels');
            Logger.info('Cache de níveis limpo');
        } catch (error) {
            Logger.debug('Erro ao limpar cache:', error);
        }
    }
};

