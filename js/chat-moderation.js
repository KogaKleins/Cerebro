/**
 * CHAT MODERATION MODULE
 * Sistema inteligente de moderação e anti-spam
 * 
 * 🛡️ ROBUSTO: Verificação periódica do ban no servidor
 * 🔒 PERSISTENTE: Ban sempre verificado no servidor antes de enviar mensagens
 */

import MODERATION_CONFIG from './chat-moderation-config.js';

export const ChatModeration = {
    // Referência à configuração externa
    config: MODERATION_CONFIG,
    
    // Armazenamento local de histórico do usuário
    userHistory: new Map(),
    
    // Usuários bloqueados
    blockedUsers: new Map(),
    
    // 🆕 Timestamp da última verificação de ban no servidor
    lastBanCheckTimestamp: 0,
    
    // 🆕 Intervalo mínimo entre verificações de ban (15 segundos)
    BAN_CHECK_INTERVAL_MS: 15000,
    
    // 🆕 Interval para verificação periódica
    banCheckInterval: null,
    
    // 🆕 Flag para evitar verificações simultâneas
    isCheckingBan: false,
    
    /**
     * 🆕 Verificar ban no servidor (fonte de verdade)
     * Sempre consulta o backend para garantir que o status está correto
     */
    async checkBanFromServer(forceCheck = false) {
        // Evitar verificações simultâneas
        if (this.isCheckingBan) {
            return this.blockedUsers.get(this._getCurrentUser()) || null;
        }
        
        // Se não forçar, verificar intervalo mínimo
        const now = Date.now();
        if (!forceCheck && (now - this.lastBanCheckTimestamp) < this.BAN_CHECK_INTERVAL_MS) {
            // Usar cache local
            const currentUser = this._getCurrentUser();
            return currentUser ? this.blockedUsers.get(currentUser) : null;
        }
        
        this.isCheckingBan = true;
        
        try {
            const { State } = await import('./state.js');
            const currentUser = State.getUser();
            
            if (!currentUser) {
                this.isCheckingBan = false;
                return null;
            }
            
            const token = localStorage.getItem('token') || localStorage.getItem('cerebroToken');
            if (!token) {
                this.isCheckingBan = false;
                return this.blockedUsers.get(currentUser) || null;
            }
            
            const response = await fetch(`/api/v2/users/${encodeURIComponent(currentUser)}/ban-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const banStatus = await response.json();
                this.lastBanCheckTimestamp = now;
                
                if (banStatus.banned && banStatus.until) {
                    const until = new Date(banStatus.until).getTime();
                    if (until > now) {
                        // Usuário está banido - atualizar Map local
                        const blockData = {
                            reason: banStatus.reason || 'Violação das regras',
                            blockedAt: now,
                            until: until,
                            messagesToDelete: [],
                            serverVerified: true // 🆕 Flag indicando que veio do servidor
                        };
                        this.blockedUsers.set(currentUser, blockData);
                        this.saveBlockedUsers();
                        
                        console.log(`[Moderação] ✅ Ban verificado no servidor: ${currentUser} até ${new Date(until).toLocaleString()}`);
                        this.isCheckingBan = false;
                        return blockData;
                    }
                }
                
                // Usuário NÃO está banido - remover do Map local se existir
                if (this.blockedUsers.has(currentUser)) {
                    console.log(`[Moderação] 🔓 Ban expirado confirmado pelo servidor para: ${currentUser}`);
                    this.blockedUsers.delete(currentUser);
                    this.saveBlockedUsers();
                }
                
                this.isCheckingBan = false;
                return null;
            }
        } catch (error) {
            console.warn('[Moderação] Erro ao verificar ban no servidor:', error);
        }
        
        this.isCheckingBan = false;
        // Fallback: usar cache local
        const currentUser = this._getCurrentUser();
        return currentUser ? this.blockedUsers.get(currentUser) : null;
    },
    
    /**
     * 🆕 Helper para obter usuário atual de forma síncrona
     */
    _getCurrentUser() {
        try {
            return localStorage.getItem('cerebroUser') || null;
        } catch {
            return null;
        }
    },
    
    // Carregar bloqueios do localStorage E do backend
    async loadBlockedUsers() {
        try {
            // 🆕 PRIORIDADE: Carregar do backend (persistência real)
            const { State } = await import('./state.js');
            const currentUser = State.getUser();
            
            if (currentUser) {
                try {
                    const token = localStorage.getItem('token') || localStorage.getItem('cerebroToken');
                    const response = await fetch(`/api/v2/users/${encodeURIComponent(currentUser)}/ban-status`, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const banStatus = await response.json();
                        this.lastBanCheckTimestamp = Date.now();
                        
                        if (banStatus.banned && banStatus.until) {
                            const until = new Date(banStatus.until).getTime();
                            if (until > Date.now()) {
                                this.blockedUsers.set(currentUser, {
                                    reason: banStatus.reason || 'Violação das regras',
                                    blockedAt: Date.now(),
                                    until: until,
                                    messagesToDelete: [],
                                    serverVerified: true
                                });
                                console.log(`[Moderação] Ban carregado do banco: ${currentUser} até ${new Date(until).toLocaleString()}`);
                            }
                        }
                    }
                } catch (apiError) {
                    console.warn('[Moderação] Erro ao verificar ban no backend, usando localStorage:', apiError);
                }
            }
            
            // Fallback: carregar localStorage (compatibilidade)
            const stored = localStorage.getItem('chat_blocked_users');
            if (stored) {
                const blocks = JSON.parse(stored);
                const now = Date.now();
                
                // Carregar apenas bloqueios ainda válidos (que não estão já no Map do backend)
                Object.entries(blocks).forEach(([username, blockData]) => {
                    if (blockData.until > now && !this.blockedUsers.has(username)) {
                        this.blockedUsers.set(username, blockData);
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao carregar usuários bloqueados:', error);
        }
    },
    
    // Salvar bloqueios no localStorage
    saveBlockedUsers() {
        try {
            const blocks = {};
            this.blockedUsers.forEach((blockData, username) => {
                blocks[username] = blockData;
            });
            localStorage.setItem('chat_blocked_users', JSON.stringify(blocks));
        } catch (error) {
            console.error('Erro ao salvar usuários bloqueados:', error);
        }
    },
    
    // Verificar se usuário está bloqueado
    // 🆕 CORREÇÃO: Método síncrono para verificação local rápida
    isUserBlocked(username) {
        if (!this.blockedUsers.has(username)) return null;
        
        const blockData = this.blockedUsers.get(username);
        const now = Date.now();
        
        if (blockData.until > now) {
            return blockData;
        } else {
            // Bloqueio expirou, remover
            this.blockedUsers.delete(username);
            this.saveBlockedUsers();
            return null;
        }
    },
    
    /**
     * 🆕 Verificar ban de forma robusta (consulta servidor se necessário)
     * USAR ESTE MÉTODO antes de enviar mensagens
     */
    async isUserBlockedAsync(username) {
        // Primeiro, verificar cache local para resposta rápida
        const localBlock = this.isUserBlocked(username);
        
        // Se tiver ban local com flag serverVerified recente, confiar nele
        if (localBlock && localBlock.serverVerified) {
            const timeSinceCheck = Date.now() - this.lastBanCheckTimestamp;
            if (timeSinceCheck < this.BAN_CHECK_INTERVAL_MS) {
                return localBlock;
            }
        }
        
        // Verificar no servidor para garantir consistência
        const serverBlock = await this.checkBanFromServer();
        return serverBlock;
    },
    
    // Adicionar mensagem ao histórico do usuário
    addToHistory(username, message) {
        if (!this.userHistory.has(username)) {
            this.userHistory.set(username, []);
        }
        
        const history = this.userHistory.get(username);
        history.push({
            text: message.text,
            timestamp: Date.now(),
            id: message.id
        });
        
        // Manter apenas últimas 20 mensagens
        if (history.length > 20) {
            history.shift();
        }
    },
    
    // Calcular similaridade entre duas strings (Levenshtein simplificado)
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    },
    
    // Distância de Levenshtein
    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    },
    
    // Verificar se a mensagem é spam
    checkSpam(username, messageText) {
        // Verificar whitelist
        if (this.config.whitelist?.enabled && this.config.whitelist?.users?.includes(username)) {
            return { passed: true, warnings: [], violations: [], severity: 0 };
        }
        
        const history = this.userHistory.get(username) || [];
        const now = Date.now();
        const checks = {
            passed: true,
            warnings: [],
            violations: [],
            severity: 0
        };
        
        // 1. Verificar mensagens idênticas
        if (this.config.identical?.enabled) {
            const recentMessages = history.filter(m => 
                now - m.timestamp < this.config.identical.timeWindow
            );
            
            const identicalCount = recentMessages.filter(m => 
                m.text.toLowerCase() === messageText.toLowerCase()
            ).length;
            
            if (identicalCount >= this.config.identical.maxMessages) {
                checks.passed = false;
                checks.violations.push(this.config.identical.description);
                checks.severity += this.config.identical.severity;
            } else if (this.config.warnings?.enabled && identicalCount >= this.config.identical.maxMessages * this.config.warnings.threshold) {
                const remaining = this.config.identical.maxMessages - identicalCount;
                checks.warnings.push(`Você está enviando mensagens idênticas.${this.config.warnings.showCount ? ` ${remaining} antes do bloqueio.` : ''}`);
                checks.severity += 1;
            }
        }
        
        // 2. Verificar flood (muitas mensagens rápidas)
        if (this.config.flood?.enabled) {
            const messagesLastMinute = history.filter(m => 
                now - m.timestamp < 60000
            ).length;
            
            if (messagesLastMinute >= this.config.flood.maxMessagesPerMinute) {
                checks.passed = false;
                checks.violations.push(this.config.flood.description);
                checks.severity += this.config.flood.severity;
            } else if (this.config.warnings?.enabled && messagesLastMinute >= this.config.flood.maxMessagesPerMinute * this.config.warnings.threshold) {
                const remaining = this.config.flood.maxMessagesPerMinute - messagesLastMinute;
                checks.warnings.push(`Você está enviando mensagens muito rápido.${this.config.warnings.showCount ? ` ${remaining} antes do bloqueio.` : ''}`);
                checks.severity += 1;
            }
            
            // 3. Verificar intervalo mínimo
            if (history.length > 0) {
                const lastMessage = history[history.length - 1];
                const timeSinceLastMessage = now - lastMessage.timestamp;
                
                if (timeSinceLastMessage < this.config.flood.minInterval) {
                    if (this.config.warnings?.enabled) {
                        checks.warnings.push('Aguarde um momento antes de enviar outra mensagem.');
                    }
                    checks.severity += 1;
                }
            }
        }
        
        // 4. Verificar mensagens curtas repetidas
        if (this.config.shortMessages?.enabled) {
            const recentShort = history.slice(-this.config.shortMessages.maxConsecutive).filter(m =>
                m.text.trim().length <= this.config.shortMessages.maxLength
            );
            
            if (messageText.trim().length <= this.config.shortMessages.maxLength) {
                if (recentShort.length >= this.config.shortMessages.maxConsecutive - 1) {
                    checks.passed = false;
                    checks.violations.push(this.config.shortMessages.description);
                    checks.severity += this.config.shortMessages.severity;
                } else if (this.config.warnings?.enabled && recentShort.length >= (this.config.shortMessages.maxConsecutive - 1) * this.config.warnings.threshold) {
                    checks.warnings.push('Evite enviar muitas mensagens curtas seguidas.');
                    checks.severity += 1;
                }
            }
        }
        
        // 5. Verificar mensagens similares
        if (this.config.similarity?.enabled) {
            const recentForSimilarity = history.slice(-this.config.similarity.maxSimilar);
            const similarCount = recentForSimilarity.filter(m => {
                const similarity = this.calculateSimilarity(
                    m.text.toLowerCase(),
                    messageText.toLowerCase()
                );
                return similarity >= this.config.similarity.threshold;
            }).length;
            
            if (similarCount >= this.config.similarity.maxSimilar - 1) {
                checks.passed = false;
                checks.violations.push(this.config.similarity.description);
                checks.severity += this.config.similarity.severity;
            } else if (this.config.warnings?.enabled && similarCount >= (this.config.similarity.maxSimilar - 1) * this.config.warnings.threshold) {
                checks.warnings.push('Você está enviando mensagens muito parecidas.');
                checks.severity += 1;
            }
        }
        
        // Debug log
        if (this.config.debug?.enabled && this.config.debug?.logChecks) {
            console.log(`[Moderação] Verificação para ${username}:`, checks);
        }
        
        return checks;
    },
    
    // Bloquear usuário (agora persiste no banco)
    async blockUser(username, reason, messagesToDelete = []) {
        if (!this.config.blocking?.enabled) {
            console.warn('[Moderação] Sistema de bloqueio está desativado');
            return null;
        }
        
        const durationMs = this.config.blocking.duration;
        const until = Date.now() + durationMs;
        const blockData = {
            reason,
            blockedAt: Date.now(),
            until,
            messagesToDelete,
            serverVerified: false // Será true após confirmar no servidor
        };
        
        this.blockedUsers.set(username, blockData);
        
        // 🆕 PERSISTIR NO BANCO (principal)
        try {
            const token = localStorage.getItem('token') || localStorage.getItem('cerebroToken');
            const response = await fetch(`/api/v2/users/${encodeURIComponent(username)}/ban`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: reason,
                    durationMs: durationMs
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`[Moderação] ✅ Ban persistido no banco: ${username}`, result);
                
                // 🆕 Marcar como verificado pelo servidor e atualizar tempo
                if (result.until) {
                    blockData.until = new Date(result.until).getTime();
                }
                blockData.serverVerified = true;
                this.blockedUsers.set(username, blockData);
                this.lastBanCheckTimestamp = Date.now();
            } else {
                console.warn('[Moderação] ⚠️ Falha ao persistir ban no backend:', await response.text());
            }
        } catch (apiError) {
            console.warn('[Moderação] ⚠️ Erro ao persistir ban no backend:', apiError);
        }
        
        // Fallback: salvar localStorage também (compatibilidade)
        if (this.config.blocking.persistBlocks) {
            this.saveBlockedUsers();
        }
        
        // Debug log
        if (this.config.debug?.enabled && this.config.debug?.logBlocks) {
            console.log(`[Moderação] Usuário bloqueado: ${username}`, blockData);
        }
        
        return blockData;
    },
    
    // Obter tempo restante de bloqueio
    getBlockTimeRemaining(username) {
        const blockData = this.isUserBlocked(username);
        if (!blockData) return 0;
        
        const remaining = blockData.until - Date.now();
        return Math.max(0, remaining);
    },
    
    // Formatar tempo restante
    formatBlockTime(milliseconds) {
        const minutes = Math.ceil(milliseconds / 60000);
        
        if (minutes < 60) {
            return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            
            if (remainingMinutes === 0) {
                return `${hours} hora${hours !== 1 ? 's' : ''}`;
            } else {
                return `${hours}h ${remainingMinutes}min`;
            }
        }
    },
    
    // Limpar histórico antigo
    cleanOldHistory() {
        if (!this.config.cleanup?.enabled) return;
        
        const now = Date.now();
        const maxAge = this.config.cleanup.historyMaxAge;
        
        this.userHistory.forEach((history, username) => {
            const filtered = history.filter(m => now - m.timestamp < maxAge);
            if (filtered.length === 0) {
                this.userHistory.delete(username);
            } else {
                this.userHistory.set(username, filtered);
            }
        });
    },
    
    /**
     * 🆕 Iniciar verificação periódica de ban
     * Garante que bans não expirem no frontend sem verificar o servidor
     */
    startPeriodicBanCheck() {
        // Parar intervalo anterior se existir
        if (this.banCheckInterval) {
            clearInterval(this.banCheckInterval);
        }
        
        // Verificar a cada 30 segundos se o usuário tem um ban ativo
        this.banCheckInterval = setInterval(async () => {
            const currentUser = this._getCurrentUser();
            if (!currentUser) return;
            
            // Se tiver ban local, verificar no servidor
            if (this.blockedUsers.has(currentUser)) {
                console.log('[Moderação] 🔄 Verificação periódica de ban...');
                await this.checkBanFromServer(true); // forçar verificação
            }
        }, 30000); // 30 segundos
        
        console.log('[Moderação] ⏱️ Verificação periódica de ban iniciada (30s)');
    },
    
    /**
     * 🆕 Parar verificação periódica
     */
    stopPeriodicBanCheck() {
        if (this.banCheckInterval) {
            clearInterval(this.banCheckInterval);
            this.banCheckInterval = null;
        }
    },
    
    // Inicializar módulo
    async init() {
        // Validar configuração
        if (this.config.debug?.enabled) {
            console.log('[Moderação] Inicializando sistema de moderação...');
            console.log('[Moderação] Configuração atual:', this.config);
        }
        
        // Verificar se módulos necessários estão habilitados
        const warnings = [];
        if (!this.config.identical?.enabled && !this.config.flood?.enabled && 
            !this.config.shortMessages?.enabled && !this.config.similarity?.enabled) {
            warnings.push('Todas as verificações estão desabilitadas');
        }
        
        if (!this.config.blocking?.enabled) {
            warnings.push('Sistema de bloqueio desabilitado');
        }
        
        if (warnings.length > 0 && this.config.debug?.enabled) {
            console.warn('[Moderação] Avisos de configuração:', warnings);
        }
        
        // 🆕 Carregar bans do banco (async)
        await this.loadBlockedUsers();
        
        // 🆕 Iniciar verificação periódica de ban
        this.startPeriodicBanCheck();
        
        // Limpar histórico antigo periodicamente
        if (this.config.cleanup?.enabled) {
            setInterval(() => {
                this.cleanOldHistory();
            }, this.config.cleanup.interval);
        }
        
        // 🆕 Listener para quando a aba volta ao foco - verificar ban imediatamente
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible') {
                const currentUser = this._getCurrentUser();
                if (currentUser && this.blockedUsers.has(currentUser)) {
                    console.log('[Moderação] 🔄 Aba voltou ao foco - verificando ban...');
                    await this.checkBanFromServer(true);
                }
            }
        });
        
        if (this.config.debug?.enabled) {
            console.log('[Moderação] Sistema inicializado com sucesso');
            console.log('[Moderação] Regras ativas:', {
                identical: this.config.identical?.enabled,
                flood: this.config.flood?.enabled,
                shortMessages: this.config.shortMessages?.enabled,
                similarity: this.config.similarity?.enabled,
                blocking: this.config.blocking?.enabled,
                warnings: this.config.warnings?.enabled
            });
        }
    }
};
