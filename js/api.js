/**
 * API MODULE
 * Handles communication with the server with JWT authentication
 */

const API_BASE = '/api';

export const Api = {
    // Helper para obter headers com autenticação
    getAuthHeaders() {
        const token = localStorage.getItem('cerebroToken');
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        };
    },

    // Helper para tratamento de erros
    async handleResponse(response, options = {}) {
        const { silentAuth = false } = options;
        
        if (response.status === 401 || response.status === 403) {
            // Não fazer logout automático se silentAuth estiver habilitado
            if (silentAuth) {
                console.warn('Autenticação falhou (silenciosa)');
                throw new Error('Não autorizado');
            }
            // Token expirado ou inválido - redirecionar para login
            console.warn('Sessão expirada. Redirecionando para login...');
            localStorage.clear();
            window.location.reload();
            throw new Error('Sessão expirada');
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            throw new Error(error.error || 'Erro na requisição');
        }

        return response.json();
    },

    /**
     * Requisição genérica GET
     */
    async get(url) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Erro ao fazer GET ${url}:`, error);
            return null;
        }
    },

    /**
     * Requisição genérica POST
     */
    async post(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Erro ao fazer POST ${url}:`, error);
            return null;
        }
    },

    // ============================================
    // COFFEE MADE
    // ============================================
    
    async getCoffeeMade() {
        try {
            const response = await fetch(`${API_BASE}/coffee-made`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar cafés feitos:', error);
            return [];
        }
    },
    
    async addCoffeeMade(record) {
        try {
            const response = await fetch(`${API_BASE}/coffee-made`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(record)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao adicionar café feito:', error);
            return null;
        }
    },
    
    // ============================================
    // COFFEE BROUGHT
    // ============================================
    
    async getCoffeeBrought() {
        try {
            const response = await fetch(`${API_BASE}/coffee-brought`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar cafés trazidos:', error);
            return [];
        }
    },
    
    async addCoffeeBrought(record) {
        try {
            const response = await fetch(`${API_BASE}/coffee-brought`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(record)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao adicionar café trazido:', error);
            return null;
        }
    },
    
    // ============================================
    // COFFEE HISTORY
    // ============================================
    
    async getCoffeeHistory() {
        try {
            const response = await fetch(`${API_BASE}/coffee-history`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            return [];
        }
    },
    
    async addCoffeeHistory(record) {
        try {
            const response = await fetch(`${API_BASE}/coffee-history`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(record)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao adicionar histórico:', error);
            return null;
        }
    },
    
    async trimCoffeeHistory(maxItems = 50) {
        try {
            const history = await this.getCoffeeHistory();
            if (history.length > maxItems) {
                const trimmed = history.slice(0, maxItems);
                await fetch(`${API_BASE}/coffee-history`, {
                    method: 'PUT',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(trimmed)
                });
            }
        } catch (error) {
            console.error('Erro ao limitar histórico:', error);
        }
    },
    
    // ============================================
    // RATINGS
    // ============================================
    
    async getRatings() {
        try {
            const response = await fetch(`${API_BASE}/ratings`, {
                headers: this.getAuthHeaders()
            });
            const data = await this.handleResponse(response);
            console.log('📊 Ratings carregadas do servidor:', data);
            return data || {};
        } catch (error) {
            console.error('❌ Erro ao buscar avaliações:', error);
            return {};
        }
    },
    
    async getRating(coffeeId) {
        try {
            const ratings = await this.getRatings();
            return ratings[coffeeId] || null;
        } catch (error) {
            console.error('Erro ao buscar avaliação:', error);
            return null;
        }
    },
    
    async saveRating(coffeeId, ratingData) {
        try {
            console.log('💾 Salvando rating para café:', coffeeId, ratingData);
            const response = await fetch(`${API_BASE}/ratings/${coffeeId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(ratingData)
            });
            const result = await this.handleResponse(response);
            console.log('✅ Rating salvo com sucesso:', result);
            return result;
        } catch (error) {
            console.error('❌ Erro ao salvar avaliação:', error);
            // 🔧 CORREÇÃO: Relançar o erro para que o state.js possa reverter
            throw error;
        }
    },
    
    // ============================================
    // CHAT MESSAGES
    // ============================================
    
    async getChatMessages() {
        try {
            const response = await fetch(`${API_BASE}/chat-messages`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
            return [];
        }
    },
    
    async addChatMessage(message) {
        try {
            const response = await fetch(`${API_BASE}/chat-messages`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(message)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao adicionar mensagem:', error);
            return null;
        }
    },
    
    async saveChatMessages(messages) {
        try {
            const response = await fetch(`${API_BASE}/chat-messages`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(messages)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao salvar mensagens:', error);
            return null;
        }
    },
    
    // ============================================
    // ACHIEVEMENTS (usando API v2 com Prisma)
    // ============================================
    
    async getAchievements() {
        try {
            // Usa nova rota v2 que lê do banco de dados Prisma
            const response = await fetch(`${API_BASE}/v2/achievements`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar conquistas:', error);
            return {};
        }
    },
    
    async getAchievementsByUsername(username) {
        try {
            const response = await fetch(`${API_BASE}/v2/achievements/${encodeURIComponent(username)}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar conquistas do usuário:', error);
            return [];
        }
    },
    
    async checkAchievements(username) {
        try {
            const response = await fetch(`${API_BASE}/v2/achievements/check/${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao verificar conquistas:', error);
            return null;
        }
    },
    
    /**
     * 🆕 Buscar estatísticas do usuário para progresso de conquistas
     * Retorna dados REAIS do banco de dados (não do cache local)
     */
    async getAchievementStats(username) {
        try {
            const response = await fetch(`${API_BASE}/v2/achievements/stats/${encodeURIComponent(username)}`, {
                headers: this.getAuthHeaders()
            });
            const data = await this.handleResponse(response);
            return data?.stats || null;
        } catch (error) {
            console.error('Erro ao buscar stats de conquistas:', error);
            return null;
        }
    },
    
    // 🔒 DEPRECATED: Mantido por compatibilidade com código antigo
    // Conquistas agora são salvas automaticamente via checkAchievements
    async saveAchievements(achievements) {
        // Silenciosamente ignorar - não fazer nada
        // (Backward compatibility, não quebrar código antigo)
        return null;
    },
    
    // ============================================
    // UTILITY METHODS
    // ============================================
    
    async getAllData() {
        try {
            const response = await fetch(`${API_BASE}/all/data`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar todos os dados:', error);
            return null;
        }
    },
    
    async clearAllData() {
        try {
            const response = await fetch(`${API_BASE}/all/data`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao limpar dados:', error);
            return null;
        }
    },

    // ============================================
    // SETTINGS (Configurações do Sistema)
    // ============================================

    async getSettings() {
        try {
            const response = await fetch(`${API_BASE}/v2/settings`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            return [];
        }
    },

    async getSetting(key) {
        try {
            const response = await fetch(`${API_BASE}/v2/settings/${encodeURIComponent(key)}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar configuração:', error);
            return null;
        }
    },

    async saveSetting(key, value) {
        try {
            const response = await fetch(`${API_BASE}/v2/settings/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ value })
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao salvar configuração:', error);
            return null;
        }
    },

    async deleteSetting(key) {
        try {
            const response = await fetch(`${API_BASE}/v2/settings/${encodeURIComponent(key)}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao deletar configuração:', error);
            return null;
        }
    },

    // XP Config específico
    async getXPConfig() {
        try {
            const response = await fetch(`${API_BASE}/v2/settings/xp/config`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar config XP:', error);
            return null;
        }
    },

    async saveXPConfig(config) {
        try {
            const response = await fetch(`${API_BASE}/v2/settings/xp/config`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ config })
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao salvar config XP:', error);
            return null;
        }
    },

    // ============================================
    // LEVELS (Níveis e XP dos Usuários)
    // ============================================

    async getLevels() {
        try {
            const response = await fetch(`${API_BASE}/v2/levels`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar níveis:', error);
            return {};
        }
    },

    async saveLevels(allData) {
        try {
            const response = await fetch(`${API_BASE}/v2/levels`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(allData)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao salvar níveis:', error);
            return null;
        }
    },

    async getUserLevel(username) {
        try {
            const response = await fetch(`${API_BASE}/v2/levels/${encodeURIComponent(username)}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar nível do usuário:', error);
            return null;
        }
    },

    async saveUserLevel(username, data) {
        try {
            const response = await fetch(`${API_BASE}/v2/levels/${encodeURIComponent(username)}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao salvar nível do usuário:', error);
            return null;
        }
    },

    async addUserXP(username, amount, reason = '') {
        try {
            const response = await fetch(`${API_BASE}/v2/levels/${encodeURIComponent(username)}/xp`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ amount, reason })
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao adicionar XP:', error);
            return null;
        }
    },

    async getLevelRanking(limit = 10) {
        try {
            const response = await fetch(`${API_BASE}/v2/levels/ranking?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar ranking:', error);
            return [];
        }
    },

    // ============================================
    // USERS (Lista de Usuários)
    // ============================================

    async getUsers() {
        try {
            const response = await fetch(`${API_BASE}/v2/users`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
            return [];
        }
    },

    // ============================================
    // XP AUDIT (Auditoria de Pontos)
    // ============================================

    /**
     * Buscar logs de auditoria de XP
     * @param {string} options.userId - ID do usuário
     * @param {string} options.username - Username do usuário (alternativa ao userId)
     * @param {string} options.source - Filtrar por source (coffee-made, rating, etc)
     * @param {number} options.limit - Limite de registros
     * @param {number} options.offset - Offset para paginação
     */
    async getXPAuditLogs(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.userId) params.append('userId', options.userId);
            if (options.username) params.append('username', options.username);
            if (options.source) params.append('source', options.source);
            if (options.limit) params.append('limit', options.limit.toString());
            if (options.offset) params.append('offset', options.offset.toString());

            const response = await fetch(`${API_BASE}/v2/admin/xp-audit?${params}`, {
                headers: this.getAuthHeaders()
            });
            // Usar modo silencioso para não causar logout em erro de permissão
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao buscar logs de XP:', error);
            return null;
        }
    },

    /**
     * Validar integridade de XP de um usuário
     */
    async validateUserXP(userId) {
        try {
            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/validate/${userId}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao validar XP:', error);
            return null;
        }
    },

    /**
     * Buscar resumo de auditoria de todos os usuários
     */
    async getXPAuditSummary() {
        try {
            console.log('[API] Buscando resumo de XP...');
            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/summary`, {
                headers: this.getAuthHeaders()
            });
            console.log('[API] Resposta summary:', response.status, response.statusText);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[API] Erro summary:', errorText);
                return null;
            }
            const data = await response.json();
            console.log('[API] Dados summary recebidos:', data);
            return data;
        } catch (error) {
            console.error('[API] Erro ao buscar resumo de XP:', error);
            return null;
        }
    },

    /**
     * Reverter uma transação de XP
     */
    async reverseXPTransaction(transactionId, reason) {
        try {
            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/reverse/${transactionId}`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ reason })
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao reverter transação:', error);
            return null;
        }
    },

    /**
     * 🆕 Buscar breakdown completo de XP de um usuário
     * Retorna todas as fontes de XP agrupadas com detalhes
     */
    async getXPUserBreakdown(userId) {
        try {
            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/user-breakdown/${userId}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao buscar breakdown de XP:', error);
            return null;
        }
    },

    /**
     * 🆕 Buscar breakdown de todos os usuários
     */
    async getXPAllUsersBreakdown() {
        try {
            console.log('[API] Buscando breakdown de todos usuários...');
            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/all-users-breakdown`, {
                headers: this.getAuthHeaders()
            });
            console.log('[API] Resposta all-users-breakdown:', response.status, response.statusText);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[API] Erro all-users-breakdown:', errorText);
                return null;
            }
            const data = await response.json();
            console.log('[API] Dados breakdown recebidos:', data);
            return data;
        } catch (error) {
            console.error('[API] Erro ao buscar breakdown de todos usuários:', error);
            return null;
        }
    },

    /**
     * 🆕 Buscar logs detalhados com filtros avançados
     */
    async getXPDetailedLogs(userId, options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.source) params.append('source', options.source);
            if (options.startDate) params.append('startDate', options.startDate);
            if (options.endDate) params.append('endDate', options.endDate);
            if (options.minAmount) params.append('minAmount', options.minAmount.toString());
            if (options.maxAmount) params.append('maxAmount', options.maxAmount.toString());
            if (options.limit) params.append('limit', options.limit.toString());
            if (options.offset) params.append('offset', options.offset.toString());
            if (options.sortBy) params.append('sortBy', options.sortBy);
            if (options.sortOrder) params.append('sortOrder', options.sortOrder);

            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/detailed-logs/${userId}?${params}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao buscar logs detalhados:', error);
            return null;
        }
    },

    /**
     * 🆕 Exportar dados de XP de um usuário
     */
    async exportUserXPData(userId) {
        try {
            const response = await fetch(`${API_BASE}/v2/admin/xp-audit/export/${userId}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao exportar dados:', error);
            return null;
        }
    },

    // ============================================
    // 🆕 REAÇÕES DE MENSAGENS
    // ============================================

    /**
     * Adicionar reação a uma mensagem (persiste no banco)
     */
    async addReaction(messageId, emoji, messageAuthor) {
        try {
            const response = await fetch(`${API_BASE}/v2/reactions`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ messageId, emoji, messageAuthor })
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao adicionar reação:', error);
            return null;
        }
    },

    /**
     * Remover reação de uma mensagem
     */
    async removeReaction(messageId, emoji) {
        try {
            const response = await fetch(`${API_BASE}/v2/reactions`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ messageId, emoji })
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao remover reação:', error);
            return null;
        }
    },

    /**
     * Buscar estatísticas de reações de um usuário
     */
    async getReactionStats(username) {
        try {
            const response = await fetch(`${API_BASE}/v2/reactions/stats/${encodeURIComponent(username)}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar estatísticas de reações:', error);
            return null;
        }
    },

    // ============================================
    // 🆕 COMUNICADOS (ANNOUNCEMENTS)
    // ============================================

    /**
     * Buscar comunicados ativos (usuários)
     */
    async getAnnouncements(limit = 10) {
        try {
            const response = await fetch(`${API_BASE}/v2/announcements?limit=${limit}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar comunicados:', error);
            return null;
        }
    },

    /**
     * Buscar todos os comunicados (admin)
     */
    async getAllAnnouncements(limit = 50, offset = 0) {
        try {
            const response = await fetch(`${API_BASE}/v2/announcements/all?limit=${limit}&offset=${offset}`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao buscar todos os comunicados:', error);
            return null;
        }
    },

    /**
     * Criar comunicado (admin)
     */
    async createAnnouncement(data) {
        try {
            const response = await fetch(`${API_BASE}/v2/announcements`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao criar comunicado:', error);
            return null;
        }
    },

    /**
     * Atualizar comunicado (admin)
     */
    async updateAnnouncement(id, data) {
        try {
            const response = await fetch(`${API_BASE}/v2/announcements/${id}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao atualizar comunicado:', error);
            return null;
        }
    },

    /**
     * Deletar comunicado (admin)
     */
    async deleteAnnouncement(id) {
        try {
            const response = await fetch(`${API_BASE}/v2/announcements/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao deletar comunicado:', error);
            return null;
        }
    },

    // ============================================
    // 🆕 SUGESTÕES (SUGGESTIONS)
    // ============================================

    /**
     * Buscar sugestões do usuário atual
     */
    async getMySuggestions() {
        try {
            const response = await fetch(`${API_BASE}/v2/suggestions`, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao buscar minhas sugestões:', error);
            throw error;
        }
    },

    /**
     * Buscar todas as sugestões (admin)
     */
    async getAllSuggestions(status, limit = 50, offset = 0) {
        try {
            let url = `${API_BASE}/v2/suggestions/all?limit=${limit}&offset=${offset}`;
            if (status) url += `&status=${encodeURIComponent(status)}`;
            
            const response = await fetch(url, {
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao buscar todas as sugestões:', error);
            return { suggestions: [], counts: {}, total: 0 };
        }
    },

    /**
     * Criar sugestão
     */
    async createSuggestion(data) {
        try {
            // Validação básica no cliente
            if (!data || !data.title || !data.content) {
                throw new Error('Título e conteúdo são obrigatórios');
            }
            
            const response = await fetch(`${API_BASE}/v2/suggestions`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao criar sugestão:', error);
            // Re-throw para o chamador tratar
            throw error;
        }
    },

    /**
     * Atualizar status da sugestão (admin)
     */
    async updateSuggestionStatus(id, status, adminNotes) {
        try {
            if (!id || !status) {
                throw new Error('ID e status são obrigatórios');
            }
            
            const response = await fetch(`${API_BASE}/v2/suggestions/${id}/status`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ status, adminNotes })
            });
            return await this.handleResponse(response, { silentAuth: true });
        } catch (error) {
            console.error('Erro ao atualizar status da sugestão:', error);
            throw error;
        }
    },

    /**
     * Deletar sugestão
     */
    async deleteSuggestion(id) {
        try {
            if (!id) {
                throw new Error('ID é obrigatório');
            }
            
            const response = await fetch(`${API_BASE}/v2/suggestions/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error('Erro ao deletar sugestão:', error);
            throw error;
        }
    }
};
