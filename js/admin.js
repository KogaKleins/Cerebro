/**
 * ADMIN MODULE
 * Interface administrativa completa para gerenciar o sistema
 */

import { Api } from './api.js';
import { State } from './state.js';
import { Auth } from './auth.js';
import { Utils } from './utils.js';

export const Admin = {
    currentTab: 'coffee-made',
    selectedItems: new Set(),
    allData: {},
    logs: [],
    currentPage: 1,
    itemsPerPage: 50,
    
    init() {
        if (!Auth.isAdmin()) {
            console.log('Admin: Usuário não é administrador');
            return;
        }
        
        this.setupAdminPanel();
        this.loadData();
        this.updateStats();
        this.initXPConfig();
        this.loadUserList();
        this.addLog('Sistema administrativo inicializado', 'info');
    },
    
    setupAdminPanel() {
        // Adicionar botão de admin no sidebar se não existir
        const sidebar = document.querySelector('.sidebar-nav ul');
        if (sidebar && !document.getElementById('adminNavBtn')) {
            const adminItem = document.createElement('li');
            adminItem.innerHTML = `
                <a href="#" data-page="admin" id="adminNavBtn">
                    <i class="fas fa-user-shield"></i>
                    <span>Administração</span>
                </a>
            `;
            sidebar.appendChild(adminItem);
        }
    },
    
    async loadData() {
        try {
            const [coffeeMade, coffeeBrought, coffeeHistory, chatMessages, ratings] = await Promise.all([
                Api.getCoffeeMade(),
                Api.getCoffeeBrought(),
                Api.getCoffeeHistory(),
                Api.getChatMessages(),
                Api.getRatings()
            ]);
            
            this.allData = {
                'coffee-made': coffeeMade,
                'coffee-brought': coffeeBrought,
                'coffee-history': coffeeHistory,
                'chat-messages': chatMessages,
                'ratings': Object.values(ratings || {})
            };
            
            this.renderDataTable(this.currentTab);
            this.updateStats();
            this.addLog(`Dados carregados: ${coffeeMade.length + coffeeBrought.length} cafés, ${chatMessages.length} mensagens`, 'info');
        } catch (error) {
            console.error('Erro ao carregar dados admin:', error);
            Utils.showToast('Erro ao carregar dados', 'error');
            this.addLog(`Erro ao carregar dados: ${error.message}`, 'error');
        }
    },
    
    updateStats() {
        // Atualizar cards de estatísticas
        const totalCoffees = (this.allData['coffee-made']?.length || 0) + (this.allData['coffee-brought']?.length || 0);
        const totalMessages = this.allData['chat-messages']?.length || 0;
        const totalRatings = this.allData['ratings']?.length || 0;
        
        // Contar usuários únicos
        const users = new Set();
        this.allData['coffee-made']?.forEach(c => users.add(c.name));
        this.allData['coffee-brought']?.forEach(c => users.add(c.name));
        this.allData['chat-messages']?.forEach(m => users.add(m.author));
        
        document.getElementById('adminTotalCoffees')?.textContent && (document.getElementById('adminTotalCoffees').textContent = totalCoffees);
        document.getElementById('adminTotalMessages')?.textContent && (document.getElementById('adminTotalMessages').textContent = totalMessages);
        document.getElementById('adminTotalUsers')?.textContent && (document.getElementById('adminTotalUsers').textContent = users.size);
        document.getElementById('adminTotalRatings')?.textContent && (document.getElementById('adminTotalRatings').textContent = totalRatings);
    },
    
    addLog(message, type = 'info') {
        const now = new Date();
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        this.logs.unshift({ time, message, type });
        
        // Manter apenas últimos 50 logs
        if (this.logs.length > 50) this.logs.pop();
        
        this.renderLogs();
    },
    
    renderLogs() {
        const container = document.getElementById('adminLogsContainer');
        if (!container) return;
        
        container.innerHTML = this.logs.slice(0, 20).map(log => `
            <div class="log-entry ${log.type}">
                <span class="log-time">${log.time}</span>${log.message}
            </div>
        `).join('');
    },
    
    changeTab(tab) {
        this.currentTab = tab;
        this.selectedItems.clear();
        this.currentPage = 1; // Reset para primeira página
        
        // Se for aba de XP Audit, renderizar especial
        if (tab === 'xp-audit') {
            this.renderXPAuditTab();
        } else {
            this.renderDataTable(tab);
        }
        
        // Atualizar UI dos tabs
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
        
        this.addLog(`Tab alterada para: ${tab}`, 'info');
    },

    // ============================================
    // 🆕 SISTEMA DE AUDITORIA DE XP AVANÇADO
    // ============================================

    /** Estado do módulo de auditoria */
    auditState: {
        selectedUserId: null,
        currentView: 'overview', // 'overview' | 'breakdown' | 'logs'
        filters: {
            source: 'all',
            startDate: null,
            endDate: null
        },
        logsOffset: 0,
        logsLimit: 50
    },

    /**
     * Renderiza a aba de Auditoria de XP com interface PROFISSIONAL
     */
    async renderXPAuditTab() {
        const container = document.getElementById('adminDataTable');
        if (!container) return;

        container.innerHTML = `
            <div class="xp-audit-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando dados de auditoria...</p>
            </div>
        `;

        try {
            // Carregar dados em paralelo com logs de debug
            console.log('[XP Audit] Iniciando carregamento de dados...');
            
            const [summary, users, allUsersBreakdown] = await Promise.all([
                Api.getXPAuditSummary().catch(e => { console.error('[XP Audit] Erro summary:', e); return null; }),
                Api.getUsers().catch(e => { console.error('[XP Audit] Erro users:', e); return []; }),
                Api.getXPAllUsersBreakdown().catch(e => { console.error('[XP Audit] Erro breakdown:', e); return null; })
            ]);
            
            console.log('[XP Audit] Dados carregados:', { summary, users: users?.length, allUsersBreakdown });

            // Se não houver dados, mostrar mensagem detalhada
            if (!summary && !allUsersBreakdown) {
                console.warn('[XP Audit] Nenhum dado retornado das APIs');
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-info-circle"></i>
                        <p>Não há dados de auditoria disponíveis</p>
                        <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
                            Verifique o console para mais detalhes. APIs podem estar indisponíveis.
                        </small>
                        <button type="button" class="btn-secondary" style="margin-top: 1rem;" onclick="window.adminChangeTab('xp-audit')">
                            <i class="fas fa-sync"></i> Tentar Novamente
                        </button>
                    </div>
                `;
                return;
            }

            // Garantir dados seguros
            const safeUsers = users || [];
            const safeSummary = summary || { 
                summary: { totalUsers: 0, totalXPDistributed: 0, averageXPPerUser: 0 },
                bySource: [],
                topUsers: []
            };
            const safeBreakdown = allUsersBreakdown || { globalStats: {}, users: [] };

            // Renderizar interface completa
            container.innerHTML = `
                <div class="xp-audit-container-pro">
                    <!-- Header com estatísticas globais -->
                    <div class="xp-audit-header glass-card">
                        <div class="audit-header-title">
                            <h3><i class="fas fa-chart-line"></i> Painel de Auditoria de XP</h3>
                            <p>Visualização completa e granular de todas as transações de pontos</p>
                        </div>
                        <div class="audit-global-stats">
                            <div class="global-stat">
                                <i class="fas fa-users"></i>
                                <div class="stat-content">
                                    <span class="stat-value">${safeSummary.summary.totalUsers}</span>
                                    <span class="stat-label">Usuários</span>
                                </div>
                            </div>
                            <div class="global-stat highlight">
                                <i class="fas fa-coins"></i>
                                <div class="stat-content">
                                    <span class="stat-value">${safeSummary.summary.totalXPDistributed.toLocaleString()}</span>
                                    <span class="stat-label">XP Total</span>
                                </div>
                            </div>
                            <div class="global-stat">
                                <i class="fas fa-chart-bar"></i>
                                <div class="stat-content">
                                    <span class="stat-value">${safeSummary.summary.averageXPPerUser.toLocaleString()}</span>
                                    <span class="stat-label">Média/Usuário</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Grid Principal -->
                    <div class="xp-audit-main-grid">
                        <!-- Coluna Esquerda: Seleção e Breakdown por Fonte -->
                        <div class="xp-audit-left-column">
                            <!-- Seletor de Usuário Melhorado -->
                            <div class="xp-audit-user-picker glass-card">
                                <h4><i class="fas fa-user-circle"></i> Selecionar Usuário</h4>
                                <div class="user-picker-controls">
                                    <div class="search-select-wrapper">
                                        <i class="fas fa-search"></i>
                                        <select id="auditUserSelect" onchange="window.adminLoadUserBreakdown(this.value)">
                                            <option value="">-- Selecione um usuário para ver detalhes --</option>
                                            ${safeUsers.map(u => `
                                                <option value="${u.id}" data-xp="${u.totalXP || 0}">
                                                    ${u.name || u.username} (@${u.username})
                                                </option>
                                            `).join('')}
                                        </select>
                                    </div>
                                    <div class="picker-actions">
                                        <button class="btn-action-sm btn-validate" onclick="window.adminValidateSelectedUser()" title="Validar integridade do XP">
                                            <i class="fas fa-check-circle"></i>
                                        </button>
                                        <button class="btn-action-sm btn-export" onclick="window.adminExportUserXP()" title="Exportar dados">
                                            <i class="fas fa-download"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Breakdown por Fonte Global -->
                            <div class="xp-audit-source-breakdown glass-card">
                                <h4><i class="fas fa-layer-group"></i> Distribuição por Fonte</h4>
                                <div class="source-breakdown-list">
                                    ${(safeSummary.bySource || []).length > 0 ? 
                                        safeSummary.bySource.map(s => {
                                            const percent = safeSummary.summary.totalXPDistributed > 0 
                                                ? ((s.totalXP / safeSummary.summary.totalXPDistributed) * 100).toFixed(1)
                                                : 0;
                                            return `
                                                <div class="source-row" onclick="window.adminFilterBySource('${s.source}')">
                                                    <div class="source-info">
                                                        <span class="source-icon">${this.getSourceIcon(s.source)}</span>
                                                        <span class="source-name">${this.formatSourceName(s.source)}</span>
                                                    </div>
                                                    <div class="source-stats">
                                                        <span class="source-xp">${(s.totalXP || 0).toLocaleString()} XP</span>
                                                        <span class="source-percent">${percent}%</span>
                                                    </div>
                                                    <div class="source-bar">
                                                        <div class="source-bar-fill" style="width: ${percent}%"></div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('') 
                                        : '<p class="empty-msg">Nenhuma fonte registrada</p>'
                                    }
                                </div>
                            </div>
                        </div>

                        <!-- Coluna Direita: Detalhes do Usuário -->
                        <div class="xp-audit-right-column">
                            <!-- Área de Detalhes do Usuário -->
                            <div class="xp-audit-user-details glass-card" id="userAuditDetails">
                                <div class="user-details-placeholder">
                                    <i class="fas fa-user-check"></i>
                                    <p>Selecione um usuário para ver o breakdown detalhado de XP</p>
                                    <small>Você verá exatamente de onde veio cada ponto</small>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Ranking de Usuários com Breakdown Inline -->
                    <div class="xp-audit-ranking glass-card">
                        <div class="ranking-header">
                            <h4><i class="fas fa-trophy"></i> Ranking de Usuários com Breakdown</h4>
                            <div class="ranking-controls">
                                <button class="btn-sm ${this.auditState.currentView === 'compact' ? 'active' : ''}" onclick="window.adminToggleRankingView('compact')">
                                    <i class="fas fa-list"></i> Compacto
                                </button>
                                <button class="btn-sm ${this.auditState.currentView === 'detailed' ? 'active' : ''}" onclick="window.adminToggleRankingView('detailed')">
                                    <i class="fas fa-th-large"></i> Detalhado
                                </button>
                            </div>
                        </div>
                        <div class="ranking-list" id="userRankingList">
                            ${this.renderUserRanking(safeBreakdown.users || safeSummary.topUsers || [])}
                        </div>
                    </div>
                </div>
            `;

            this.addLog('Painel de auditoria carregado com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao carregar auditoria:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar auditoria: ${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * Renderiza o ranking de usuários com breakdown inline
     */
    renderUserRanking(users) {
        if (!users || users.length === 0) {
            return '<p class="empty-msg">Nenhum usuário encontrado</p>';
        }

        return users.map((u, index) => {
            const breakdown = u.breakdown || {};
            const hasBreakdown = Object.keys(breakdown).length > 0;
            
            // Verificar se tem foto real ou usar fallback
            const userPhoto = u.photo || this.getUserPhotoPath(u.username);
            const hasRealPhoto = userPhoto && !userPhoto.includes('👤');
            
            return `
                <div class="ranking-user-card" data-user-id="${u.userId || u.id}">
                    <div class="ranking-position ${index < 3 ? `top-${index + 1}` : ''}">
                        ${index < 3 ? this.getMedalIcon(index) : `${index + 1}º`}
                    </div>
                    <div class="ranking-user-info">
                        <div class="user-avatar-sm ${hasRealPhoto ? 'has-photo' : ''}">
                            ${hasRealPhoto 
                                ? `<img src="${userPhoto}" alt="${u.name}" onerror="this.parentElement.innerHTML='<span class=\\'avatar-initials\\'>${this.getInitials(u.name)}</span>'">`
                                : `<span class="avatar-initials">${this.getInitials(u.name || u.username)}</span>`
                            }
                        </div>
                        <div class="user-name-section">
                            <span class="user-name">${u.name || u.username || 'Usuário'}</span>
                            <span class="user-username">@${u.username || ''}</span>
                        </div>
                    </div>
                    <div class="ranking-xp-info">
                        <span class="xp-total">${(u.totalXP || 0).toLocaleString()} XP</span>
                        <span class="xp-level">Nível ${u.level || 1}</span>
                    </div>
                    <div class="ranking-breakdown-mini">
                        ${hasBreakdown ? Object.entries(breakdown).slice(0, 4).map(([source, xp]) => `
                            <span class="breakdown-chip" title="${this.formatSourceName(source)}: ${xp} XP">
                                ${this.getSourceIcon(source)} ${xp}
                            </span>
                        `).join('') : '<span class="no-breakdown">-</span>'}
                    </div>
                    <div class="ranking-actions">
                        <button class="btn-action-xs" onclick="window.adminLoadUserBreakdown('${u.userId || u.id}')" title="Ver detalhes">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * Carrega breakdown COMPLETO de um usuário
     */
    async loadUserBreakdown(userId) {
        if (!userId) return;

        this.auditState.selectedUserId = userId;
        const detailsContainer = document.getElementById('userAuditDetails');
        if (!detailsContainer) return;

        // Loading state
        detailsContainer.innerHTML = `
            <div class="loading-details">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Carregando breakdown completo...</p>
            </div>
        `;

        try {
            const breakdown = await Api.getXPUserBreakdown(userId);

            if (!breakdown) {
                detailsContainer.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Não foi possível carregar os dados deste usuário</p>
                    </div>
                `;
                return;
            }

            // Verificar foto do usuário
            const userPhoto = breakdown.user.photo || this.getUserPhotoPath(breakdown.user.username);
            const hasRealPhoto = userPhoto && !userPhoto.includes('👤');

            // Renderizar breakdown completo
            detailsContainer.innerHTML = `
                <div class="user-breakdown-container">
                    <!-- Header do Usuário -->
                    <div class="breakdown-user-header">
                        <div class="user-info-full">
                            <div class="user-avatar-lg ${hasRealPhoto ? 'has-photo' : ''}">
                                ${hasRealPhoto 
                                    ? `<img src="${userPhoto}" alt="${breakdown.user.name}" onerror="this.parentElement.innerHTML='<span class=\\'avatar-initials-lg\\'>${this.getInitials(breakdown.user.name)}</span>'">`
                                    : `<span class="avatar-initials-lg">${this.getInitials(breakdown.user.name)}</span>`
                                }
                            </div>
                            <div class="user-info-text">
                                <h3>${breakdown.user.name}</h3>
                                <span class="username">@${breakdown.user.username}</span>
                            </div>
                        </div>
                        <div class="user-xp-summary">
                            <div class="xp-total-badge ${!breakdown.summary.isConsistent ? 'has-warning' : ''}">
                                <span class="xp-value">${breakdown.summary.calculatedXP.toLocaleString()}</span>
                                <span class="xp-label">XP Auditado</span>
                            </div>
                            <div class="level-badge">
                                <span class="level-value">Nível ${breakdown.summary.level}</span>
                            </div>
                            ${!breakdown.summary.isConsistent ? `
                                <div class="warning-badge-container">
                                    <div class="warning-badge" title="XP no banco: ${breakdown.summary.totalXP.toLocaleString()}. Diferença: ${(breakdown.summary.totalXP - breakdown.summary.calculatedXP).toLocaleString()} XP">
                                        <i class="fas fa-exclamation-triangle"></i> 
                                        Diferença: ${(breakdown.summary.totalXP - breakdown.summary.calculatedXP) > 0 ? '+' : ''}${(breakdown.summary.totalXP - breakdown.summary.calculatedXP).toLocaleString()} XP
                                    </div>
                                    <button class="btn-sync-xp" onclick="window.adminSyncUserXP('${userId}')" title="Sincronizar XP com logs de auditoria">
                                        <i class="fas fa-sync-alt"></i> Corrigir
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Estatísticas Rápidas -->
                    <div class="breakdown-quick-stats">
                        <div class="quick-stat">
                            <i class="fas fa-coffee"></i>
                            <span class="stat-num">${breakdown.stats.totalCoffeesMade}</span>
                            <span class="stat-text">Cafés Feitos</span>
                        </div>
                        <div class="quick-stat">
                            <i class="fas fa-gift"></i>
                            <span class="stat-num">${breakdown.stats.totalCoffeesBrought}</span>
                            <span class="stat-text">Cafés Trazidos</span>
                        </div>
                        <div class="quick-stat">
                            <i class="fas fa-trophy"></i>
                            <span class="stat-num">${breakdown.stats.totalAchievements}</span>
                            <span class="stat-text">Conquistas</span>
                        </div>
                        <div class="quick-stat">
                            <i class="fas fa-comments"></i>
                            <span class="stat-num">${breakdown.stats.totalMessages}</span>
                            <span class="stat-text">Mensagens</span>
                        </div>
                        <div class="quick-stat">
                            <i class="fas fa-star"></i>
                            <span class="stat-num">${breakdown.stats.totalRatingsGiven}</span>
                            <span class="stat-text">Avaliações</span>
                        </div>
                        <div class="quick-stat">
                            <i class="fas fa-thumbs-up"></i>
                            <span class="stat-num">${breakdown.stats.totalReactionsReceived}</span>
                            <span class="stat-text">Reações</span>
                        </div>
                    </div>

                    <!-- Breakdown por Categoria -->
                    <div class="breakdown-categories">
                        <h4><i class="fas fa-sitemap"></i> Detalhamento por Categoria</h4>
                        <div class="categories-accordion">
                            ${breakdown.breakdown.map((category, idx) => `
                                <div class="category-item ${idx === 0 ? 'expanded' : ''}">
                                    <div class="category-header" onclick="window.adminToggleCategory(this)">
                                        <div class="category-info">
                                            <span class="category-icon">${category.icon}</span>
                                            <span class="category-name">${category.displayName}</span>
                                            <span class="category-count">${category.count} transação(ões)</span>
                                        </div>
                                        <div class="category-xp">
                                            <span class="xp-amount">+${category.totalXP.toLocaleString()} XP</span>
                                            <i class="fas fa-chevron-down expand-icon"></i>
                                        </div>
                                    </div>
                                    <div class="category-details">
                                        <div class="transaction-list">
                                            ${category.items.slice(0, 10).map(item => `
                                                <div class="transaction-item">
                                                    <div class="transaction-amount">+${item.amount}</div>
                                                    <div class="transaction-info">
                                                        <span class="transaction-reason">${item.reason}</span>
                                                        <span class="transaction-time">${new Date(item.timestamp).toLocaleString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                            `).join('')}
                                            ${category.items.length > 10 ? `
                                                <div class="show-more">
                                                    <button onclick="window.adminShowAllTransactions('${userId}', '${category.source}')">
                                                        Ver todas as ${category.count} transações
                                                    </button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Footer com Ações -->
                    <div class="breakdown-footer">
                        <span class="last-activity">
                            <i class="fas fa-clock"></i>
                            Última atividade: ${breakdown.lastActivity ? new Date(breakdown.lastActivity).toLocaleString('pt-BR') : 'Nunca'}
                        </span>
                        <div class="footer-actions">
                            <button class="btn-secondary" onclick="window.adminShowAllLogsModal('${userId}')">
                                <i class="fas fa-list"></i> Ver Todos os Logs
                            </button>
                            <button class="btn-primary" onclick="window.adminExportUserXP('${userId}')">
                                <i class="fas fa-download"></i> Exportar
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Atualizar select
            const select = document.getElementById('auditUserSelect');
            if (select) select.value = userId;

            this.addLog(`Breakdown carregado para: ${breakdown.user.name}`, 'info');
        } catch (error) {
            console.error('Erro ao carregar breakdown:', error);
            detailsContainer.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Erro: ${error.message}</p>
                </div>
            `;
        }
    },

    /**
     * Toggle de categoria no accordion
     */
    toggleCategory(header) {
        const item = header.closest('.category-item');
        if (item) {
            item.classList.toggle('expanded');
        }
    },

    /**
     * Mostra modal com todos os logs de uma fonte
     */
    async showAllTransactions(userId, source) {
        try {
            const result = await Api.getXPDetailedLogs(userId, { source, limit: 200 });
            if (!result) return;

            const modal = document.createElement('div');
            modal.className = 'xp-logs-modal';
            modal.innerHTML = `
                <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-list"></i> Todas as Transações - ${this.formatSourceName(source)}</h3>
                        <button class="modal-close" onclick="this.closest('.xp-logs-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-stats">
                        <span><strong>${result.stats.transactionCount}</strong> transações</span>
                        <span><strong>${result.stats.totalInFilter.toLocaleString()}</strong> XP total</span>
                        <span>Média: <strong>${result.stats.averagePerTransaction}</strong> XP</span>
                    </div>
                    <div class="modal-body">
                        <div class="logs-table-wrapper">
                            <table class="logs-table">
                                <thead>
                                    <tr>
                                        <th>Data/Hora</th>
                                        <th>XP</th>
                                        <th>Motivo</th>
                                        <th>Saldo Após</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${result.logs.map(log => `
                                        <tr>
                                            <td>${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                            <td class="xp-cell positive">+${log.amount}</td>
                                            <td>${log.reason}</td>
                                            <td>${log.balanceAfter.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            Utils.showToast('Erro ao carregar transações', 'error');
        }
    },

    /**
     * Mostra modal com TODOS os logs
     */
    async showAllLogsModal(userId) {
        try {
            const result = await Api.getXPDetailedLogs(userId, { limit: 500 });
            if (!result) return;

            const modal = document.createElement('div');
            modal.className = 'xp-logs-modal';
            modal.innerHTML = `
                <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3><i class="fas fa-history"></i> Histórico Completo de XP - ${result.user.name}</h3>
                        <button class="modal-close" onclick="this.closest('.xp-logs-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-filters">
                        <select id="modalSourceFilter" onchange="window.adminFilterModalLogs('${userId}')">
                            <option value="">Todas as fontes</option>
                            <option value="coffee-made">☕ Café Feito</option>
                            <option value="coffee-brought">🎁 Café Trazido</option>
                            <option value="achievement">🏆 Conquista</option>
                            <option value="rating">⭐ Avaliação</option>
                            <option value="message">💬 Mensagem</option>
                            <option value="reaction">👍 Reação</option>
                        </select>
                        <input type="date" id="modalStartDate" placeholder="Data inicial">
                        <input type="date" id="modalEndDate" placeholder="Data final">
                        <button class="btn-sm" onclick="window.adminApplyModalFilters('${userId}')">
                            <i class="fas fa-filter"></i> Filtrar
                        </button>
                    </div>
                    <div class="modal-stats">
                        <span><strong>${result.stats.transactionCount}</strong> transações</span>
                        <span><strong>${result.stats.totalInFilter.toLocaleString()}</strong> XP total</span>
                        <span>XP Atual: <strong>${result.user.totalXP.toLocaleString()}</strong></span>
                    </div>
                    <div class="modal-body" id="modalLogsBody">
                        ${this.renderLogsTable(result.logs)}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } catch (error) {
            Utils.showToast('Erro ao carregar logs', 'error');
        }
    },

    /**
     * Renderiza tabela de logs
     */
    renderLogsTable(logs) {
        if (!logs || logs.length === 0) {
            return '<p class="empty-msg">Nenhum log encontrado</p>';
        }

        return `
            <div class="logs-table-wrapper">
                <table class="logs-table">
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Fonte</th>
                            <th>XP</th>
                            <th>Motivo</th>
                            <th>Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr>
                                <td class="date-cell">${new Date(log.timestamp).toLocaleString('pt-BR')}</td>
                                <td><span class="source-badge">${this.getSourceIcon(log.source)} ${this.formatSourceName(log.source)}</span></td>
                                <td class="xp-cell ${log.amount >= 0 ? 'positive' : 'negative'}">${log.amount >= 0 ? '+' : ''}${log.amount}</td>
                                <td class="reason-cell">${log.reason}</td>
                                <td class="balance-cell">${log.balanceAfter.toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Aplica filtros no modal de logs
     */
    async applyModalFilters(userId) {
        const source = document.getElementById('modalSourceFilter')?.value;
        const startDate = document.getElementById('modalStartDate')?.value;
        const endDate = document.getElementById('modalEndDate')?.value;

        const body = document.getElementById('modalLogsBody');
        if (!body) return;

        body.innerHTML = '<div class="loading-inline"><i class="fas fa-spinner fa-spin"></i> Filtrando...</div>';

        try {
            const result = await Api.getXPDetailedLogs(userId, {
                source: source || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                limit: 500
            });

            body.innerHTML = this.renderLogsTable(result?.logs || []);
        } catch (error) {
            body.innerHTML = '<p class="error-msg">Erro ao filtrar</p>';
        }
    },

    /**
     * Exporta dados de XP do usuário
     */
    async exportUserXP(userId) {
        const targetId = userId || this.auditState.selectedUserId;
        if (!targetId) {
            Utils.showToast('Selecione um usuário primeiro', 'warning');
            return;
        }

        try {
            const data = await Api.exportUserXPData(targetId);
            if (!data) {
                Utils.showToast('Erro ao exportar dados', 'error');
                return;
            }

            // Criar e baixar arquivo JSON
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xp-export-${data.user.username}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            Utils.showToast('Dados exportados com sucesso!', 'success');
            this.addLog(`Dados exportados: ${data.user.username}`, 'info');
        } catch (error) {
            Utils.showToast('Erro ao exportar', 'error');
        }
    },

    /**
     * Retorna ícone da fonte de XP
     */
    getSourceIcon(source) {
        const icons = {
            'coffee-made': '☕',
            'coffee-brought': '🎁',
            'rating': '⭐',
            'achievement': '🏆',
            'message': '💬',
            'reaction': '👍',
            'manual': '✏️',
            'system-correction': '🔧'
        };
        return icons[source] || '📦';
    },

    /**
     * Retorna ícone de medalha para posição
     */
    getMedalIcon(index) {
        const medals = ['🥇', '🥈', '🥉'];
        return medals[index] || `${index + 1}º`;
    },

    /**
     * Retorna caminho da foto do usuário baseado no username
     */
    getUserPhotoPath(username) {
        if (!username) return null;
        const photoMap = {
            'renan': 'membros/renan.jpeg',
            'chris': 'membros/chris.jpeg',
            'pedrao': 'membros/pedrao.jpeg',
            'marcus': 'membros/marcus.jpeg',
            'atila': 'membros/Atila.jpeg'
            // Nota: wilmar não tem foto na pasta membros/
        };
        return photoMap[username.toLowerCase()] || null;
    },

    /**
     * Retorna iniciais do nome do usuário
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },

    /**
     * Carrega histórico de auditoria de um usuário específico (versão legada)
     */
    async loadUserAudit(userId) {
        // Redireciona para nova função
        return this.loadUserBreakdown(userId);
    },

    /**
     * Valida integridade de XP do usuário selecionado
     */
    async validateSelectedUser() {
        const select = document.getElementById('auditUserSelect');
        const userId = select?.value || this.auditState.selectedUserId;

        if (!userId) {
            Utils.showToast('Selecione um usuário primeiro', 'warning');
            return;
        }

        try {
            const result = await Api.validateUserXP(userId);

            if (!result) {
                Utils.showToast('Erro ao validar', 'error');
                return;
            }

            if (result.validation.isValid) {
                Utils.showToast(`✅ Saldo correto: ${result.validation.recordedBalance} XP`, 'success');
                this.addLog(`Validação OK para usuário: ${userId}`, 'success');
            } else {
                Utils.showToast(`⚠️ Inconsistência: diferença de ${result.validation.difference} XP`, 'warning');
                this.addLog(`Inconsistência detectada: ${result.validation.difference} XP`, 'warning');
                
                // Perguntar se quer corrigir
                if (confirm(`Deseja corrigir automaticamente a diferença de ${result.validation.difference} XP?`)) {
                    // Implementar correção
                    Utils.showToast('Correção solicitada - verifique os logs', 'info');
                }
            }
        } catch (error) {
            console.error('Erro ao validar:', error);
            Utils.showToast('Erro ao validar integridade', 'error');
        }
    },

    /**
     * Reverte uma transação de XP
     */
    async revertTransaction(transactionId) {
        const reason = prompt('Motivo da reversão:');
        if (!reason) return;

        try {
            const result = await Api.reverseXPTransaction(transactionId, reason);

            if (result?.success) {
                Utils.showToast('Transação revertida!', 'success');
                this.addLog(`Transação ${transactionId} revertida: ${reason}`, 'warning');
                
                // Recarregar timeline
                const select = document.getElementById('auditUserSelect');
                if (select?.value) {
                    this.loadUserAudit(select.value);
                }
            } else {
                Utils.showToast('Erro ao reverter', 'error');
            }
        } catch (error) {
            console.error('Erro ao reverter:', error);
            Utils.showToast('Erro ao reverter transação', 'error');
        }
    },

    /**
     * Formata nome da fonte de XP para exibição
     */
    formatSourceName(source) {
        const names = {
            'coffee-made': '☕ Café Feito',
            'coffee-brought': '🎁 Café Trazido',
            'rating': '⭐ Avaliação',
            'achievement': '🏆 Conquista',
            'message': '💬 Mensagem',
            'reaction': '👍 Reação',
            'manual': '✏️ Manual',
            'system-correction': '🔧 Correção'
        };
        return names[source] || source;
    },

    /**
     * Filtra breakdown por fonte específica
     */
    filterBySource(source) {
        // Destacar visualmente a fonte selecionada
        const rows = document.querySelectorAll('.source-row');
        rows.forEach(row => row.classList.remove('active'));
        
        const selectedRow = document.querySelector(`.source-row[onclick*="${source}"]`);
        if (selectedRow) {
            selectedRow.classList.add('active');
        }

        // Se tiver usuário selecionado, expandir categoria correspondente
        if (this.auditState.selectedUserId) {
            const categories = document.querySelectorAll('.category-item');
            categories.forEach(cat => {
                const header = cat.querySelector('.category-header');
                if (header && header.outerHTML.includes(source)) {
                    cat.classList.add('expanded');
                } else {
                    cat.classList.remove('expanded');
                }
            });
        }

        Utils.showToast(`Filtro: ${this.formatSourceName(source)}`, 'info');
    },

    /**
     * Alterna visualização do ranking (compacto/detalhado)
     */
    toggleRankingView(view) {
        this.auditState.currentView = view;
        
        // Atualizar botões
        const btns = document.querySelectorAll('.ranking-controls .btn-sm');
        btns.forEach(btn => btn.classList.remove('active'));
        
        const activeBtn = document.querySelector(`.ranking-controls .btn-sm[onclick*="${view}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Atualizar classe no container
        const rankingList = document.getElementById('userRankingList');
        if (rankingList) {
            rankingList.classList.remove('view-compact', 'view-detailed');
            rankingList.classList.add(`view-${view}`);
        }
    },
    
    renderDataTable(type) {
        const container = document.getElementById('adminDataTable');
        if (!container) return;
        
        const allItems = this.allData[type] || [];
        
        if (allItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhum registro encontrado</p>
                </div>
            `;
            return;
        }
        
        // Paginação
        const totalItems = allItems.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        const data = allItems.slice(startIndex, endIndex);
        
        let html = `
            <div class="data-header">
                <div class="data-count">
                    <i class="fas fa-database"></i>
                    Mostrando <strong>${startIndex + 1}-${endIndex}</strong> de <strong>${totalItems}</strong> registro(s)
                </div>
                <div class="pagination-controls">
                    <button class="btn-pagination" onclick="window.adminGoToPage(1)" ${this.currentPage === 1 ? 'disabled' : ''} title="Primeira página">
                        <i class="fas fa-angle-double-left"></i>
                    </button>
                    <button class="btn-pagination" onclick="window.adminGoToPage(${this.currentPage - 1})" ${this.currentPage === 1 ? 'disabled' : ''} title="Página anterior">
                        <i class="fas fa-angle-left"></i>
                    </button>
                    <span class="page-info">Página <strong>${this.currentPage}</strong> de <strong>${totalPages}</strong></span>
                    <button class="btn-pagination" onclick="window.adminGoToPage(${this.currentPage + 1})" ${this.currentPage === totalPages ? 'disabled' : ''} title="Próxima página">
                        <i class="fas fa-angle-right"></i>
                    </button>
                    <button class="btn-pagination" onclick="window.adminGoToPage(${totalPages})" ${this.currentPage === totalPages ? 'disabled' : ''} title="Última página">
                        <i class="fas fa-angle-double-right"></i>
                    </button>
                </div>
            </div>
            <div class="admin-table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;"><input type="checkbox" onchange="window.adminToggleAll(this.checked)" title="Selecionar todos desta página"></th>
                            ${this.getTableHeaders(type)}
                            <th class="actions-col">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.forEach(item => {
            const isSelected = this.selectedItems.has(item.id);
            html += `
                <tr data-id="${item.id}" class="${isSelected ? 'selected' : ''}">
                    <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="window.adminToggleItem('${item.id}', this.checked)"></td>
                    ${this.getTableRow(type, item)}
                    <td class="actions-col">
                        <button class="btn-action btn-delete" onclick="window.adminDeleteItem('${type}', '${item.id}')" title="Deletar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            ${totalPages > 1 ? `
            <div class="pagination-footer">
                <span class="items-per-page">
                    <label>Itens por página:</label>
                    <select onchange="window.adminChangePageSize(this.value)">
                        <option value="25" ${this.itemsPerPage === 25 ? 'selected' : ''}>25</option>
                        <option value="50" ${this.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${this.itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    </select>
                </span>
            </div>
            ` : ''}
        `;
        
        container.innerHTML = html;
    },
    
    getTableHeaders(type) {
        const headers = {
            'coffee-made': '<th>Nome</th><th>Data/Hora</th><th>Observação</th>',
            'coffee-brought': '<th>Nome</th><th>Data/Hora</th><th>Observação</th>',
            'coffee-history': '<th>Mensagem</th><th>Nome</th><th>Data/Hora</th><th>Observação</th>',
            'chat-messages': '<th>Autor</th><th>Mensagem</th><th>Data/Hora</th>',
            'ratings': '<th>Café ID</th><th>Barista</th><th>Média</th><th>Avaliadores</th>'
        };
        return headers[type] || '<th>Dados</th>';
    },
    
    getTableRow(type, item) {
        const formatDate = (date) => {
            if (!date) return '-';
            const d = new Date(date);
            return d.toLocaleString('pt-BR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit', 
                minute: '2-digit' 
            });
        };
        
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        };
        
        const truncate = (text, max = 50) => {
            if (!text) return '-';
            return text.length > max ? text.substring(0, max) + '...' : text;
        };
        
        switch(type) {
            case 'coffee-made':
            case 'coffee-brought':
                return `
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td>${formatDate(item.date)}</td>
                    <td>${escapeHtml(item.note) || '-'}</td>
                `;
            
            case 'coffee-history':
                return `
                    <td>${escapeHtml(truncate(item.message))}</td>
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td>${formatDate(item.date)}</td>
                    <td>${escapeHtml(item.note) || '-'}</td>
                `;
            
            case 'chat-messages':
                return `
                    <td><strong>${escapeHtml(item.author)}</strong></td>
                    <td title="${escapeHtml(item.text)}">${escapeHtml(truncate(item.text, 60))}</td>
                    <td>${formatDate(item.timestamp)}</td>
                `;
            
            case 'ratings':
                return `
                    <td><code>${item.coffeeId?.substring(0, 8) || '-'}...</code></td>
                    <td><strong>${escapeHtml(item.makerName)}</strong></td>
                    <td>⭐ ${(item.average || 0).toFixed(1)}</td>
                    <td>${item.raters?.length || 0} pessoa(s)</td>
                `;
            
            default:
                return '<td>-</td>';
        }
    },
    
    toggleItem(id, checked) {
        if (checked) {
            this.selectedItems.add(id);
        } else {
            this.selectedItems.delete(id);
        }
        
        // Atualizar visual da linha
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            row.classList.toggle('selected', checked);
        }
    },
    
    toggleAll(checked) {
        const data = this.allData[this.currentTab] || [];
        this.selectedItems.clear();
        
        if (checked) {
            data.forEach(item => this.selectedItems.add(item.id));
        }
        
        // Atualizar checkboxes
        document.querySelectorAll('.admin-table tbody input[type="checkbox"]').forEach(cb => {
            cb.checked = checked;
        });
        
        // Atualizar visual das linhas
        document.querySelectorAll('.admin-table tbody tr').forEach(row => {
            row.classList.toggle('selected', checked);
        });
    },
    
    async deleteItem(type, id) {
        if (!confirm('Tem certeza que deseja deletar este registro?')) {
            return;
        }
        
        try {
            // Mapear tipo para endpoint correto
            const endpointMap = {
                'coffee-made': 'coffee-made',
                'coffee-brought': 'coffee-brought',
                'coffee-history': 'coffee-history',
                'chat-messages': 'chat-messages',
                'ratings': 'ratings'
            };
            
            const endpoint = endpointMap[type];
            
            const response = await fetch(`/api/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: Api.getAuthHeaders()
            });
            
            if (response.ok) {
                // Animar remoção
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    row.classList.add('deleting');
                    await new Promise(r => setTimeout(r, 300));
                }
                
                Utils.showToast('Registro deletado!', 'success');
                this.addLog(`Registro deletado: ${type}/${id.substring(0, 8)}...`, 'warning');
                
                // Recarregar dados
                await this.loadData();
                await State.init();
            } else {
                const error = await response.json().catch(() => ({}));
                Utils.showToast(error.error || 'Erro ao deletar registro', 'error');
                this.addLog(`Erro ao deletar: ${error.error || 'desconhecido'}`, 'error');
            }
        } catch (error) {
            console.error('Erro ao deletar:', error);
            Utils.showToast('Erro ao deletar registro', 'error');
            this.addLog(`Erro ao deletar: ${error.message}`, 'error');
        }
    },
    
    async deleteSelected() {
        if (this.selectedItems.size === 0) {
            Utils.showToast('Nenhum item selecionado', 'warning');
            return;
        }
        
        const count = this.selectedItems.size;
        if (!confirm(`⚠️ Deletar ${count} registro(s) selecionados?`)) {
            return;
        }
        
        // Mapear tipo para endpoint correto
        const endpointMap = {
            'coffee-made': 'coffee-made',
            'coffee-brought': 'coffee-brought',
            'coffee-history': 'coffee-history',
            'chat-messages': 'chat-messages',
            'ratings': 'ratings'
        };
        
        const endpoint = endpointMap[this.currentTab] || this.currentTab;
        
        let deleted = 0;
        let errors = 0;
        
        for (const id of this.selectedItems) {
            try {
                const response = await fetch(`/api/${endpoint}/${id}`, {
                    method: 'DELETE',
                    headers: Api.getAuthHeaders()
                });
                
                if (response.ok) {
                    deleted++;
                } else {
                    errors++;
                }
            } catch {
                errors++;
            }
        }
        
        this.selectedItems.clear();
        
        if (deleted > 0) {
            Utils.showToast(`${deleted} registro(s) deletado(s)!`, 'success');
            this.addLog(`${deleted} registros deletados em massa`, 'warning');
        }
        
        if (errors > 0) {
            Utils.showToast(`${errors} erro(s) ao deletar`, 'error');
        }
        
        await this.loadData();
        await State.init();
    },
    
    async clearAllRecords(type) {
        const typeNames = {
            'coffee-made': 'cafés feitos',
            'coffee-brought': 'cafés trazidos',
            'coffee-history': 'histórico de café',
            'chat-messages': 'mensagens do chat',
            'ratings': 'avaliações'
        };
        
        const typeName = typeNames[type] || 'registros';
        
        if (!confirm(`⚠️ ATENÇÃO!\n\nIsso vai deletar TODOS os ${typeName}!\n\nTem certeza?`)) {
            return;
        }
        
        if (!confirm('Confirmação final: Deseja realmente apagar tudo?')) {
            return;
        }
        
        try {
            // Enviar array vazio para limpar
            const response = await fetch(`/api/${type}`, {
                method: 'PUT',
                headers: Api.getAuthHeaders(),
                body: JSON.stringify([])
            });
            
            if (response.ok) {
                Utils.showToast(`Todos os ${typeName} foram deletados!`, 'success');
                this.addLog(`LIMPEZA TOTAL: ${typeName}`, 'error');
                this.loadData();
                
                // Recarregar dados no State
                await State.init();
            } else {
                Utils.showToast('Erro ao limpar registros', 'error');
            }
        } catch (error) {
            console.error('Erro ao limpar registros:', error);
            Utils.showToast('Erro ao limpar registros', 'error');
            this.addLog(`Erro ao limpar: ${error.message}`, 'error');
        }
    },
    
    search(query) {
        const data = this.allData[this.currentTab] || [];
        const lowerQuery = query.toLowerCase();
        
        document.querySelectorAll('.admin-table tbody tr').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(lowerQuery) ? '' : 'none';
        });
    },
    
    selectAll() {
        this.toggleAll(true);
    },
    
    deselectAll() {
        this.toggleAll(false);
    },
    
    async exportData() {
        try {
            const exportData = {
                exportDate: new Date().toISOString(),
                data: this.allData
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `cerebro-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            Utils.showToast('Dados exportados com sucesso!', 'success');
            this.addLog('Backup de dados exportado', 'info');
        } catch (error) {
            Utils.showToast('Erro ao exportar dados', 'error');
            this.addLog(`Erro ao exportar: ${error.message}`, 'error');
        }
    },
    
    clearCache() {
        if (!confirm('Limpar cache local? Isso pode melhorar o desempenho.')) return;
        
        try {
            // Limpar apenas dados de cache, não dados de autenticação
            const keysToKeep = ['cerebroToken', 'cerebroUser', 'cerebroIsAdmin'];
            const keysToRemove = [];
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!keysToKeep.includes(key)) {
                    keysToRemove.push(key);
                }
            }
            
            keysToRemove.forEach(key => localStorage.removeItem(key));
            
            Utils.showToast('Cache limpo!', 'success');
            this.addLog('Cache local limpo', 'info');
        } catch (error) {
            Utils.showToast('Erro ao limpar cache', 'error');
        }
    },
    
    async refreshAll() {
        Utils.showToast('Recarregando dados...', 'info');
        this.addLog('Recarregando todos os dados...', 'info');
        await this.loadData();
        await State.init();
        Utils.showToast('Dados atualizados!', 'success');
    },
    
    goToPage(page) {
        const allItems = this.allData[this.currentTab] || [];
        const totalPages = Math.ceil(allItems.length / this.itemsPerPage);
        
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        
        this.currentPage = page;
        this.renderDataTable(this.currentTab);
        
        // Scroll para o topo da tabela
        document.getElementById('adminDataTable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    
    changePageSize(size) {
        this.itemsPerPage = parseInt(size) || 50;
        this.currentPage = 1; // Reset para primeira página
        this.renderDataTable(this.currentTab);
        this.addLog(`Itens por página alterado para ${this.itemsPerPage}`, 'info');
    },
    
    // ===== XP Configuration =====
    xpConfig: null,
    xpConfigOriginal: null,
    
    async initXPConfig() {
        try {
            // Importar definições de XP padrão
            const { XP_ACTIONS } = await import('./levels/definitions.js');
            
            // Tentar carregar config do servidor
            let savedConfig = null;
            try {
                savedConfig = await Api.getXPConfig();
            } catch (error) {
                console.warn('Não foi possível carregar config XP do servidor, usando padrão');
            }
            
            // Fallback para localStorage se servidor não disponível
            if (!savedConfig) {
                const localConfig = localStorage.getItem('cerebro-xp-config');
                savedConfig = localConfig ? JSON.parse(localConfig) : null;
            }
            
            this.xpConfigOriginal = { ...XP_ACTIONS };
            this.xpConfig = savedConfig ? { ...XP_ACTIONS, ...savedConfig } : { ...XP_ACTIONS };
            
            // Mesclar com padrão para garantir novas ações
            for (const key of Object.keys(XP_ACTIONS)) {
                if (!this.xpConfig[key]) {
                    this.xpConfig[key] = { ...XP_ACTIONS[key] };
                }
            }
            
            this.renderXPConfig();
        } catch (error) {
            console.error('Erro ao carregar config XP:', error);
        }
    },
    
    renderXPConfig() {
        if (!this.xpConfig) return;
        
        // Categorizar ações - BEM ORGANIZADAS
        const categories = {
            // Ações básicas de café
            coffee: ['coffee-made', 'coffee-brought'],
            // Itens especiais que podem ser trazidos
            items: ['filtro-cafe', 'bolo', 'bolo-supreme', 'bolacha', 'bolacha-recheada', 'biscoito', 'sonho'],
            // Ações de chat
            chat: ['message-sent', 'reaction-given', 'reaction-received'],
            // Avaliações
            ratings: ['rating-given', 'five-star-received'],
            // XP por desbloquear conquistas
            achievements: ['achievement-common', 'achievement-rare', 'achievement-epic', 'achievement-legendary', 'achievement-platinum'],
            // Bônus especiais de horário/data
            special: ['early-coffee', 'late-coffee', 'weekend-coffee', 'streak-bonus', 'daily-login']
        };
        
        const containerIds = {
            coffee: 'xpConfigCoffee',
            items: 'xpConfigItems',
            chat: 'xpConfigChat',
            ratings: 'xpConfigRatings',
            achievements: 'xpConfigAchievements',
            special: 'xpConfigSpecial'
        };
        
        for (const [category, actions] of Object.entries(categories)) {
            const container = document.getElementById(containerIds[category]);
            if (!container) continue;
            
            container.innerHTML = actions.map(actionKey => {
                const action = this.xpConfig[actionKey];
                if (!action) return '';
                
                const isChanged = this.xpConfigOriginal[actionKey]?.xp !== action.xp;
                
                return `
                    <div class="xp-config-item ${isChanged ? 'changed' : ''}" data-action="${actionKey}">
                        <div class="xp-config-item-info">
                            <span class="xp-config-icon">${action.icon}</span>
                            <div class="xp-config-details">
                                <span class="xp-config-name">${action.name}</span>
                                <span class="xp-config-desc">${action.description}</span>
                            </div>
                        </div>
                        <div class="xp-config-input-wrapper">
                            <div class="xp-config-controls">
                                <button class="xp-control-btn increment" onclick="window.adminAdjustXP('${actionKey}', 5)" title="+5 XP">
                                    <i class="fas fa-caret-up"></i>
                                </button>
                                <button class="xp-control-btn decrement" onclick="window.adminAdjustXP('${actionKey}', -5)" title="-5 XP">
                                    <i class="fas fa-caret-down"></i>
                                </button>
                            </div>
                            <input type="number" 
                                   class="xp-config-input" 
                                   value="${action.xp}" 
                                   min="0" 
                                   max="1000"
                                   data-action="${actionKey}"
                                   data-original="${this.xpConfigOriginal[actionKey]?.xp || action.xp}"
                                   onchange="window.adminUpdateXP('${actionKey}', this.value)">
                            <span class="xp-config-label">XP</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },
    
    adjustXP(actionKey, delta) {
        if (!this.xpConfig[actionKey]) return;
        
        const input = document.querySelector(`.xp-config-input[data-action="${actionKey}"]`);
        if (!input) return;
        
        let newValue = Math.max(0, Math.min(1000, parseInt(input.value) + delta));
        input.value = newValue;
        this.updateXP(actionKey, newValue);
    },
    
    updateXP(actionKey, value) {
        if (!this.xpConfig[actionKey]) return;
        
        const numValue = parseInt(value) || 0;
        this.xpConfig[actionKey].xp = numValue;
        
        // Atualizar visual
        const item = document.querySelector(`.xp-config-item[data-action="${actionKey}"]`);
        if (item) {
            const original = this.xpConfigOriginal[actionKey]?.xp;
            if (numValue !== original) {
                item.classList.add('changed');
            } else {
                item.classList.remove('changed');
            }
        }
    },
    
    async saveXPConfig() {
        if (!this.xpConfig) return;
        
        try {
            // Salvar no servidor (persistente)
            const result = await Api.saveXPConfig(this.xpConfig);
            
            if (!result) {
                throw new Error('Falha ao salvar no servidor');
            }
            
            // Backup no localStorage (para offline/fallback)
            localStorage.setItem('cerebro-xp-config', JSON.stringify(this.xpConfig));
            
            Utils.showToast('✅ Configurações de XP salvas no servidor!', 'success');
            this.addLog('Configurações de XP atualizadas e persistidas', 'info');
            
            // Re-renderizar para remover indicadores de mudança
            this.xpConfigOriginal = JSON.parse(JSON.stringify(this.xpConfig));
            this.renderXPConfig();
            
            // Notificar para recalcular níveis se desejar
            if (confirm('Deseja recalcular os níveis de todos os usuários com as novas configurações?')) {
                window.recalcularNiveis();
            }
        } catch (error) {
            console.error('Erro ao salvar XP config:', error);
            Utils.showToast('❌ Erro ao salvar configurações no servidor', 'error');
            this.addLog(`Erro ao salvar XP config: ${error.message}`, 'error');
        }
    },
    
    async resetXPConfig() {
        if (!confirm('Restaurar valores padrão de XP?\n\nIsso irá reverter todas as alterações e salvar no servidor.')) {
            return;
        }
        
        try {
            // Reimportar valores padrão
            const { XP_ACTIONS } = await import('./levels/definitions.js');
            this.xpConfig = { ...XP_ACTIONS };
            this.xpConfigOriginal = { ...XP_ACTIONS };
            
            // Salvar valores padrão no servidor
            await Api.saveXPConfig(this.xpConfig);
            
            // Remover do localStorage
            localStorage.removeItem('cerebro-xp-config');
            
            this.renderXPConfig();
            
            Utils.showToast('Configurações restauradas e salvas!', 'success');
            this.addLog('Configurações de XP restauradas ao padrão', 'info');
        } catch (error) {
            console.error('Erro ao restaurar XP config:', error);
            Utils.showToast('Erro ao restaurar', 'error');
        }
    },
    
    getCustomXPConfig() {
        return this.xpConfig;
    },
    
    // ===== User XP Management =====
    selectedUser: null,
    
    async loadUserList() {
        try {
            const userSelect = document.getElementById('xpUserSelect');
            if (!userSelect) return;
            
            // Buscar usuários do servidor
            const users = await Api.getUsers();
            
            // Fallback: se API falhar, tentar de outras fontes
            let allUsers = new Set();
            
            if (users && users.length > 0) {
                // Usar usuários do banco
                users.forEach(u => allUsers.add(u.username || u.name));
            } else {
                // Fallback para dados locais
                const { Levels } = await import('./levels/index.js');
                const levelUsers = Object.keys(Levels.allLevelData || {});
                levelUsers.forEach(u => allUsers.add(u));
                
                // Também pegar usuários do State
                const coffeeData = State.getCoffeeData();
                coffeeData.made?.forEach(c => allUsers.add(c.name));
                coffeeData.brought?.forEach(c => allUsers.add(c.name));
            }
            
            userSelect.innerHTML = '<option value="">-- Selecione um usuário --</option>';
            
            Array.from(allUsers).sort().forEach(user => {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                userSelect.appendChild(option);
            });
            
            // Evento de seleção
            userSelect.addEventListener('change', (e) => this.selectUser(e.target.value));
        } catch (error) {
            console.error('Erro ao carregar lista de usuários:', error);
        }
    },
    
    async selectUser(userName) {
        this.selectedUser = userName;
        
        const container = document.getElementById('xpUserCurrent');
        if (!container) return;
        
        if (!userName) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Selecione um usuário para ver detalhes</p>';
            return;
        }
        
        try {
            const { Levels } = await import('./levels/index.js');
            
            // Garantir que Levels está inicializado
            if (!Levels.initialized) {
                await Levels.init();
            }
            
            const stats = Levels.getUserLevel(userName);
            
            // Valores padrão para evitar erros de undefined
            const level = stats?.level || 1;
            const totalXP = stats?.totalXP || 0;
            const rankIcon = stats?.rank?.icon || '👤';
            const rankName = stats?.rank?.name || 'Iniciante';
            
            container.innerHTML = `
                <div class="xp-user-current-info">
                    <div class="xp-user-avatar">${rankIcon}</div>
                    <div class="xp-user-details">
                        <div class="xp-user-name">${userName}</div>
                        <div class="xp-user-stats">
                            <span class="xp-user-stat">Nível: <strong>${level}</strong></span>
                            <span class="xp-user-stat">XP Total: <strong>${totalXP.toLocaleString()}</strong></span>
                            <span class="xp-user-stat">Rank: <strong>${rankName}</strong></span>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
            container.innerHTML = `<p style="color: #ef4444;">Erro ao carregar dados do usuário: ${error.message || 'Desconhecido'}</p>`;
        }
    },
    
    manualXPAmount: 50,
    
    async manualXP(delta) {
        // Os botões rápidos aplicam diretamente
        if (!this.selectedUser) {
            Utils.showToast('Selecione um usuário primeiro!', 'warning');
            return;
        }
        
        const xpAmount = delta;
        
        if (xpAmount === 0) return;
        
        try {
            // Usar API do servidor para persistência real
            const result = await Api.addUserXP(this.selectedUser, xpAmount, 'Ajuste rápido admin');
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Falha ao aplicar XP no servidor');
            }
            
            // API retorna newBalance e level (não newTotalXP e newLevel)
            const newTotalXP = result.newBalance || result.newTotalXP || 0;
            const newLevel = result.level || result.newLevel || 1;
            
            // Atualizar dados locais também
            const { Levels } = await import('./levels/index.js');
            
            if (!Levels.initialized) {
                await Levels.init();
            }
            
            if (!Levels.allLevelData[this.selectedUser]) {
                const { LevelStorage } = await import('./levels/storage.js');
                Levels.allLevelData[this.selectedUser] = LevelStorage.createDefaultUserData();
            }
            
            const userData = Levels.allLevelData[this.selectedUser];
            userData.totalXP = newTotalXP;
            userData.level = newLevel;
            
            // Recalcular XP no nível atual
            const { LevelCalculator } = await import('./levels/calculator.js');
            userData.xp = LevelCalculator.calculateCurrentLevelXP(newTotalXP, newLevel);
            
            // Salvar localmente também
            await Levels.save();
            
            // Atualizar display
            Levels.updateDisplay();
            
            // Recarregar info do usuário
            this.selectUser(this.selectedUser);
            
            Utils.showToast(`${xpAmount > 0 ? '+' : ''}${xpAmount} XP para ${this.selectedUser}!`, 'success');
            this.addLog(`XP rápido: ${xpAmount > 0 ? '+' : ''}${xpAmount} para ${this.selectedUser}`, 'info');
            
        } catch (error) {
            console.error('Erro ao aplicar XP:', error);
            Utils.showToast(`Erro ao aplicar XP: ${error.message || 'Desconhecido'}`, 'error');
        }
    },
    
    async applyManualXP() {
        if (!this.selectedUser) {
            Utils.showToast('Selecione um usuário primeiro!', 'warning');
            return;
        }
        
        const input = document.getElementById('xpManualAmount');
        const xpAmount = parseInt(input?.value) || 50;
        
        if (xpAmount === 0) {
            Utils.showToast('Informe um valor de XP válido', 'warning');
            return;
        }
        
        const action = xpAmount > 0 ? 'adicionar' : 'remover';
        const absXP = Math.abs(xpAmount);
        
        if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${absXP} XP ${xpAmount > 0 ? 'para' : 'de'} ${this.selectedUser}?`)) {
            return;
        }
        
        try {
            // Usar API do servidor para persistência real
            const result = await Api.addUserXP(this.selectedUser, xpAmount, 'Ajuste manual admin');
            
            if (!result || !result.success) {
                throw new Error(result?.error || 'Falha ao aplicar XP no servidor');
            }
            
            // API retorna newBalance e level (não newTotalXP e newLevel)
            const newTotalXP = result.newBalance || result.newTotalXP || 0;
            const newLevel = result.level || result.newLevel || 1;
            
            // Atualizar dados locais também
            const { Levels } = await import('./levels/index.js');
            
            if (!Levels.initialized) {
                await Levels.init();
            }
            
            if (!Levels.allLevelData[this.selectedUser]) {
                const { LevelStorage } = await import('./levels/storage.js');
                Levels.allLevelData[this.selectedUser] = LevelStorage.createDefaultUserData();
            }
            
            const userData = Levels.allLevelData[this.selectedUser];
            userData.totalXP = newTotalXP;
            userData.level = newLevel;
            
            // Recalcular XP no nível atual
            const { LevelCalculator } = await import('./levels/calculator.js');
            userData.xp = LevelCalculator.calculateCurrentLevelXP(newTotalXP, newLevel);
            
            // Salvar localmente também
            await Levels.save();
            
            // Atualizar display
            Levels.updateDisplay();
            
            // Recarregar info do usuário
            this.selectUser(this.selectedUser);
            
            Utils.showToast(`${xpAmount > 0 ? '+' : ''}${xpAmount} XP ${action === 'adicionar' ? 'adicionado' : 'removido'} de ${this.selectedUser}!`, 'success');
            this.addLog(`XP manual: ${xpAmount > 0 ? '+' : ''}${xpAmount} para ${this.selectedUser} (servidor)`, 'info');
            
        } catch (error) {
            console.error('Erro ao aplicar XP manual:', error);
            Utils.showToast(`Erro ao aplicar XP: ${error.message || 'Desconhecido'}`, 'error');
        }
    }
};

// Expor funções globalmente para os botões
window.adminDeleteItem = (type, id) => Admin.deleteItem(type, id);
window.adminClearAll = (type) => Admin.clearAllRecords(type);
window.adminChangeTab = (tab) => Admin.changeTab(tab);
window.adminToggleItem = (id, checked) => Admin.toggleItem(id, checked);
window.adminToggleAll = (checked) => Admin.toggleAll(checked);
window.adminSearch = (query) => Admin.search(query);
window.adminSelectAll = () => Admin.selectAll();
window.adminDeselectAll = () => Admin.deselectAll();
window.adminDeleteSelected = () => Admin.deleteSelected();
window.adminExportData = () => Admin.exportData();
window.adminClearCache = () => Admin.clearCache();
window.adminRefreshAll = () => Admin.refreshAll();
window.adminGoToPage = (page) => Admin.goToPage(page);
window.adminChangePageSize = (size) => Admin.changePageSize(size);

// Funções de XP Config
window.adminAdjustXP = (actionKey, delta) => Admin.adjustXP(actionKey, delta);
window.adminUpdateXP = (actionKey, value) => Admin.updateXP(actionKey, value);
window.adminSaveXPConfig = () => Admin.saveXPConfig();
window.adminResetXPConfig = () => Admin.resetXPConfig();

// Funções de gerenciamento de XP por usuário
window.adminManualXP = (delta) => Admin.manualXP(delta);
window.adminApplyManualXP = () => Admin.applyManualXP();

// Funções de Auditoria de XP (VERSÃO AVANÇADA)
window.adminLoadUserAudit = (userId) => Admin.loadUserAudit(userId);
window.adminLoadUserBreakdown = (userId) => Admin.loadUserBreakdown(userId);
window.adminValidateSelectedUser = () => Admin.validateSelectedUser();
window.adminRevertTransaction = (transactionId) => Admin.revertTransaction(transactionId);
window.adminExportUserXP = (userId) => Admin.exportUserXP(userId);
window.adminToggleCategory = (header) => Admin.toggleCategory(header);
window.adminShowAllTransactions = (userId, source) => Admin.showAllTransactions(userId, source);
window.adminShowAllLogsModal = (userId) => Admin.showAllLogsModal(userId);
window.adminApplyModalFilters = (userId) => Admin.applyModalFilters(userId);
window.adminFilterBySource = (source) => Admin.filterBySource(source);
window.adminToggleRankingView = (view) => Admin.toggleRankingView(view);

// 🆕 Função para sincronizar XP de um usuário com os logs de auditoria
window.adminSyncUserXP = async (userId) => {
    if (!userId) return;
    
    if (!confirm('⚠️ Sincronizar XP\n\nIsso irá corrigir o XP total do usuário para corresponder aos logs de auditoria.\n\nContinuar?')) {
        return;
    }
    
    try {
        Utils.showToast('Sincronizando XP...', 'info');
        
        const response = await fetch(`/api/v2/admin/xp-audit/correct/${userId}`, {
            method: 'POST',
            headers: {
                ...Api.getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: 'Sincronização manual via admin' })
        });
        
        if (!response.ok) {
            throw new Error('Falha ao sincronizar XP');
        }
        
        const result = await response.json();
        
        Utils.showToast('✅ XP sincronizado com sucesso!', 'success');
        
        // Recarregar breakdown
        Admin.loadUserBreakdown(userId);
        
    } catch (error) {
        console.error('Erro ao sincronizar XP:', error);
        Utils.showToast('❌ Erro ao sincronizar XP: ' + error.message, 'error');
    }
};

// 🆕 Função para trocar de conta (login como outro usuário)
window.adminSwitchToUser = async (username) => {
    if (!username) {
        // Mostrar modal de seleção de usuário
        const users = await Api.getUsers();
        if (!users || users.length === 0) {
            Utils.showToast('Nenhum usuário encontrado', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'admin-switch-user-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-friends"></i> Trocar de Conta</h3>
                    <button class="modal-close" onclick="this.closest('.admin-switch-user-modal').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 1rem; color: var(--text-secondary);">Selecione um usuário para fazer login como ele:</p>
                    <div class="user-switch-list">
                        ${users.map(u => `
                            <div class="user-switch-item" onclick="window.adminSwitchToUser('${u.username}')">
                                <div class="user-avatar-sm">
                                    <span class="avatar-initials">${Admin.getInitials(u.name || u.username)}</span>
                                </div>
                                <div class="user-info">
                                    <span class="user-name">${u.name || u.username}</span>
                                    <span class="user-username">@${u.username}</span>
                                </div>
                                <i class="fas fa-arrow-right"></i>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return;
    }
    
    // Fechar modal se existir
    document.querySelector('.admin-switch-user-modal')?.remove();
    
    if (!confirm(`🔄 Trocar para conta @${username}?\n\nVocê será redirecionado para a página principal como este usuário.`)) {
        return;
    }
    
    try {
        Utils.showToast('Trocando de conta...', 'info');
        
        const response = await fetch('/api/v2/admin/switch-user', {
            method: 'POST',
            headers: {
                ...Api.getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        if (!response.ok) {
            throw new Error('Falha ao trocar de usuário');
        }
        
        const result = await response.json();
        
        // Salvar novo token - USAR AS MESMAS CHAVES DO AUTH MODULE
        if (result.token) {
            // Limpar sessão anterior
            localStorage.removeItem('cerebroToken');
            localStorage.removeItem('cerebroSession');
            localStorage.removeItem('cerebroUser');
            
            // Salvar nova sessão com as chaves corretas
            localStorage.setItem('cerebroToken', result.token);
            localStorage.setItem('cerebroSession', JSON.stringify({
                username: result.user.username,
                name: result.user.name,
                role: result.user.role,
                photo: result.user.photo,
                loginTime: new Date().toISOString()
            }));
            localStorage.setItem('cerebroUser', result.user.name);
            
            Utils.showToast(`✅ Logado como ${result.user.name}!`, 'success');
            
            // Redirecionar para home
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
        
    } catch (error) {
        console.error('Erro ao trocar de conta:', error);
        Utils.showToast('❌ Erro ao trocar de conta: ' + error.message, 'error');
    }
};

// Função para recalcular conquistas
window.recalcularConquistas = async () => {
    if (!confirm('🔄 Recalcular Conquistas\n\nIsso vai processar todo o histórico e atribuir conquistas retroativamente.\n\nDeseja também recalcular os níveis/XP para incluir o XP das conquistas?')) {
        return;
    }
    
    try {
        const btn = event.target.closest('button');
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recalculando no servidor...';
        
        // 🆕 CORREÇÃO: Usar API do servidor para recalcular conquistas
        // Isso garante que os dados sejam persistidos corretamente
        const response = await fetch('/api/v2/achievements/recalculate-all', {
            method: 'POST',
            headers: Api.getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Falha ao recalcular conquistas no servidor');
        }
        
        const serverResult = await response.json();
        
        // Também recalcular níveis para incluir XP das conquistas
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando níveis...';
        
        // Usar API do servidor para recalcular níveis
        const levelsResponse = await fetch('/api/v2/settings/xp/recalculate', {
            method: 'POST',
            headers: Api.getAuthHeaders()
        });
        
        const levelsResult = levelsResponse.ok ? await levelsResponse.json() : { stats: { success: 0 } };
        
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        
        // 🆕 Invalidar cache de stats para que o progresso seja atualizado
        const { Achievements } = await import('./achievements/index.js');
        Achievements.invalidateStatsCache();
        
        // Mostrar resultado
        alert(`✅ Recalculo Completo!\n\n` +
              `👥 Usuários processados: ${serverResult.results?.length || 0}\n` +
              `🏆 Novas conquistas: ${serverResult.totalNewAchievements || 0}\n` +
              `📊 Níveis recalculados: ${levelsResult.stats?.success || 0}\n` +
              `⏰ ${new Date().toLocaleString('pt-BR')}`);
        
        Utils.showToast('✅ Conquistas e níveis recalculados com sucesso!', 'success');
        
        // Sincronizar dados do servidor com o frontend
        const { Levels } = await import('./levels/index.js');
        await Levels.syncWithServer();
        Levels.updateDisplay();
        
        // Recarregar conquistas do servidor
        await Achievements.loadXPConfigFromServer();
        await Achievements.updateDisplay();
        
    } catch (error) {
        console.error('Erro ao recalcular conquistas:', error);
        alert('❌ Erro ao recalcular conquistas:\n' + error.message);
    }
};

// Função para recalcular níveis
window.recalcularNiveis = async (showConfirm = true) => {
    if (showConfirm && !confirm('📊 Recalcular Níveis\n\nIsso vai processar todo o histórico e recalcular XP/níveis retroativamente para todos os usuários.\n\nContinuar?')) {
        return;
    }
    
    try {
        // Tentar pegar o botão se existir, mas não falhar se não existir
        let btn = null;
        let originalHTML = '';
        try {
            if (typeof event !== 'undefined' && event?.target) {
                btn = event.target.closest('button');
                if (btn) {
                    originalHTML = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recalculando no servidor...';
                }
            }
        } catch (e) {
            // Ignorar erro se não houver evento
        }
        
        // Usar API do servidor (mais confiável e persistente)
        const response = await fetch('/api/v2/settings/xp/recalculate', {
            method: 'POST',
            headers: Api.getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Falha ao recalcular no servidor');
        }
        
        const result = await response.json();
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
        
        // Mostrar resultado
        alert(`✅ Recalculo de Níveis Concluído!\n\n` +
              `👥 Total de usuários: ${result.stats.total}\n` +
              `✔️ Sucesso: ${result.stats.success}\n` +
              `❌ Erros: ${result.stats.errors}\n` +
              `⏰ ${new Date().toLocaleString('pt-BR')}`);
        
        Utils.showToast(`✅ Níveis recalculados: ${result.stats.success}/${result.stats.total} usuários!`, 'success');
        
        
        // Recarregar dados localmente também
        const { Levels } = await import('./levels/index.js');
        await Levels.syncWithServer();
        Levels.updateDisplay();
        
    } catch (error) {
        console.error('Erro ao recalcular níveis:', error);
        alert('❌ Erro ao recalcular níveis:\n' + error.message);
    }
};

/**
 * Limpar duplicações de níveis (admin only)
 */
window.adminCleanupDuplicates = async function() {
    try {
        console.log('🧹 Iniciando limpeza de duplicações...');
        
        const headers = Api.getAuthHeaders();
        headers['Content-Type'] = 'application/json';
        
        const response = await fetch('/api/v2/admin/cleanup-duplicates', {
            method: 'POST',
            headers: headers
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ Limpeza concluída!', result.stats);
            alert(`✅ Limpeza de Duplicações Concluída!\n\nTotal de usuários: ${result.stats.totalUsers}\nCom duplicações: ${result.stats.usersWithDuplicates}\nRegistros deletados: ${result.stats.recordsDeleted}`);
        } else {
            throw new Error(result.error || 'Erro ao limpar duplicações');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro: ' + error.message);
    }
};

/**
 * Verificar duplicações (admin only)
 */
window.adminCheckDuplicates = async function() {
    try {
        console.log('🔍 Verificando duplicações...');
        
        const headers = Api.getAuthHeaders();
        
        const response = await fetch('/api/v2/admin/check-duplicates', {
            headers: headers
        });
        
        const result = await response.json();
        
        if (result.details && result.details.length > 0) {
            console.log(`⚠️  Encontrados ${result.usersWithDuplicates} usuários com duplicações:`);
            for (const user of result.details) {
                console.log(`  ${user.username}: ${user.count} registros`);
                user.records.forEach((r, i) => {
                    console.log(`    ${i + 1}. Nível ${r.level} | XP: ${r.totalXP} | Atualizado: ${r.updatedAt}`);
                });
            }
        } else {
            console.log('✅ Nenhuma duplicação encontrada!');
        }
        
        return result;
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro: ' + error.message);
    }
};

// ===== FUNÇÕES PARA UI DO ADMIN =====

/**
 * Toggle para seções colapsáveis do admin
 */
window.toggleAdminSection = function(headerElement) {
    const section = headerElement.closest('.admin-xp-config, .admin-data-section, .admin-logs');
    if (section) {
        section.classList.toggle('collapsed');
        
        // Salvar estado no localStorage
        const sectionId = section.id;
        if (sectionId) {
            const collapsedSections = JSON.parse(localStorage.getItem('adminCollapsedSections') || '{}');
            collapsedSections[sectionId] = section.classList.contains('collapsed');
            localStorage.setItem('adminCollapsedSections', JSON.stringify(collapsedSections));
        }
    }
};

/**
 * Restaurar estado das seções colapsadas
 */
window.restoreAdminSectionStates = function() {
    try {
        const collapsedSections = JSON.parse(localStorage.getItem('adminCollapsedSections') || '{}');
        Object.entries(collapsedSections).forEach(([sectionId, isCollapsed]) => {
            const section = document.getElementById(sectionId);
            if (section && isCollapsed) {
                section.classList.add('collapsed');
            }
        });
    } catch (e) {
        console.warn('Erro ao restaurar estados das seções:', e);
    }
};

/**
 * Switch entre tabs de configuração de XP
 */
window.switchXPConfigTab = function(category) {
    // Remover active de todas as tabs
    document.querySelectorAll('.xp-config-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Adicionar active na tab clicada
    const activeTab = document.querySelector(`.xp-config-tab[data-category="${category}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Esconder todas as categorias
    document.querySelectorAll('.xp-config-categories').forEach(cat => {
        cat.classList.remove('active');
    });
    
    // Mostrar a categoria selecionada
    const activeCategory = document.getElementById(`xpCategory-${category}`);
    if (activeCategory) {
        activeCategory.classList.add('active');
    }
    
    // Salvar tab ativa
    localStorage.setItem('adminXPConfigActiveTab', category);
};

/**
 * Restaurar tab ativa de XP Config
 */
window.restoreXPConfigTab = function() {
    const savedTab = localStorage.getItem('adminXPConfigActiveTab');
    if (savedTab) {
        window.switchXPConfigTab(savedTab);
    }
};

/**
 * Toggle para logs do admin
 */
window.toggleAdminLogs = function(headerElement) {
    const logsSection = headerElement.closest('.admin-logs');
    if (logsSection) {
        logsSection.classList.toggle('collapsed');
        
        // Salvar estado
        const isCollapsed = logsSection.classList.contains('collapsed');
        localStorage.setItem('adminLogsCollapsed', isCollapsed);
    }
};

/**
 * Restaurar estado dos logs
 */
window.restoreAdminLogsState = function() {
    const isCollapsed = localStorage.getItem('adminLogsCollapsed') === 'true';
    if (isCollapsed) {
        const logsSection = document.getElementById('adminLogs');
        if (logsSection) {
            logsSection.classList.add('collapsed');
        }
    }
};

// ============================================
// 🆕 COMUNICADOS E SUGESTÕES - ADMIN
// ============================================

/**
 * Alternar entre tabs de comunicados e sugestões
 */
window.switchCommsTab = function(tab) {
    // Atualizar tabs
    document.querySelectorAll('.comms-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.comms-tab[data-tab="${tab}"]`)?.classList.add('active');
    
    // Atualizar painéis
    document.querySelectorAll('.comms-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`${tab}Panel`)?.classList.add('active');
    
    // Carregar dados
    if (tab === 'announcements') {
        window.refreshAnnouncements();
    } else if (tab === 'suggestions') {
        window.refreshSuggestions();
    }
};

/**
 * Carregar e exibir comunicados (admin)
 */
window.refreshAnnouncements = async function() {
    const container = document.getElementById('adminAnnouncementsList');
    const badge = document.getElementById('announcementsTabBadge');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-placeholder">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Carregando comunicados...</span>
        </div>
    `;
    
    try {
        const result = await Api.getAllAnnouncements();
        
        if (!result || !result.announcements) {
            throw new Error('Erro ao carregar comunicados');
        }
        
        if (badge) badge.textContent = result.total || result.announcements.length;
        
        if (result.announcements.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bullhorn"></i>
                    <p>Nenhum comunicado encontrado</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = result.announcements.map(ann => {
            const date = new Date(ann.createdAt).toLocaleDateString('pt-BR');
            const expires = ann.expiresAt ? new Date(ann.expiresAt).toLocaleDateString('pt-BR') : null;
            
            return `
                <div class="admin-announcement-item ${ann.active ? '' : 'inactive'}">
                    <div class="admin-announcement-header">
                        <div class="admin-announcement-title-row">
                            <span class="admin-announcement-title">${escapeHtml(ann.title)}</span>
                            <span class="priority-badge ${ann.priority.toLowerCase()}">${getPriorityLabel(ann.priority)}</span>
                            <span class="status-badge ${ann.active ? 'active' : 'inactive'}">${ann.active ? 'Ativo' : 'Inativo'}</span>
                        </div>
                        <div class="admin-announcement-actions">
                            <button onclick="window.editAnnouncement('${ann.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="window.toggleAnnouncementActive('${ann.id}', ${!ann.active})" title="${ann.active ? 'Desativar' : 'Ativar'}">
                                <i class="fas fa-${ann.active ? 'eye-slash' : 'eye'}"></i>
                            </button>
                            <button class="delete" onclick="window.deleteAnnouncement('${ann.id}')" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="admin-announcement-content">${escapeHtml(ann.content).substring(0, 200)}${ann.content.length > 200 ? '...' : ''}</div>
                    <div class="admin-announcement-meta">
                        <span><i class="fas fa-user"></i> ${ann.author.name}</span>
                        <span><i class="fas fa-calendar"></i> ${date}</span>
                        ${expires ? `<span><i class="fas fa-clock"></i> Expira: ${expires}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar comunicados:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erro ao carregar comunicados</p>
            </div>
        `;
    }
};

/**
 * Carregar e exibir sugestões (admin)
 */
window.refreshSuggestions = async function() {
    const container = document.getElementById('adminSuggestionsList');
    const statsContainer = document.getElementById('suggestionsStats');
    const badge = document.getElementById('suggestionsTabBadge');
    const filter = document.getElementById('suggestionsFilter')?.value || '';
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="loading-placeholder">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Carregando sugestões...</span>
        </div>
    `;
    
    try {
        const result = await Api.getAllSuggestions(filter || undefined);
        
        if (!result || !result.suggestions) {
            throw new Error('Erro ao carregar sugestões');
        }
        
        // Atualizar badge com contagem de pendentes
        if (badge && result.counts) {
            badge.textContent = result.counts.PENDING || 0;
        }
        
        // Mostrar estatísticas
        if (statsContainer && result.counts) {
            statsContainer.innerHTML = `
                <div class="suggestion-stat-item pending">
                    <span>Pendentes</span>
                    <span class="stat-count">${result.counts.PENDING || 0}</span>
                </div>
                <div class="suggestion-stat-item reviewing">
                    <span>Em Análise</span>
                    <span class="stat-count">${result.counts.REVIEWING || 0}</span>
                </div>
                <div class="suggestion-stat-item approved">
                    <span>Aprovadas</span>
                    <span class="stat-count">${result.counts.APPROVED || 0}</span>
                </div>
                <div class="suggestion-stat-item rejected">
                    <span>Rejeitadas</span>
                    <span class="stat-count">${result.counts.REJECTED || 0}</span>
                </div>
                <div class="suggestion-stat-item implemented">
                    <span>Implementadas</span>
                    <span class="stat-count">${result.counts.IMPLEMENTED || 0}</span>
                </div>
            `;
        }
        
        if (result.suggestions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-lightbulb"></i>
                    <p>Nenhuma sugestão encontrada</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = result.suggestions.map(sug => {
            const date = new Date(sug.createdAt).toLocaleDateString('pt-BR');
            
            return `
                <div class="admin-suggestion-item" data-id="${sug.id}">
                    <div class="admin-suggestion-header">
                        <div class="admin-suggestion-title-row">
                            <span class="admin-suggestion-title">${escapeHtml(sug.title)}</span>
                            <span class="admin-suggestion-status ${sug.status.toLowerCase()}">${getStatusLabel(sug.status)}</span>
                        </div>
                    </div>
                    <div class="admin-suggestion-content">${escapeHtml(sug.content)}</div>
                    ${sug.adminNotes ? `<div class="admin-suggestion-notes"><i class="fas fa-sticky-note"></i> <em>${escapeHtml(sug.adminNotes)}</em></div>` : ''}
                    <div class="admin-suggestion-footer">
                        <div class="admin-suggestion-meta">
                            <span><i class="fas fa-user"></i> ${sug.author.name} (@${sug.author.username})</span>
                            <span><i class="fas fa-calendar"></i> ${date}</span>
                        </div>
                        <div class="admin-suggestion-actions">
                            <select id="status-${sug.id}" onchange="window.updateSuggestionStatus('${sug.id}')">
                                <option value="PENDING" ${sug.status === 'PENDING' ? 'selected' : ''}>Pendente</option>
                                <option value="REVIEWING" ${sug.status === 'REVIEWING' ? 'selected' : ''}>Em Análise</option>
                                <option value="APPROVED" ${sug.status === 'APPROVED' ? 'selected' : ''}>Aprovada</option>
                                <option value="REJECTED" ${sug.status === 'REJECTED' ? 'selected' : ''}>Rejeitada</option>
                                <option value="IMPLEMENTED" ${sug.status === 'IMPLEMENTED' ? 'selected' : ''}>Implementada</option>
                            </select>
                            <button class="delete" onclick="window.deleteSuggestion('${sug.id}')" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar sugestões:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <p>Erro ao carregar sugestões</p>
            </div>
        `;
    }
};

/**
 * Filtrar sugestões
 */
window.filterSuggestions = function() {
    window.refreshSuggestions();
};

/**
 * Abrir modal para criar comunicado
 */
window.openAnnouncementModal = function(announcementId = null) {
    const modal = document.getElementById('announcementModal');
    const title = document.getElementById('announcementModalTitle');
    const idInput = document.getElementById('announcementId');
    const titleInput = document.getElementById('announcementTitleInput');
    const contentInput = document.getElementById('announcementContentInput');
    const prioritySelect = document.getElementById('announcementPriority');
    const expiresInput = document.getElementById('announcementExpires');
    const activeCheckbox = document.getElementById('announcementActive');
    
    // Reset form
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (prioritySelect) prioritySelect.value = 'NORMAL';
    if (expiresInput) expiresInput.value = '';
    if (activeCheckbox) activeCheckbox.checked = true;
    
    if (title) {
        title.innerHTML = announcementId ? 
            '<i class="fas fa-edit"></i> Editar Comunicado' : 
            '<i class="fas fa-bullhorn"></i> Novo Comunicado';
    }
    
    if (modal) modal.classList.add('active');
};

/**
 * Fechar modal de comunicado
 */
window.closeAnnouncementModal = function() {
    const modal = document.getElementById('announcementModal');
    if (modal) modal.classList.remove('active');
};

/**
 * Editar comunicado existente
 */
window.editAnnouncement = async function(id) {
    try {
        const response = await fetch(`/api/v2/announcements/${id}`, {
            headers: Api.getAuthHeaders()
        });
        const result = await response.json();
        
        if (!result.announcement) {
            Utils.showToast('Comunicado não encontrado', 'error');
            return;
        }
        
        const ann = result.announcement;
        
        window.openAnnouncementModal(id);
        
        document.getElementById('announcementId').value = ann.id;
        document.getElementById('announcementTitleInput').value = ann.title;
        document.getElementById('announcementContentInput').value = ann.content;
        document.getElementById('announcementPriority').value = ann.priority;
        document.getElementById('announcementActive').checked = ann.active;
        
        if (ann.expiresAt) {
            const date = new Date(ann.expiresAt);
            document.getElementById('announcementExpires').value = date.toISOString().split('T')[0];
        }
        
    } catch (error) {
        console.error('Erro ao carregar comunicado:', error);
        Utils.showToast('Erro ao carregar comunicado', 'error');
    }
};

/**
 * Salvar comunicado (criar ou atualizar)
 */
window.saveAnnouncement = async function() {
    const id = document.getElementById('announcementId')?.value;
    const title = document.getElementById('announcementTitleInput')?.value.trim();
    const content = document.getElementById('announcementContentInput')?.value.trim();
    const priority = document.getElementById('announcementPriority')?.value;
    const expiresAt = document.getElementById('announcementExpires')?.value || null;
    const active = document.getElementById('announcementActive')?.checked;
    
    if (!title || !content) {
        Utils.showToast('Preencha o título e o conteúdo', 'warning');
        return;
    }
    
    try {
        let result;
        
        if (id) {
            result = await Api.updateAnnouncement(id, { title, content, priority, expiresAt, active });
        } else {
            result = await Api.createAnnouncement({ title, content, priority, expiresAt });
        }
        
        if (result && result.success) {
            Utils.showToast(id ? '✅ Comunicado atualizado!' : '✅ Comunicado criado!', 'success');
            window.closeAnnouncementModal();
            window.refreshAnnouncements();
        } else {
            throw new Error(result?.error || 'Erro ao salvar comunicado');
        }
    } catch (error) {
        console.error('Erro ao salvar comunicado:', error);
        Utils.showToast('❌ ' + error.message, 'error');
    }
};

/**
 * Ativar/desativar comunicado
 */
window.toggleAnnouncementActive = async function(id, active) {
    try {
        const result = await Api.updateAnnouncement(id, { active });
        
        if (result && result.success) {
            Utils.showToast(active ? '✅ Comunicado ativado!' : '⚠️ Comunicado desativado', 'success');
            window.refreshAnnouncements();
        } else {
            throw new Error('Erro ao atualizar comunicado');
        }
    } catch (error) {
        console.error('Erro ao atualizar comunicado:', error);
        Utils.showToast('❌ Erro ao atualizar comunicado', 'error');
    }
};

/**
 * Deletar comunicado
 */
window.deleteAnnouncement = async function(id) {
    if (!confirm('🗑️ Tem certeza que deseja excluir este comunicado?')) {
        return;
    }
    
    try {
        const result = await Api.deleteAnnouncement(id);
        
        if (result && result.success) {
            Utils.showToast('✅ Comunicado excluído!', 'success');
            window.refreshAnnouncements();
        } else {
            throw new Error('Erro ao excluir comunicado');
        }
    } catch (error) {
        console.error('Erro ao excluir comunicado:', error);
        Utils.showToast('❌ Erro ao excluir comunicado', 'error');
    }
};

/**
 * Atualizar status da sugestão
 */
window.updateSuggestionStatus = async function(id) {
    const select = document.getElementById(`status-${id}`);
    const newStatus = select?.value;
    
    if (!newStatus || !id) {
        console.error('ID ou status inválido');
        return;
    }
    
    const adminNotes = prompt('Adicionar nota (opcional):');
    
    try {
        const result = await Api.updateSuggestionStatus(id, newStatus, adminNotes || undefined);
        
        if (result && result.success) {
            Utils.showToast('✅ Status atualizado!', 'success');
            await window.refreshSuggestions();
        } else {
            throw new Error(result?.error || 'Erro ao atualizar status');
        }
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        Utils.showToast('❌ ' + (error.message || 'Erro ao atualizar status'), 'error');
        await window.refreshSuggestions(); // Reverter
    }
};

/**
 * Deletar sugestão
 */
window.deleteSuggestion = async function(id) {
    if (!id) {
        console.error('ID inválido');
        return;
    }
    
    if (!confirm('🗑️ Tem certeza que deseja excluir esta sugestão?')) {
        return;
    }
    
    try {
        const result = await Api.deleteSuggestion(id);
        
        if (result && result.success) {
            Utils.showToast('✅ Sugestão excluída!', 'success');
            await window.refreshSuggestions();
        } else {
            throw new Error(result?.error || 'Erro ao excluir sugestão');
        }
    } catch (error) {
        console.error('Erro ao excluir sugestão:', error);
        Utils.showToast('❌ ' + (error.message || 'Erro ao excluir sugestão'), 'error');
    }
};

// Helpers
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getPriorityLabel(priority) {
    const labels = { 'LOW': 'Baixa', 'NORMAL': 'Normal', 'HIGH': 'Alta', 'URGENT': 'Urgente' };
    return labels[priority] || priority;
}

function getStatusLabel(status) {
    const labels = {
        'PENDING': 'Pendente',
        'REVIEWING': 'Em Análise',
        'APPROVED': 'Aprovada',
        'REJECTED': 'Rejeitada',
        'IMPLEMENTED': 'Implementada'
    };
    return labels[status] || status;
}

// Inicializar estados ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    window.restoreAdminSectionStates();
    window.restoreXPConfigTab();
    window.restoreAdminLogsState();
});
