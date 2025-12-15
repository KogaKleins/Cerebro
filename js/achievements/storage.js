/**
 * 💾 ACHIEVEMENT STORAGE
 * Gerenciamento de persistência de conquistas
 */

import { Logger } from '../logger.js';

export const AchievementStorage = {
    /**
     * Carrega conquistas da API ou localStorage
     * PRIORIDADE: API > localStorage (servidor é fonte da verdade)
     */
    async load() {
        try {
            // Tentar carregar da API primeiro
            const { Api } = await import('../api.js');
            const data = await Api.getAchievements();
            
            if (data && Object.keys(data).length > 0) {
                Logger.success('Conquistas carregadas da API');
                // Atualizar localStorage com dados do servidor
                localStorage.setItem('cerebroAchievements', JSON.stringify(data));
                return data;
            }
            
            // Se API retornou vazio mas temos dados locais
            const localData = this.loadFromLocalStorage();
            if (Object.keys(localData).length > 0) {
                Logger.info('API vazia, usando conquistas locais');
                return localData;
            }
            
            return {};
        } catch (error) {
            Logger.error('Erro ao carregar conquistas da API:', error);
            // Fallback para localStorage se API falhar
            return this.loadFromLocalStorage();
        }
    },

    /**
     * Carrega conquistas do localStorage
     */
    loadFromLocalStorage() {
        const saved = localStorage.getItem('cerebroAchievements');
        if (!saved) return {};
        
        try {
            const data = JSON.parse(saved);
            Logger.debug('Conquistas carregadas do localStorage');
            return data;
        } catch (error) {
            Logger.error('Erro ao parsear conquistas do localStorage:', error);
            return {};
        }
    },

    /**
     * Salva conquistas na API e localStorage
     */
    async save(achievements) {
        try {
            // Salvar na API
            const { Api } = await import('../api.js');
            await Api.saveAchievements(achievements);
            Logger.debug('Conquistas salvas na API');
        } catch (error) {
            Logger.error('Erro ao salvar conquistas na API:', error);
        }
        
        // Sempre salvar no localStorage como backup
        try {
            localStorage.setItem('cerebroAchievements', JSON.stringify(achievements));
            Logger.debug('Conquistas salvas no localStorage');
        } catch (error) {
            Logger.error('Erro ao salvar conquistas no localStorage:', error);
        }
    },

    /**
     * Verifica se dados estão no novo formato (por usuário)
     */
    isNewFormat(data) {
        if (!data || typeof data !== 'object') return true;
        
        const firstKey = Object.keys(data)[0];
        if (!firstKey) return true;
        
        // Se tem 'unlockedAt' direto na primeira chave, é formato antigo
        return !data[firstKey].unlockedAt;
    },

    /**
     * Migra formato antigo para novo formato
     */
    migrateOldFormat(oldData, currentUser) {
        if (!currentUser) return {};
        
        Logger.info('Migrando conquistas do formato antigo para novo');
        
        const newFormat = {};
        newFormat[currentUser] = {};
        
        for (const [achievementId, data] of Object.entries(oldData)) {
            newFormat[currentUser][achievementId] = {
                unlockedAt: data.unlockedAt || new Date().toISOString(),
                notified: true, // Marca como já notificado
                metadata: data.metadata || {}
            };
        }
        
        Logger.success('Migração concluída');
        return newFormat;
    },

    /**
     * Marca que o recalculo foi feito
     */
    markRecalculated() {
        const version = 'v3_' + Date.now();
        localStorage.setItem('cerebroAchievementsRecalculated', version);
        Logger.debug('Sistema marcado como v3:', version);
    },

    /**
     * Verifica se precisa recalcular
     * IMPORTANTE: Evitar recálculos automáticos que causam oscilação
     */
    needsRecalculation(achievements, hasData) {
        // Se não tem dados históricos, não precisa recalcular
        if (!hasData) {
            Logger.debug('Sem dados históricos - recalculo não necessário');
            return false;
        }
        
        // Se não tem conquistas salvas E tem dados, pode precisar calcular na PRIMEIRA vez
        const hasAchievements = Object.keys(achievements).length > 0;
        if (!hasAchievements) {
            // Verificar se já foi marcado como inicializado (evita recálculo em cada reload)
            const initVersion = localStorage.getItem('cerebroAchievementsRecalculated');
            if (initVersion && initVersion.startsWith('v3_')) {
                Logger.debug('Sistema já inicializado - não recalcular');
                return false;
            }
            Logger.info('Primeira inicialização - recalculo necessário');
            return true;
        }
        
        // Se formato está errado, migrar (mas não recalcular XP)
        if (!this.isNewFormat(achievements)) {
            Logger.info('Formato antigo detectado - migração necessária');
            return true;
        }
        
        // Verificar versão do recalculo - v3 = estável, não recalcular automaticamente
        const recalcVersion = localStorage.getItem('cerebroAchievementsRecalculated');
        if (!recalcVersion || !recalcVersion.startsWith('v3_')) {
            // Marcar como v3 mas NÃO recalcular
            this.markRecalculated();
            Logger.debug('Atualizado para v3 - não recalcular');
            return false;
        }
        
        Logger.debug('Recalculo não necessário');
        return false;
    }
};
