/**
 * COFFEE MODULE
 * Manages coffee tracking and rating functionality
 */

import { State } from './state.js';
import { Utils } from './utils.js';
import { Api } from './api.js';

export const Coffee = {
    currentRating: 0,
    selectedCoffeeId: null,
    selectedSpecialItem: null,
    specialItemsConfig: null,
    historyExpanded: false, // 🆕 Estado do histórico expandido
    
    // 🖼️ Mapeamento de imagens para cada item especial
    SPECIAL_ITEMS_IMAGES: {
        'filtro-cafe': 'assets/images/coador.jpeg',
        'bolo': 'assets/images/bolo.jpg',
        'bolo-supreme': 'assets/images/bolo_supreme.jpg',
        'bolacha': 'assets/images/bolacha.jpeg',
        'bolacha-recheada': 'assets/images/bolacha_recheada.png',
        'biscoito': 'assets/images/biscoito.jpg',
        'sonho': 'assets/images/sonho.jpg',
        'cafe': 'assets/images/cafe.jpg',
        'cafe-especial': 'assets/images/cafe_no_jeito.jpg'
    },
    
    // Definições dos itens especiais com ícones e XP padrão
    SPECIAL_ITEMS: {
        'filtro-cafe': { name: 'Filtro de Café', icon: '☕', defaultXp: 30 },
        'bolo': { name: 'Bolo', icon: '🎂', defaultXp: 250 },
        'bolo-supreme': { name: 'Bolo Supreme', icon: '👑🎂', defaultXp: 400 },
        'bolacha': { name: 'Bolacha', icon: '🍪', defaultXp: 25 },
        'bolacha-recheada': { name: 'Bolacha Recheada', icon: '🥮', defaultXp: 35 },
        'biscoito': { name: 'Biscoito', icon: '🥠', defaultXp: 50 },
        'sonho': { name: 'Sonho', icon: '🍩', defaultXp: 75 }
    },
    
    // 🖼️ Retorna a URL da imagem para um item
    getItemImage(itemKey) {
        return this.SPECIAL_ITEMS_IMAGES[itemKey] || null;
    },
    
    // 🖼️ Gera HTML da imagem com fallback para emoji
    getItemImageHtml(itemKey, size = 'medium') {
        const imagePath = this.getItemImage(itemKey);
        const item = this.SPECIAL_ITEMS[itemKey];
        const sizeClass = `item-img-${size}`;
        
        if (imagePath) {
            return `<div class="item-image-wrapper ${sizeClass}">
                <img src="${imagePath}" alt="${item?.name || 'Item'}" class="item-image" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'item-emoji\\'>${item?.icon || '🎁'}</span>'">
            </div>`;
        }
        return `<span class="item-emoji ${sizeClass}">${item?.icon || '🎁'}</span>`;
    },
    
    async init() {
        this.updateStats();
        this.updateHistory();
        this.updateRanking('made');
        this.updateHomeStats();
        this.updateTodayCoffee();
        this.updateTopBaristas();
        this.updateLastSpecialItem();
        
        // Carregar configurações de XP do servidor
        await this.loadSpecialItemsConfig();
    },
    
    // Carrega configurações de XP do servidor (valores definidos pelo admin)
    async loadSpecialItemsConfig() {
        try {
            const xpConfig = await Api.getXPConfig();
            if (xpConfig) {
                this.specialItemsConfig = xpConfig;
                console.log('✅ Configuração de XP carregada do servidor');
            }
        } catch (error) {
            console.warn('⚠️ Usando valores padrão de XP para itens especiais:', error);
        }
    },
    
    // Obtém o XP de um item especial (do servidor ou padrão)
    getSpecialItemXP(itemKey) {
        // Primeiro tenta do servidor
        if (this.specialItemsConfig && this.specialItemsConfig[itemKey]) {
            return this.specialItemsConfig[itemKey].xp || this.specialItemsConfig[itemKey];
        }
        // Senão usa o padrão
        return this.SPECIAL_ITEMS[itemKey]?.defaultXp || 50;
    },
    
    openModal(type) {
        State.setCoffeeType(type);
        const modal = document.getElementById('coffeeModal');
        const title = document.getElementById('modalTitle');
        
        title.textContent = type === 'made' ? '☕ Registrar Café Feito' : '🛒 Registrar Café Trazido';
        
        // Pre-fill name if user is set
        if (State.getUser()) {
            document.getElementById('personName').value = State.getUser();
        }
        
        modal.classList.add('active');
    },
    
    closeModal() {
        document.getElementById('coffeeModal').classList.remove('active');
        document.getElementById('personName').value = '';
        document.getElementById('coffeeNote').value = '';
    },
    
    async register() {
        const name = document.getElementById('personName').value.trim();
        const note = document.getElementById('coffeeNote').value.trim();
        
        if (!name) {
            alert('Por favor, digite seu nome!');
            return;
        }
        
        const now = new Date();
        const record = {
            name: name,
            note: note,
            date: now.toISOString(),
            type: State.getCoffeeType()
        };
        
        // 🔧 CORREÇÃO: Adicionar tratamento de erro para mostrar feedback ao usuário
        try {
            await State.addCoffeeRecord(record);
        } catch (error) {
            console.error('Erro ao registrar café:', error);
            Utils.showToast('❌ Erro ao registrar café. Verifique sua conexão e tente novamente.');
            return;
        }
        
        // ========== SISTEMA DE NÍVEIS - Adicionar XP (INSTANTÂNEO) ==========
        const { Levels } = await import('./levels/index.js');
        const { Achievements } = await import('./achievements/index.js');
        const hour = now.getHours();
        const day = now.getDay();
        
        // 🔧 PADRONIZAÇÃO: Usar awardXP para feedback INSTANTÂNEO
        // Backend já persistiu via State.addCoffeeRecord, aqui só mostra notificação
        const coffeeId = record.date; // Usar timestamp como ID único
        
        if (State.getCoffeeType() === 'made') {
            // XP por fazer café - notificação INSTANTÂNEA
            await Levels.awardXP(name, 'coffee-made', `coffee-made-${coffeeId}`, {
                trackingType: 'coffees',
                persistToBackend: false // Backend já persistiu via State.addCoffeeRecord
            });
            
            // XP bônus por horário especial
            if (hour < 7) {
                await Levels.awardXP(name, 'early-coffee', `early-coffee-${coffeeId}`, {
                    trackingType: 'coffees',
                    persistToBackend: false
                });
            }
            if (hour >= 20) {
                await Levels.awardXP(name, 'late-coffee', `late-coffee-${coffeeId}`, {
                    trackingType: 'coffees',
                    persistToBackend: false
                });
            }
            if (day === 0 || day === 6) {
                await Levels.awardXP(name, 'weekend-coffee', `weekend-coffee-${coffeeId}`, {
                    trackingType: 'coffees',
                    persistToBackend: false
                });
            }
        } else {
            // XP por trazer café - notificação INSTANTÂNEA
            await Levels.awardXP(name, 'coffee-brought', `coffee-brought-${coffeeId}`, {
                trackingType: 'coffees',
                persistToBackend: false
            });
        }
        
        // Verificar conquistas para o usuário
        await Achievements.checkAchievements(name, null, {
            action: State.getCoffeeType() === 'made' ? 'coffee-made' : 'coffee-brought',
            time: now.toISOString(),
            hour: hour
        });
        
        // Update UI
        this.updateStats();
        this.updateHistory();
        this.updateRanking(State.getCoffeeType());
        this.updateHomeStats();
        this.updateTodayCoffee();
        
        // Close modal
        this.closeModal();
        
        // Show success
        Utils.showToast(State.getCoffeeType() === 'made' ? 'Café registrado! ☕' : 'Café anotado! 🛒');
    },
    
    updateStats() {
        const coffeeData = State.getCoffeeData();
        
        // Last coffee maker - pegar o mais recente (ordenado por data DESC da API)
        // Arrays vêm ordenados do mais recente para o mais antigo
        const lastMade = this.getMostRecentCoffee(coffeeData.made);
        const lastMakerEl = document.getElementById('lastCoffeeMaker');
        if (lastMakerEl) {
            lastMakerEl.textContent = lastMade 
                ? `${lastMade.name} - ${Utils.formatTime(lastMade.date)}`
                : 'Ninguém ainda hoje 😢';
        }
        
        // Last coffee bringer
        const lastBrought = this.getMostRecentCoffee(coffeeData.brought);
        const lastBringerEl = document.getElementById('lastCoffeeBringer');
        if (lastBringerEl) {
            lastBringerEl.textContent = lastBrought
                ? `${lastBrought.name} - ${Utils.formatDate(lastBrought.date)}`
                : 'Ninguém lembra... 🤔';
        }
    },

    /**
     * Obtém o café mais recente de um array
     * Arrays podem vir ordenados DESC da API ou ASC de adições locais
     * 🔥 BUG FIX: Filtra por "hoje" para evitar mostrar café de dias anteriores
     */
    getMostRecentCoffee(coffees) {
        if (!coffees || coffees.length === 0) return null;
        
        // Filtrar apenas cafés de HOJE
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayCoffees = coffees.filter(coffee => {
            const coffeeDate = new Date(coffee.date);
            coffeeDate.setHours(0, 0, 0, 0);
            return coffeeDate.getTime() === today.getTime();
        });
        
        if (todayCoffees.length === 0) return null;
        
        // Retornar o café com a data mais recente HOJE
        return todayCoffees.reduce((latest, current) => {
            const latestDate = new Date(latest.date).getTime();
            const currentDate = new Date(current.date).getTime();
            return currentDate > latestDate ? current : latest;
        });
    },
    
    updateHistory() {
        const historyList = document.getElementById('coffeeHistory');
        if (!historyList) return;
        
        const history = State.getCoffeeData().history;
        const currentUser = State.getUser();
        
        if (history.length === 0) {
            historyList.innerHTML = '<li class="history-item">Nenhum registro ainda...</li>';
            return;
        }
        
        // Ordenar histórico por data DESC (mais recente primeiro)
        const sortedHistory = [...history].sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        // 🆕 Limite inicial de 5 itens, com opção de expandir
        const initialLimit = 5;
        
        // Gerar HTML dos itens
        const generateItemHtml = (item) => {
            const rating = State.getCoffeeRating(item.id);
            const ratingHtml = rating && rating.average > 0 
                ? `<span class="item-rating"><i class="fas fa-star"></i> ${rating.average.toFixed(1)}</span>`
                : '';
            
            const displayName = item.name || 'Alguém';
            
            // 🆕 Detectar tipo de ação e criar visual apropriado
            const actionType = this.detectActionType(item);
            const actionInfo = this.getActionDisplayInfo(actionType, item, displayName);
            
            // 🔧 Usar Utils.normalizeName para comparação consistente
            const normalizedUser = Utils.normalizeName(currentUser);
            
            // Verificar se é o próprio usuário
            const isOwnItem = Utils.normalizeName(displayName) === normalizedUser;
            
            // Verificar se o usuário já avaliou este café (só para 'made')
            const userRating = rating && rating.raters ? rating.raters.find(r => 
                Utils.normalizeName(r.name) === normalizedUser
            ) : null;
            
            // Definir texto e estilo baseado no estado
            let statusText = '';
            let itemClass = `history-item history-${actionType}`;
            let clickReason = ''; // 🆕 Razão para mostrar no toast
            
            // Aplicar estilo "own" para QUALQUER item do próprio usuário
            if (isOwnItem) {
                itemClass += ' own-item';
                statusText = actionType === 'made' ? 'Seu café' : 'Você trouxe';
                clickReason = actionType === 'made' 
                    ? 'own-coffee' 
                    : 'own-supply';
            } else if (actionType === 'made') {
                if (userRating) {
                    statusText = `Você avaliou: ${'⭐'.repeat(userRating.stars)}`;
                    itemClass += ' already-rated';
                    clickReason = 'already-rated';
                } else {
                    statusText = 'Clique para avaliar';
                    clickReason = 'can-rate';
                }
            } else {
                // Suprimentos de outras pessoas
                clickReason = 'supply-no-rating';
            }
            
            // 🆕 SEMPRE adicionar data-action para feedback, mas com razão diferente
            const dataAttrs = `data-action="handleHistoryClick" data-coffee-id="${item.id}" data-maker-name="${Utils.escapeHtml(displayName)}" data-click-reason="${clickReason}" data-action-type="${actionType}"`;
            
            // Só mostrar nota se NÃO for um marcador de item especial [xxx]
            const noteText = item.note || '';
            const isSpecialMarker = noteText.startsWith('[') && noteText.includes(']');
            const showNote = noteText && !isSpecialMarker;
            
            return `
                <li class="${itemClass}" ${dataAttrs}>
                    <div class="history-header">
                        <div class="history-badge ${actionType}">${actionInfo.badgeHtml || actionInfo.badge}</div>
                        <span class="history-category">${actionInfo.category}</span>
                    </div>
                    <div class="history-content">
                        <strong>${actionInfo.message}</strong>${ratingHtml}
                        ${actionInfo.xpBadge ? `<span class="history-xp">${actionInfo.xpBadge}</span>` : ''}
                    </div>
                    ${showNote ? `<div class="history-note">"${Utils.escapeHtml(noteText)}"</div>` : ''}
                    <div class="time">${Utils.formatDateTime(item.date)}${statusText ? ` • ${statusText}` : ''}</div>
                </li>
            `;
        };
        
        // Renderizar itens iniciais
        const visibleItems = sortedHistory.slice(0, initialLimit);
        const hiddenItems = sortedHistory.slice(initialLimit, 20); // máximo 20 total
        
        let html = visibleItems.map(generateItemHtml).join('');
        
        // Adicionar itens ocultos (se houver)
        if (hiddenItems.length > 0) {
            // 🔧 FIX: Preservar estado expandido
            const displayStyle = this.historyExpanded ? 'block' : 'none';
            html += `<div class="history-hidden" id="historyHidden" style="display: ${displayStyle};">`;
            html += hiddenItems.map(generateItemHtml).join('');
            html += `</div>`;
            
            // Botão para expandir/recolher - também preservar estado
            const btnClass = this.historyExpanded ? 'history-expand-btn expanded' : 'history-expand-btn';
            const btnIcon = this.historyExpanded ? 'fa-chevron-up' : 'fa-chevron-down';
            const btnText = this.historyExpanded ? 'Ver menos' : `Ver mais ${hiddenItems.length} registros`;
            
            html += `
                <li class="${btnClass}" data-action="toggleHistoryExpand">
                    <i class="fas ${btnIcon}"></i>
                    <span>${btnText}</span>
                </li>
            `;
        }
        
        historyList.innerHTML = html;
    },
    
    // 🆕 Handler centralizado para cliques no histórico
    handleHistoryClick(coffeeId, makerName, clickReason, actionType) {
        const messages = {
            'can-rate': null, // Vai abrir modal
            'own-coffee': '😊 Este é o seu café! Você não pode se auto-avaliar.',
            'own-supply': '📦 Este é um suprimento que você trouxe!',
            'already-rated': '⭐ Você já avaliou este café!',
            'supply-no-rating': '📦 Suprimentos não são avaliados, apenas cafés feitos.'
        };
        
        // Se pode avaliar, abre o modal
        if (clickReason === 'can-rate') {
            this.openRatingModal(coffeeId, makerName);
            return;
        }
        
        // Caso contrário, mostra notificação explicativa
        const message = messages[clickReason];
        if (message) {
            Utils.showToast(message);
        }
    },
    
    // 🆕 Toggle para expandir/recolher histórico
    toggleHistoryExpand() {
        const hiddenDiv = document.getElementById('historyHidden');
        const expandBtn = document.querySelector('.history-expand-btn');
        
        if (!hiddenDiv || !expandBtn) return;
        
        // 🔧 FIX: Salvar estado para preservar entre updates
        this.historyExpanded = !this.historyExpanded;
        
        if (this.historyExpanded) {
            hiddenDiv.style.display = 'block';
            expandBtn.innerHTML = `
                <i class="fas fa-chevron-up"></i>
                <span>Ver menos</span>
            `;
            expandBtn.classList.add('expanded');
        } else {
            hiddenDiv.style.display = 'none';
            const count = hiddenDiv.querySelectorAll('.history-item').length;
            expandBtn.innerHTML = `
                <i class="fas fa-chevron-down"></i>
                <span>Ver mais ${count} registros</span>
            `;
            expandBtn.classList.remove('expanded');
        }
    },
    
    // 🆕 Detecta o tipo de ação baseado no registro
    detectActionType(item) {
        if (item.type === 'made') return 'made';
        if (item.specialItem) return 'special';
        
        // 🔧 FIX: Verificar se tem item especial no campo note (ex: "[filtro-cafe]")
        if (item.note) {
            const noteMatch = item.note.match(/^\[([^\]]+)\]/);
            if (noteMatch) {
                const itemKey = noteMatch[1];
                if (this.SPECIAL_ITEMS[itemKey]) {
                    return 'special';
                }
            }
        }
        
        if (item.type === 'brought') return 'brought';
        
        // Fallback: verificar pela mensagem
        if (item.message) {
            if (item.message.includes('fez café')) return 'made';
            // Verificar itens especiais pela mensagem ANTES de verificar "trouxe café"
            for (const key of Object.keys(this.SPECIAL_ITEMS)) {
                const itemName = this.SPECIAL_ITEMS[key].name.toLowerCase();
                if (item.message.toLowerCase().includes(itemName)) return 'special';
            }
            if (item.message.includes('trouxe café')) return 'brought';
        }
        return 'brought';
    },
    
    // 🆕 Extrai informações do item especial do registro
    extractSpecialItemInfo(item) {
        // 1. Primeiro tenta pelo campo specialItem
        if (item.specialItem && this.SPECIAL_ITEMS[item.specialItem]) {
            const info = this.SPECIAL_ITEMS[item.specialItem];
            return {
                key: item.specialItem,
                icon: info.icon,
                name: info.name,
                xp: this.getSpecialItemXP(item.specialItem)
            };
        }
        
        // 2. Tenta extrair do campo note (ex: "[filtro-cafe] Filtro de Café")
        if (item.note) {
            const noteMatch = item.note.match(/^\[([^\]]+)\]/);
            if (noteMatch) {
                const itemKey = noteMatch[1];
                if (this.SPECIAL_ITEMS[itemKey]) {
                    const info = this.SPECIAL_ITEMS[itemKey];
                    return {
                        key: itemKey,
                        icon: info.icon,
                        name: info.name,
                        xp: this.getSpecialItemXP(itemKey)
                    };
                }
            }
        }
        
        // 3. Tenta detectar pela mensagem
        if (item.message) {
            for (const [key, info] of Object.entries(this.SPECIAL_ITEMS)) {
                if (item.message.toLowerCase().includes(info.name.toLowerCase())) {
                    return {
                        key: key,
                        icon: info.icon,
                        name: info.name,
                        xp: this.getSpecialItemXP(key)
                    };
                }
            }
        }
        
        // Fallback
        return {
            key: null,
            icon: '🎁',
            name: 'item especial',
            xp: null
        };
    },
    
    // 🆕 Retorna informações de exibição baseado no tipo de ação
    getActionDisplayInfo(actionType, item, displayName) {
        switch (actionType) {
            case 'made':
                return {
                    badge: '☕',
                    badgeHtml: `<span class="history-badge-emoji">☕</span>`,
                    category: 'Fez Café',
                    message: `<span class="history-name">${Utils.escapeHtml(displayName)}</span> preparou o café`,
                    xpBadge: null
                };
            
            case 'special':
                // 🔧 FIX: Usar método centralizado para extrair info do item
                const specialInfo = this.extractSpecialItemInfo(item);
                const imagePath = this.getItemImage(specialInfo.key);
                
                // 🖼️ Criar badge com imagem se disponível
                let badgeHtml = `<span class="history-badge-emoji">${specialInfo.icon}</span>`;
                if (imagePath) {
                    badgeHtml = `
                        <div class="history-badge-img">
                            <img src="${imagePath}" alt="${specialInfo.name}" loading="lazy">
                        </div>
                    `;
                }
                
                return {
                    badge: specialInfo.icon,
                    badgeHtml: badgeHtml,
                    category: 'Trouxe Suprimento',
                    message: `<span class="history-name">${Utils.escapeHtml(displayName)}</span> trouxe ${specialInfo.name.toLowerCase()}`,
                    xpBadge: specialInfo.xp ? `+${specialInfo.xp} XP` : null
                };
            
            case 'brought':
            default:
                return {
                    badge: '🛒',
                    badgeHtml: `<span class="history-badge-emoji">🛒</span>`,
                    category: 'Trouxe Café',
                    message: `<span class="history-name">${Utils.escapeHtml(displayName)}</span> trouxe café`,
                    xpBadge: null
                };
        }
    },
    
    showRanking(type) {
        State.setCoffeeType(type);
        // Tab UI update is now handled by main.js event delegation
        this.updateRanking(type);
    },
    
    updateRanking(type) {
        const rankingList = document.getElementById('coffeeRanking');
        if (!rankingList) return;
        
        const data = State.getCoffeeData(type);
        
        // 🆕 Para "brought", calcular por pontos totais (não quantidade)
        // Para "made", manter contagem simples
        if (type === 'brought') {
            this.updateRankingByPoints(rankingList, data);
        } else {
            this.updateRankingByCount(rankingList, data);
        }
    },
    
    // 🆕 Ranking por quantidade (para cafés feitos)
    updateRankingByCount(rankingList, data) {
        // Count by person
        const counts = {};
        data.forEach(record => {
            counts[record.name] = (counts[record.name] || 0) + 1;
        });
        
        // Sort by count
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        if (sorted.length === 0) {
            rankingList.innerHTML = `
                <li class="ranking-item">
                    <span class="name">Nenhum registro ainda...</span>
                </li>
            `;
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        
        rankingList.innerHTML = sorted.map((item, index) => `
            <li class="ranking-item">
                <span class="rank">${medals[index]}</span>
                <span class="name">${Utils.escapeHtml(item[0])}</span>
                <span class="count">${item[1]}x</span>
            </li>
        `).join('');
    },
    
    // 🆕 Ranking por pontos (para suprimentos trazidos)
    updateRankingByPoints(rankingList, data) {
        // Calcular pontos por pessoa
        const stats = {};
        
        data.forEach(record => {
            const name = record.name;
            if (!stats[name]) {
                stats[name] = { points: 0, items: 0, details: {} };
            }
            
            // 🔧 FIX: Usar extractSpecialItemInfo para detectar itens corretamente
            let xp = 0;
            let itemType = 'Café';
            
            // 1. Verificar specialItem direto
            if (record.specialItem && this.SPECIAL_ITEMS[record.specialItem]) {
                xp = this.getSpecialItemXP(record.specialItem);
                itemType = this.SPECIAL_ITEMS[record.specialItem].name;
            } 
            // 2. Verificar pelo campo note (ex: "[filtro-cafe]")
            else if (record.note) {
                const noteMatch = record.note.match(/^\[([^\]]+)\]/);
                if (noteMatch && this.SPECIAL_ITEMS[noteMatch[1]]) {
                    const itemKey = noteMatch[1];
                    xp = this.getSpecialItemXP(itemKey);
                    itemType = this.SPECIAL_ITEMS[itemKey].name;
                } else {
                    // Café simples
                    xp = this.getSpecialItemXP('coffee-brought') || 30;
                }
            } else {
                // Café simples trazido = XP base de coffee-brought
                xp = this.getSpecialItemXP('coffee-brought') || 30;
            }
            
            stats[name].points += xp;
            stats[name].items += 1;
            stats[name].details[itemType] = (stats[name].details[itemType] || 0) + 1;
        });
        
        // Ordenar por pontos (maior primeiro)
        const sorted = Object.entries(stats)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 5);
        
        if (sorted.length === 0) {
            rankingList.innerHTML = `
                <li class="ranking-item">
                    <span class="name">Nenhum registro ainda...</span>
                </li>
            `;
            return;
        }
        
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        
        rankingList.innerHTML = sorted.map((item, index) => {
            // Criar tooltip com detalhes
            const detailsList = Object.entries(item.details)
                .map(([type, count]) => `${count}x ${type}`)
                .join(', ');
            
            return `
                <li class="ranking-item ranking-points">
                    <span class="rank">${medals[index]}</span>
                    <div class="ranking-info">
                        <span class="name">${Utils.escapeHtml(item.name)}</span>
                        <span class="ranking-details">${detailsList}</span>
                    </div>
                    <div class="ranking-score">
                        <span class="points">${item.points} pts</span>
                        <span class="items-count">${item.items} ${item.items === 1 ? 'item' : 'itens'}</span>
                    </div>
                </li>
            `;
        }).join('');
    },
    
    updateHomeStats() {
        const totalCoffeesEl = document.getElementById('totalCoffees');
        if (totalCoffeesEl) {
            totalCoffeesEl.textContent = State.getTotalCoffees();
        }
    },
    
    // Rating System
    updateTodayCoffee() {
        const todayCoffeeEl = document.getElementById('todayCoffee');
        if (!todayCoffeeEl) return;
        
        const lastCoffee = State.getLastMadeCoffee();
        const currentUser = State.getUser();
        
        if (!lastCoffee) {
            todayCoffeeEl.innerHTML = `
                <div class="no-rating-msg">
                    <i class="fas fa-coffee"></i>
                    <p>Ninguém fez café ainda hoje...</p>
                </div>
            `;
            return;
        }
        
        const rating = State.getCoffeeRating(lastCoffee.id);
        const averageRating = rating ? rating.average : 0;
        const ratingCount = rating ? rating.raters.length : 0;
        
        // 🔧 CORREÇÃO: Usar Utils.normalizeName para comparação consistente (remove acentos)
        const normalizedUser = Utils.normalizeName(currentUser);
        
        // Verificar se é o próprio café do usuário
        const isOwnCoffee = Utils.normalizeName(lastCoffee.name) === normalizedUser;
        
        // Check if current user already rated (comparação normalizada)
        const userRated = rating && rating.raters ? rating.raters.find(r => 
            Utils.normalizeName(r.name) === normalizedUser
        ) : null;
        const userRating = userRated ? userRated.stars : 0;
        
        // Se for o próprio café, não mostrar opção de avaliar
        if (isOwnCoffee) {
            todayCoffeeEl.innerHTML = `
                <div class="today-coffee">
                    <div class="maker-name">☕ ${Utils.escapeHtml(lastCoffee.name)}</div>
                    <div class="maker-time">${Utils.formatDateTime(lastCoffee.date)}</div>
                </div>
                
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: 10px;">
                    Este é o seu café! Você não pode se auto-avaliar 😊
                </p>
                
                <div class="average-rating">
                    <span class="rating-value">${averageRating > 0 ? averageRating.toFixed(1) : '-'}</span>
                    <div>
                        <div style="color: #fbbf24;">⭐ Média</div>
                        <span class="rating-count">${ratingCount} ${ratingCount === 1 ? 'avaliação' : 'avaliações'}</span>
                    </div>
                </div>
            `;
            return;
        }
        
        // Se já avaliou, mostrar avaliação e bloquear re-avaliação
        if (userRated) {
            todayCoffeeEl.innerHTML = `
                <div class="today-coffee">
                    <div class="maker-name">☕ ${Utils.escapeHtml(lastCoffee.name)}</div>
                    <div class="maker-time">${Utils.formatDateTime(lastCoffee.date)}</div>
                </div>
                
                <p style="text-align: center; color: var(--text-secondary); margin-bottom: 10px;">
                    ✅ Você já avaliou este café!
                </p>
                
                <div class="rating-stars rated-disabled" data-coffee-id="${lastCoffee.id}" data-maker="${Utils.escapeHtml(lastCoffee.name)}">
                    ${[1, 2, 3, 4, 5].map(i => `
                        <span class="star ${i <= userRating ? 'active' : ''}" data-value="${i}">⭐</span>
                    `).join('')}
                </div>
                
                <div class="average-rating">
                    <span class="rating-value">${averageRating > 0 ? averageRating.toFixed(1) : '-'}</span>
                    <div>
                        <div style="color: #fbbf24;">⭐ Média</div>
                        <span class="rating-count">${ratingCount} ${ratingCount === 1 ? 'avaliação' : 'avaliações'}</span>
                    </div>
                </div>
            `;
            return;
        }
        
        // Usuário ainda não avaliou - mostrar estrelas clicáveis
        todayCoffeeEl.innerHTML = `
            <div class="today-coffee">
                <div class="maker-name">☕ ${Utils.escapeHtml(lastCoffee.name)}</div>
                <div class="maker-time">${Utils.formatDateTime(lastCoffee.date)}</div>
            </div>
            
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: 10px;">
                Avalie o café!
            </p>
            
            <div class="rating-stars" data-coffee-id="${lastCoffee.id}" data-maker="${Utils.escapeHtml(lastCoffee.name)}">
                ${[1, 2, 3, 4, 5].map(i => `
                    <span class="star" data-value="${i}" data-action="rateTodayCoffee" data-stars="${i}">⭐</span>
                `).join('')}
            </div>
            
            <div class="average-rating">
                <span class="rating-value">${averageRating > 0 ? averageRating.toFixed(1) : '-'}</span>
                <div>
                    <div style="color: #fbbf24;">⭐ Média</div>
                    <span class="rating-count">${ratingCount} ${ratingCount === 1 ? 'avaliação' : 'avaliações'}</span>
                </div>
            </div>
        `;
    },
    
    async rateCoffee(stars) {
        const user = State.getUser();
        if (!user) {
            document.getElementById('usernameModal').classList.add('active');
            return;
        }
        
        const lastCoffee = State.getLastMadeCoffee();
        if (!lastCoffee) return;
        
        // 🔧 CORREÇÃO: Usar Utils.normalizeName para comparação consistente (remove acentos)
        const normalizedUser = Utils.normalizeName(user);
        
        // Can't rate your own coffee
        if (Utils.normalizeName(lastCoffee.name) === normalizedUser) {
            Utils.showToast('Você não pode avaliar seu próprio café! 😅');
            return;
        }
        
        // Verificar se já avaliou este café
        const existingRating = State.getCoffeeRating(lastCoffee.id);
        if (existingRating && existingRating.raters) {
            const alreadyRated = existingRating.raters.find(r => 
                Utils.normalizeName(r.name) === normalizedUser
            );
            if (alreadyRated) {
                Utils.showToast('Você já avaliou este café! ⭐');
                return;
            }
        }
        
        try {
            await State.rateCoffee(lastCoffee.id, lastCoffee.name, user, stars);
        } catch (error) {
            console.error('Erro ao salvar avaliação:', error);
            Utils.showToast(error.message || 'Erro ao salvar avaliação');
            return;
        }
        
        // 🔒 CORREÇÃO: XP é adicionado pelo BACKEND (Points Engine)
        // Não deve ser adicionado no frontend para evitar duplicação
        const { Levels } = await import('./levels/index.js');
        
        // Só ganha XP na primeira avaliação desse café
        // ❌ COMENTADO - Backend cuida disso via pointsEngine.addPoints()
        // await Levels.addTrackedXP(user, 'rating-given', 'ratings', `rating-${lastCoffee.id}`);
        
        // XP para quem recebeu 5 estrelas (só uma vez por café)
        // ❌ COMENTADO - Backend não tem essa lógica ainda (TODO)
        // if (stars === 5) {
        //     await Levels.addTrackedXP(lastCoffee.name, 'five-star-received', 'fiveStars', `fivestar-${lastCoffee.id}-from-${user}`);
        // }
        
        // Update UI
        this.updateTodayCoffee();
        this.updateTopBaristas();
        this.updateHistory();
        
        // 🔧 CORREÇÃO: Removida mensagem "Barista notificado" que era enganosa
        // A notificação real ao barista é feita via WebSocket pelo backend
        const messages = [
            '☕ Avaliação registrada!',
            '⭐ Valeu pela nota!',
            '🎯 Avaliação salva!',
            '📊 Ranking atualizado!'
        ];
        Utils.showToast(messages[Math.floor(Math.random() * messages.length)]);
    },
    
    openRatingModal(coffeeId, makerName) {
        const user = State.getUser();
        if (!user) {
            document.getElementById('usernameModal').classList.add('active');
            return;
        }
        
        // 🔧 CORREÇÃO: Usar Utils.normalizeName para comparação consistente (remove acentos)
        const normalizedUser = Utils.normalizeName(user);
        
        // Can't rate your own coffee
        if (Utils.normalizeName(makerName) === normalizedUser) {
            Utils.showToast('Você não pode avaliar seu próprio café! 😅');
            return;
        }
        
        // Verificar se já avaliou este café
        const existingRating = State.getCoffeeRating(coffeeId);
        if (existingRating && existingRating.raters) {
            const alreadyRated = existingRating.raters.find(r => 
                Utils.normalizeName(r.name) === normalizedUser
            );
            if (alreadyRated) {
                Utils.showToast(`Você já avaliou este café com ${'⭐'.repeat(alreadyRated.stars)}!`);
                return;
            }
        }
        
        this.selectedCoffeeId = coffeeId;
        this.selectedMakerName = makerName;
        this.currentRating = 0;
        
        const modal = document.getElementById('ratingModal');
        const makerEl = document.getElementById('ratingMakerName');
        
        if (modal && makerEl) {
            makerEl.textContent = makerName;
            
            // Reset stars (nenhuma avaliação prévia se chegou aqui)
            const stars = modal.querySelectorAll('.star');
            stars.forEach(star => star.classList.remove('active'));
            
            this.currentRating = 0;
            
            modal.classList.add('active');
        }
    },
    
    closeRatingModal() {
        const modal = document.getElementById('ratingModal');
        if (modal) {
            modal.classList.remove('active');
        }
        this.selectedCoffeeId = null;
        this.selectedMakerName = null;
        this.currentRating = 0;
    },
    
    setModalRating(stars) {
        this.currentRating = stars;
        const modal = document.getElementById('ratingModal');
        if (modal) {
            const starEls = modal.querySelectorAll('.star');
            starEls.forEach((star, index) => {
                star.classList.toggle('active', index < stars);
            });
        }
    },
    
    async submitRating() {
        if (!this.selectedCoffeeId || this.currentRating === 0) {
            Utils.showToast('Selecione uma nota! ⭐');
            return;
        }
        
        const user = State.getUser();
        if (!user) {
            Utils.showToast('Você precisa estar logado para avaliar!');
            return;
        }
        
        // 🔧 CORREÇÃO: Usar Utils.normalizeName para comparação consistente (remove acentos)
        const normalizedUser = Utils.normalizeName(user);
        
        // Verificação final de auto-avaliação
        if (this.selectedMakerName && Utils.normalizeName(this.selectedMakerName) === normalizedUser) {
            Utils.showToast('Você não pode avaliar seu próprio café! 😅');
            this.closeRatingModal();
            return;
        }
        
        // Verificação final de re-avaliação
        const existingRating = State.getCoffeeRating(this.selectedCoffeeId);
        if (existingRating && existingRating.raters) {
            const alreadyRated = existingRating.raters.find(r => 
                Utils.normalizeName(r.name) === normalizedUser
            );
            if (alreadyRated) {
                Utils.showToast('Você já avaliou este café! ⭐');
                this.closeRatingModal();
                return;
            }
        }
        
        try {
            await State.rateCoffee(this.selectedCoffeeId, this.selectedMakerName, user, this.currentRating);
        } catch (error) {
            console.error('Erro ao salvar avaliação:', error);
            Utils.showToast(error.message || 'Erro ao salvar avaliação');
            this.closeRatingModal();
            return;
        }
        
        // 🔒 CORREÇÃO: XP é adicionado pelo BACKEND (Points Engine)
        // Não deve ser adicionado no frontend para evitar duplicação
        // O servidor irá processar a avaliação e adicionar 5 pontos automaticamente
        try {
            const { Levels } = await import('./levels/index.js');
            
            // XP para quem avaliou (só na primeira vez)
            // ❌ COMENTADO - Backend cuida disso via pointsEngine.addPoints()
            // if (user) {
            //     await Levels.addTrackedXP(user, 'rating-given', 'ratings', `rating-${this.selectedCoffeeId}`);
            // }
            
            // XP bônus para quem recebeu 5 estrelas (só uma vez por café/avaliador)
            // ❌ COMENTADO - Backend não tem essa lógica ainda (TODO)
            // if (this.selectedMakerName && this.currentRating === 5) {
            //     await Levels.addTrackedXP(this.selectedMakerName, 'five-star-received', 'fiveStars', `fivestar-${this.selectedCoffeeId}-from-${user}`);
            // }
        } catch (error) {
            console.warn('Erro ao adicionar XP:', error);
        }
        
        // Check achievements for the user who rated
        try {
            const { Achievements } = await import('./achievements/index.js');
            if (user) {
                await Achievements.checkAchievements(user, null, {
                    action: 'rating-given',
                    stars: this.currentRating,
                    coffeeId: this.selectedCoffeeId,
                    makerName: this.selectedMakerName,
                    time: new Date().toISOString()
                });
            }
            
            // Check achievements for the coffee maker (might have received 5 stars or improved average)
            if (this.selectedMakerName) {
                await Achievements.checkAchievements(this.selectedMakerName, null, {
                    action: 'rating-received',
                    stars: this.currentRating,
                    coffeeId: this.selectedCoffeeId,
                    raterName: user,
                    time: new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('Erro ao verificar conquistas:', error);
        }
        
        this.closeRatingModal();
        this.updateTodayCoffee();
        this.updateTopBaristas();
        this.updateHistory();
        
        Utils.showToast('⭐ Avaliação registrada!');
    },
    
    updateTopBaristas() {
        const listEl = document.getElementById('topBaristasList');
        if (!listEl) return;
        
        const topBaristas = State.getTopBaristas();
        
        if (topBaristas.length === 0) {
            listEl.innerHTML = `
                <div class="no-rating-msg">
                    <p>Ainda não há avaliações suficientes...</p>
                    <small>Avalie os cafés para ver o ranking!</small>
                </div>
            `;
            return;
        }
        
        const medals = ['🏆', '🥈', '🥉', '4️⃣', '5️⃣'];
        
        listEl.innerHTML = topBaristas.slice(0, 5).map((barista, index) => `
            <div class="barista-item ${index === 0 ? 'gold' : ''}">
                <span class="position">${medals[index] || (index + 1) + 'º'}</span>
                <div class="barista-info">
                    <div class="barista-name">${Utils.escapeHtml(barista.name)}</div>
                    <div class="barista-stats">${barista.coffeesMade} ${barista.coffeesMade === 1 ? 'café' : 'cafés'} • ${barista.totalRatings} ${barista.totalRatings === 1 ? 'avaliação' : 'avaliações'}</div>
                </div>
                <div class="barista-rating">
                    <i class="fas fa-star"></i>
                    ${barista.average.toFixed(1)}
                </div>
            </div>
        `).join('');
    },
    
    // ============================================
    // SPECIAL ITEMS (COMIDAS)
    // ============================================
    
    openSpecialItemModal() {
        const user = State.getUser();
        if (!user) {
            document.getElementById('usernameModal').classList.add('active');
            Utils.showToast('Por favor, faça login primeiro!', 'warning');
            return;
        }
        
        const modal = document.getElementById('specialItemModal');
        const grid = document.getElementById('specialItemsGrid');
        const selectedDiv = document.getElementById('specialItemSelected');
        const registerBtn = document.getElementById('registerSpecialItemBtn');
        const noteInput = document.getElementById('specialItemNote');
        
        // Reset estado
        this.selectedSpecialItem = null;
        selectedDiv.style.display = 'none';
        registerBtn.disabled = true;
        noteInput.value = '';
        
        // Renderizar grid de itens com IMAGENS
        grid.innerHTML = Object.entries(this.SPECIAL_ITEMS).map(([key, item]) => {
            const xp = this.getSpecialItemXP(key);
            const imagePath = this.getItemImage(key);
            
            // Card criativo com imagem de fundo e overlay
            return `
                <div class="special-item-option" data-item="${key}" data-action="selectSpecialItem">
                    ${imagePath ? `
                        <div class="special-item-img-container">
                            <img src="${imagePath}" alt="${item.name}" class="special-item-img" loading="lazy">
                            <div class="special-item-img-shine"></div>
                        </div>
                    ` : `
                        <span class="special-item-icon">${item.icon}</span>
                    `}
                    <span class="special-item-name">${item.name}</span>
                    <span class="special-item-xp">+${xp} XP</span>
                </div>
            `;
        }).join('');
        
        modal.classList.add('active');
    },
    
    closeSpecialItemModal() {
        const modal = document.getElementById('specialItemModal');
        modal.classList.remove('active');
        this.selectedSpecialItem = null;
    },
    
    selectSpecialItem(itemKey) {
        const item = this.SPECIAL_ITEMS[itemKey];
        if (!item) return;
        
        this.selectedSpecialItem = itemKey;
        
        // Atualizar UI - remover seleção anterior
        document.querySelectorAll('.special-item-option').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Marcar item selecionado
        const selectedEl = document.querySelector(`.special-item-option[data-item="${itemKey}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
        
        // Mostrar info do item selecionado com IMAGEM
        const selectedDiv = document.getElementById('specialItemSelected');
        const xp = this.getSpecialItemXP(itemKey);
        const imagePath = this.getItemImage(itemKey);
        
        // Atualizar ícone/imagem
        const iconEl = document.getElementById('selectedItemIcon');
        if (imagePath) {
            iconEl.innerHTML = `<img src="${imagePath}" alt="${item.name}" class="selected-item-img">`;
        } else {
            iconEl.textContent = item.icon;
        }
        
        document.getElementById('selectedItemName').textContent = item.name;
        document.getElementById('selectedItemXP').textContent = `+${xp} XP`;
        selectedDiv.style.display = 'block';
        
        // Habilitar botão de registrar
        document.getElementById('registerSpecialItemBtn').disabled = false;
    },
    
    async registerSpecialItem() {
        const user = State.getUser();
        if (!user) {
            Utils.showToast('Por favor, faça login primeiro!', 'warning');
            return;
        }
        
        if (!this.selectedSpecialItem) {
            Utils.showToast('Selecione um item primeiro!', 'warning');
            return;
        }
        
        const item = this.SPECIAL_ITEMS[this.selectedSpecialItem];
        const note = document.getElementById('specialItemNote').value.trim();
        const xp = this.getSpecialItemXP(this.selectedSpecialItem);
        
        // Desabilitar botão enquanto processa
        const registerBtn = document.getElementById('registerSpecialItemBtn');
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
        
        try {
            // Preparar registro
            const now = new Date();
            const record = {
                name: user,
                note: note,
                date: now.toISOString(),
                type: 'brought',
                specialItem: this.selectedSpecialItem
            };
            
            // Salvar usando o State (que envia para o backend)
            State.setCoffeeType('brought');
            await State.addCoffeeRecord(record);
            
            // 🆕 Atribuir XP do frontend (notificação visual)
            try {
                const { Levels } = await import('./levels/index.js');
                const { Achievements } = await import('./achievements/index.js');
                
                // Notificação visual de XP (backend já persistiu)
                await Levels.awardXP(user, this.selectedSpecialItem, `special-item-${this.selectedSpecialItem}-${record.id}`, {
                    trackingType: 'specialItems',
                    persistToBackend: false
                });
                
                // Verificar conquistas
                await Achievements.checkAchievements(user, null, {
                    action: 'special-item-brought',
                    itemType: this.selectedSpecialItem,
                    time: now.toISOString()
                });
            } catch (xpError) {
                console.warn('Erro ao processar XP no frontend:', xpError);
            }
            
            // Atualizar UI
            this.updateStats();
            this.updateHistory();
            this.updateRanking('brought');
            this.updateHomeStats();
            this.updateLastSpecialItem();
            
            // Fechar modal
            this.closeSpecialItemModal();
            
            // Mostrar sucesso
            Utils.showToast(`${item.icon} ${item.name} registrado! +${xp} XP`, 'success');
            
        } catch (error) {
            console.error('Erro ao registrar item especial:', error);
            Utils.showToast('❌ Erro ao registrar. Tente novamente.', 'error');
            
            // Restaurar botão
            registerBtn.disabled = false;
            registerBtn.innerHTML = '<i class="fas fa-check"></i> Registrar';
        }
    },
    
    // Atualiza o texto do último item especial trazido com imagem
    updateLastSpecialItem() {
        const lastSpecialEl = document.getElementById('lastSpecialItem');
        if (!lastSpecialEl) return;
        
        // Procurar último item especial no histórico de "brought"
        const brought = State.getCoffeeBrought();
        const lastSpecial = brought.find(item => {
            // Verificar se tem descrição com item especial
            const desc = item.note || '';
            return desc.startsWith('[') && desc.includes(']');
        });
        
        if (lastSpecial) {
            // Extrair o tipo do item da descrição
            const match = (lastSpecial.note || '').match(/\[([^\]]+)\]/);
            if (match) {
                const itemKey = match[1];
                const item = this.SPECIAL_ITEMS[itemKey];
                if (item) {
                    const imagePath = this.getItemImage(itemKey);
                    const imageHtml = imagePath 
                        ? `<img src="${imagePath}" alt="${item.name}" class="last-special-img">` 
                        : item.icon;
                    
                    lastSpecialEl.innerHTML = `
                        <span class="last-special-info">
                            ${imageHtml}
                            <span class="last-special-text">
                                <strong>${Utils.escapeHtml(lastSpecial.name)}</strong> trouxe ${item.name}
                            </span>
                        </span>
                    `;
                    return;
                }
            }
        }
        
        // Fallback se não encontrar item especial
        lastSpecialEl.textContent = 'Bolo, bolacha, biscoito... 🍪';
    }
};

// Funções globais removidas - usar data-action no HTML ou importar Coffee diretamente
// Sistema migrado para event delegation em main.js
