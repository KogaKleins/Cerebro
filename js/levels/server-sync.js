/**
 * 🔧 SERVER SYNC MODULE
 * Garante que XP/Níveis são SEMPRE sincronizados com servidor
 * Remove dependência de localStorage para dados críticos
 * 
 * CORREÇÃO #3: Remover persistência local de XP/Nível
 * 
 * Padrão:
 * - NUNCA salvar XP/level/totalXP no localStorage
 * - SEMPRE buscar do servidor via GET /api/v2/levels/{username}
 * - Cache local é apenas para performance (5min TTL)
 * - Se servidor falhar, usar cache - NUNCA dados antigos
 */

import { Logger } from '../logger.js';

export const ServerSync = {
    // Cache com TTL
    cache: {},
    CACHE_TTL: 5 * 60 * 1000, // 5 minutos
    
    /**
     * Buscar dados de nível do servidor
     * Retorna SEMPRE dados atualizados do servidor
     * Se servidor falhar, tenta cache mas com aviso
     */
    async getLevelData(username) {
        if (!username) {
            Logger.error('❌ getLevelData: username é obrigatório');
            return null;
        }

        try {
            // Tentar buscar do servidor (prioridade absoluta)
            const { Api } = await import('../api.js');
            const response = await Api.get(`/api/v2/levels/${encodeURIComponent(username)}`);
            
            if (response) {
                // Atualizar cache com dados do servidor
                this.cache[username] = {
                    data: response,
                    timestamp: Date.now()
                };
                
                Logger.debug(`✅ Dados de nível carregados do servidor: ${username}`);
                return response;
            }
        } catch (error) {
            Logger.warn(`⚠️ Erro ao buscar do servidor, tentando cache: ${error.message}`);
        }

        // Fallback para cache APENAS se servidor falhar
        if (this.cache[username] && this.isCacheValid(username)) {
            Logger.warn(`⚠️ Usando cache local (servidor indisponível)`);
            return this.cache[username].data;
        }

        // Se não tem cache válido, retornar dados padrão
        Logger.error(`❌ Nenhuma fonte disponível para ${username}`);
        return {
            xp: 0,
            level: 1,
            totalXP: 0,
            streak: 0,
            bestStreak: 0,
            lastDaily: null,
            trackedActions: { ratings: [], reactions: [], fiveStars: [] },
            history: []
        };
    },

    /**
     * Validar se cache está ainda válido (< TTL)
     */
    isCacheValid(username) {
        const cached = this.cache[username];
        if (!cached) return false;
        return (Date.now() - cached.timestamp) < this.CACHE_TTL;
    },

    /**
     * Limpar cache para forçar reload do servidor na próxima vez
     */
    invalidateCache(username) {
        delete this.cache[username];
        Logger.debug(`Cache invalidado para ${username}`);
    },

    /**
     * Limpar TODO o cache
     */
    clearCache() {
        this.cache = {};
        Logger.debug('Cache global limpo');
    },

    /**
     * Sincronizar: buscar dados atualizados do servidor
     */
    async syncWithServer(username) {
        // Invalidar cache forçar reload
        this.invalidateCache(username);
        return await this.getLevelData(username);
    },

    /**
     * 🔒 Bloquear qualquer tentativa de salvar XP no localStorage
     * Isso garante que dados críticos NUNCA saem do banco
     */
    blockLocalStorageSave() {
        const originalSetItem = localStorage.setItem;
        
        const blockedKeys = [
            'cerebroLevels',
            'cerebro-levels',
            'cerebroUserLevels',
            'cerebro-user-levels',
            'xp-',
            'level-',
            'totalXP'
        ];

        localStorage.setItem = function(key, value) {
            // Verificar se está tentando salvar dados críticos
            if (blockedKeys.some(blocked => key.includes(blocked))) {
                Logger.error(`🚨 BLOQUEADO: Tentativa de salvar ${key} no localStorage`);
                Logger.error(`   Use ServerSync.updateLevelData() para atualizar dados`);
                // NÃO salvar
                return;
            }
            
            // Permitir salvar outros dados (config, cache não-crítico, etc)
            originalSetItem.call(localStorage, key, value);
        };

        Logger.info('🔒 localStorage bloqueado para dados críticos de XP/Nível');
    },

    /**
     * Atualizar dados de nível no SERVIDOR
     * Este é o ÚNICO jeito correto de atualizar XP/Nível
     */
    async updateLevelData(username, data) {
        try {
            const { Api } = await import('../api.js');
            
            // Validar dados
            if (!data || typeof data !== 'object') {
                throw new Error('Dados inválidos');
            }

            // Enviar para servidor
            const response = await Api.put(`/api/v2/levels/${encodeURIComponent(username)}`, data);
            
            if (response && response.success) {
                // Invalidar cache para forçar reload
                this.invalidateCache(username);
                
                Logger.info(`✅ Dados de nível atualizados no servidor`);
                return response;
            }
        } catch (error) {
            Logger.error(`❌ Erro ao atualizar nível no servidor: ${error.message}`);
            throw error;
        }
    }
};

// Ativar bloqueio no carregamento
ServerSync.blockLocalStorageSave();

export default ServerSync;
