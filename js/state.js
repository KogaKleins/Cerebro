/**
 * STATE MANAGEMENT MODULE
 * Manages application state with API integration
 */

import { Api } from './api.js';
import { Utils } from './utils.js';

export const State = {
    currentUser: localStorage.getItem('cerebroUser') || null,
    currentCoffeeType: 'made',
    
    // Cache local dos dados (carregados da API)
    coffeeData: {
        made: [],
        brought: [],
        history: [],
        ratings: {}
    },
    
    chatMessages: [],
    
    // Flag para indicar se os dados foram carregados
    dataLoaded: false,
    
    quotes: [
        '"Café é o combustível do cérebro!" ☕',
        '"Funciona na minha máquina!" 🖥️',
        '"Isso é feature, não bug!" 🐛',
        '"Só mais 5 minutinhos..." ⏰',
        '"Quem comeu meu lanche da geladeira?!" 🥪',
        '"O prazo é para ontem!" 📅',
        '"Está em análise..." 🔍',
        '"Depois do almoço eu resolvo!" 🍽️',
        '"Isso deveria estar funcionando!" 😤',
        '"Já tentou desligar e ligar de novo?" 🔌',
        '"Na teoria, funciona..." 📚',
        '"O café acabou, a produtividade também!" ☕❌',
        '"Reunião que poderia ser um e-mail..." 📧',
        '"O cérebro pensa, a gráfica imprime!" 🧠🖨️',
        '"Se o café está quente, o dia será produtivo!" ☕🔥',
        '"Estamos trabalhando nisso... (Alt+Tab para o YouTube)" 📺',
    ],
    
    // ============================================
    // INICIALIZAÇÃO - Carrega dados da API
    // ============================================
    
    async init() {
        try {
            console.log('📡 Carregando dados do servidor...');
            
            // Carregar todos os dados em paralelo
            const [made, brought, history, ratings, messages] = await Promise.all([
                Api.getCoffeeMade(),
                Api.getCoffeeBrought(),
                Api.getCoffeeHistory(),
                Api.getRatings(),
                Api.getChatMessages()
            ]);
            
            this.coffeeData.made = made || [];
            this.coffeeData.brought = brought || [];
            this.coffeeData.history = history || [];
            this.coffeeData.ratings = ratings || {};
            this.chatMessages = messages || [];
            
            console.log('📊 Dados carregados:');
            console.log(`  ☕ Cafés feitos: ${this.coffeeData.made.length}`);
            console.log(`  🛒 Cafés trazidos: ${this.coffeeData.brought.length}`);
            console.log(`  📚 Histórico: ${this.coffeeData.history.length}`);
            console.log(`  ⭐ Avaliações: ${Object.keys(this.coffeeData.ratings).length}`);
            console.log(`  💬 Mensagens: ${this.chatMessages.length}`);
            
            // 🔧 CORREÇÃO ROBUSTA: Limpar cache local antigo de reações
            // Reações devem vir do servidor para evitar dessincronização
            // Mantemos apenas para mensagens muito recentes (últimos 5 minutos)
            try {
                const savedReactions = localStorage.getItem('cerebro-chat-reactions');
                if (savedReactions) {
                    const localReactions = JSON.parse(savedReactions);
                    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
                    
                    // Filtrar apenas reações de mensagens recentes
                    const recentMessageIds = new Set(
                        this.chatMessages
                            .filter(m => new Date(m.timestamp).getTime() > fiveMinutesAgo)
                            .map(m => String(m.id))
                    );
                    
                    this.chatMessages.forEach(m => {
                        const msgId = String(m.id);
                        // Só aplicar reações locais se:
                        // 1. A mensagem é recente (últimos 5 min)
                        // 2. E não tem reações do servidor
                        if (recentMessageIds.has(msgId) && 
                            localReactions[msgId] && 
                            (!m.reactions || Object.keys(m.reactions).length === 0)) {
                            m.reactions = localReactions[msgId];
                        }
                    });
                    
                    // Limpar cache antigo de reações (manter apenas mensagens que existem)
                    const currentMessageIds = new Set(this.chatMessages.map(m => String(m.id)));
                    const cleanedReactions = {};
                    Object.keys(localReactions).forEach(id => {
                        if (currentMessageIds.has(id)) {
                            cleanedReactions[id] = localReactions[id];
                        }
                    });
                    localStorage.setItem('cerebro-chat-reactions', JSON.stringify(cleanedReactions));
                }
            } catch (e) {
                console.warn('Erro ao restaurar reações:', e);
                // Em caso de erro, limpar cache corrompido
                localStorage.removeItem('cerebro-chat-reactions');
            }
            
            this.dataLoaded = true;
            console.log('✅ Dados carregados com sucesso!');
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            this.dataLoaded = false;
            return false;
        }
    },
    
    // ============================================
    // USER METHODS
    // ============================================
    
    saveUser() {
        localStorage.setItem('cerebroUser', this.currentUser);
    },
    
    setUser(username) {
        this.currentUser = username;
        this.saveUser();
    },
    
    getUser() {
        return this.currentUser;
    },
    
    // ============================================
    // COFFEE METHODS
    // ============================================
    
    setCoffeeType(type) {
        this.currentCoffeeType = type;
    },
    
    getCoffeeType() {
        return this.currentCoffeeType;
    },
    
    async addCoffeeRecord(record) {
        // Generate unique ID
        record.id = Date.now().toString();
        
        // 🔧 NOTA: Backend formata description como [specialItem] note
        // Aqui no cache local também precisamos manter consistência
        // Mas NÃO devemos modificar o record.note antes de enviar ao backend
        // pois o backend já adiciona o prefixo
        
        // Criar cópia do record para o cache local com note formatado
        const localRecord = { ...record };
        if (record.specialItem && this.currentCoffeeType === 'brought') {
            const originalNote = record.note || '';
            localRecord.note = `[${record.specialItem}]${originalNote ? ' ' + originalNote : ''}`;
        }
        
        // Adicionar ao cache local COM note formatado
        this.coffeeData[this.currentCoffeeType].push(localRecord);
        
        // Criar mensagem de histórico (com suporte a itens especiais)
        let historyMessage;
        if (this.currentCoffeeType === 'made') {
            historyMessage = `${record.name} fez café! ☕`;
        } else if (record.specialItem) {
            // Mapeamento de itens especiais para emojis
            const itemEmojis = {
                'filtro-cafe': '☕',
                'bolo': '🎂',
                'bolo-supreme': '👑🎂',
                'bolacha': '🍪',
                'bolacha-recheada': '🥮',
                'biscoito': '🥠',
                'sonho': '🍩'
            };
            const itemNames = {
                'filtro-cafe': 'filtro de café',
                'bolo': 'bolo',
                'bolo-supreme': 'bolo supreme',
                'bolacha': 'bolacha',
                'bolacha-recheada': 'bolacha recheada',
                'biscoito': 'biscoito',
                'sonho': 'sonho'
            };
            const emoji = itemEmojis[record.specialItem] || '🎁';
            const itemName = itemNames[record.specialItem] || record.specialItem;
            historyMessage = `${record.name} trouxe ${itemName}! ${emoji}`;
        } else {
            historyMessage = `${record.name} trouxe café! 🛒`;
        }
        
        // Criar registro de histórico (usando localRecord com note formatado)
        const historyRecord = {
            ...localRecord,
            message: historyMessage
        };
        
        // Adicionar ao histórico (no início)
        this.coffeeData.history.unshift(historyRecord);
        
        // Limitar histórico a 50 itens
        if (this.coffeeData.history.length > 50) {
            this.coffeeData.history = this.coffeeData.history.slice(0, 50);
        }
        
        // Salvar na API (record original, backend formata a description)
        try {
            if (this.currentCoffeeType === 'made') {
                await Api.addCoffeeMade(record);
            } else {
                await Api.addCoffeeBrought(record);
            }
            await Api.addCoffeeHistory(historyRecord);
            await Api.trimCoffeeHistory(50);
            
            // 🆕 Invalidar cache de stats para atualizar progresso de conquistas
            try {
                const { Achievements } = await import('./achievements/index.js');
                Achievements.invalidateStatsCache();
            } catch (e) {
                // Ignorar se módulo não estiver disponível
            }
        } catch (error) {
            console.error('Erro ao salvar café na API:', error);
            // 🔧 CORREÇÃO: Remover do cache local se falhou ao salvar
            // e propagar o erro para o usuário
            const index = this.coffeeData[this.currentCoffeeType].findIndex(c => c.id === localRecord.id);
            if (index > -1) {
                this.coffeeData[this.currentCoffeeType].splice(index, 1);
            }
            const histIndex = this.coffeeData.history.findIndex(h => h.id === localRecord.id);
            if (histIndex > -1) {
                this.coffeeData.history.splice(histIndex, 1);
            }
            throw error; // Propagar erro para exibir feedback ao usuário
        }
        
        return localRecord.id;
    },
    
    getCoffeeData(type) {
        return type ? this.coffeeData[type] : this.coffeeData;
    },
    
    getCoffeeMade() {
        return this.coffeeData.made || [];
    },
    
    getCoffeeBrought() {
        return this.coffeeData.brought || [];
    },
    
    getTotalCoffees() {
        return this.coffeeData.made.length + this.coffeeData.brought.length;
    },
    
    // ============================================
    // RATING METHODS
    // ============================================
    
    async rateCoffee(coffeeId, makerName, raterName, stars) {
        if (!this.coffeeData.ratings) {
            this.coffeeData.ratings = {};
        }
        
        if (!this.coffeeData.ratings[coffeeId]) {
            this.coffeeData.ratings[coffeeId] = {
                coffeeId: coffeeId,
                makerName: makerName,
                totalStars: 0,
                raters: [],
                average: 0
            };
        }
        
        const rating = this.coffeeData.ratings[coffeeId];
        
        // � CORREÇÃO: Usar Utils.normalizeName para comparação consistente (remove acentos)
        const normalizedMaker = Utils.normalizeName(makerName);
        const normalizedRater = Utils.normalizeName(raterName);
        
        // 🔒 CORREÇÃO: Não permitir auto-avaliação (comparação normalizada)
        if (normalizedMaker === normalizedRater) {
            console.warn('⚠️ Tentativa de auto-avaliação bloqueada:', { makerName, raterName });
            throw new Error('Você não pode avaliar seu próprio café');
        }
        
        // 🔒 CORREÇÃO: Verificar se usuário já avaliou (comparação normalizada)
        const existingRater = rating.raters.find(r => 
            Utils.normalizeName(r.name) === normalizedRater
        );
        if (existingRater) {
            // Usuário já avaliou - BLOQUEAR re-avaliação
            console.warn('⚠️ Usuário já avaliou este café:', { coffeeId, raterName });
            throw new Error('Você já avaliou este café');
        }
        
        // Add new rating (única avaliação permitida por usuário)
        rating.raters.push({ name: raterName, stars: stars });
        rating.totalStars += stars;
        
        // Calculate average
        rating.average = rating.totalStars / rating.raters.length;
        
        // Salvar na API
        try {
            await Api.saveRating(coffeeId, rating);
        } catch (error) {
            console.error('Erro ao salvar avaliação na API:', error);
            // Reverter mudança local em caso de erro
            rating.raters.pop();
            rating.totalStars -= stars;
            rating.average = rating.raters.length > 0 ? rating.totalStars / rating.raters.length : 0;
            throw error;
        }
        
        // 🆕 Invalidar cache de stats para atualizar progresso de conquistas
        try {
            const { Achievements } = await import('./achievements/index.js');
            Achievements.invalidateStatsCache();
        } catch (e) {
            // Ignorar se módulo não estiver disponível
        }
        
        return rating;
    },
    
    getCoffeeRating(coffeeId) {
        return this.coffeeData.ratings ? this.coffeeData.ratings[coffeeId] : null;
    },
    
    getRatings() {
        return this.coffeeData.ratings || {};
    },
    
    getTopBaristas() {
        if (!this.coffeeData.ratings) return [];
        
        // Aggregate ratings by barista name
        const baristaStats = {};
        
        Object.values(this.coffeeData.ratings).forEach(rating => {
            const name = rating.makerName; // Nome do barista
            if (!name) return;
            
            if (!baristaStats[name]) {
                baristaStats[name] = {
                    name: name,
                    totalStars: 0,
                    totalRatings: 0,
                    coffeesMade: 0
                };
            }
            baristaStats[name].totalStars += rating.totalStars;
            baristaStats[name].totalRatings += rating.raters.length;
            baristaStats[name].coffeesMade++;
        });
        
        // Calculate average and sort
        return Object.values(baristaStats)
            .map(b => ({
                ...b,
                average: b.totalRatings > 0 ? b.totalStars / b.totalRatings : 0
            }))
            .filter(b => b.totalRatings >= 1)
            .sort((a, b) => b.average - a.average);
    },
    
    getLastMadeCoffee() {
        const made = this.coffeeData.made;
        if (made.length === 0) return null;
        
        // 🔒 CORREÇÃO: Filtrar apenas cafés de HOJE
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayCoffees = made.filter(coffee => {
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
    
    // ============================================
    // CHAT METHODS
    // ============================================
    
    async addChatMessage(message) {
        // Verificar se a mensagem já existe (evitar duplicatas)
        const exists = this.chatMessages.some(m => m.id === message.id);
        if (!exists) {
            this.chatMessages.push(message);
        }
        
        // Salvar na API e retornar resultado (inclui xpGained)
        try {
            const result = await Api.addChatMessage(message);
            return result; // Retornar resultado para mostrar XP ganho
        } catch (error) {
            console.error('Erro ao salvar mensagem na API:', error);
            return null;
        }
    },
    
    async updateChatMessage(messageId, updatedMessage) {
        // Find and update in local cache
        const index = this.chatMessages.findIndex(m => m.id == messageId);
        if (index !== -1) {
            this.chatMessages[index] = updatedMessage;
        }
        
        // Reações são armazenadas apenas localmente (no localStorage)
        // pois não há suporte a reações no banco de dados ainda
        try {
            // Salvar reações no localStorage para persistência local
            const reactions = {};
            this.chatMessages.forEach(m => {
                if (m.reactions && Object.keys(m.reactions).length > 0) {
                    reactions[m.id] = m.reactions;
                }
            });
            localStorage.setItem('cerebro-chat-reactions', JSON.stringify(reactions));
        } catch (error) {
            console.error('Erro ao salvar reações localmente:', error);
        }
    },
    
    getChatMessages() {
        return this.chatMessages;
    },
    
    async setChatMessages(messages) {
        this.chatMessages = messages;
        // Mensagens são gerenciadas pelo WebSocket e banco de dados
        // Não é necessário bulk update - mensagens são salvas individualmente
    },
    
    // ============================================
    // SYNC METHODS - Recarregar dados do servidor
    // ============================================
    
    async syncData() {
        return await this.init();
    },
    
    async refreshChatMessages() {
        try {
            console.log('[State] 🔄 Buscando mensagens do servidor...');
            const serverMessages = await Api.getChatMessages();
            
            // 🔧 CORREÇÃO ROBUSTA: Servidor é SEMPRE fonte de verdade
            // Não mesclar com dados locais para evitar dessincronização
            if (serverMessages && Array.isArray(serverMessages)) {
                // 🆕 Log de diagnóstico
                const oldCount = this.chatMessages.length;
                const newCount = serverMessages.length;
                const oldLastId = this.chatMessages.length > 0 ? this.chatMessages[this.chatMessages.length - 1]?.id : 'none';
                const newLastId = serverMessages.length > 0 ? serverMessages[serverMessages.length - 1]?.id : 'none';
                
                console.log(`[State] 📊 Mensagens: ${oldCount} -> ${newCount}, LastID: ${oldLastId} -> ${newLastId}`);
                
                // Preservar apenas reações locais para mensagens que ainda não foram sincronizadas
                // (reações são salvas localmente antes de ir para o servidor)
                const localReactionsMap = new Map();
                
                // Primeiro, extrair reações locais
                this.chatMessages.forEach(m => {
                    if (m.reactions && Object.keys(m.reactions).length > 0) {
                        localReactionsMap.set(String(m.id), m.reactions);
                    }
                });
                
                // 🔧 CRÍTICO: Substituir completamente com dados do servidor
                // Isso garante que mensagens antigas não apareçam no lugar das novas
                // 🆕 Criar nova array ao invés de modificar a existente
                const newMessages = serverMessages.map(serverMsg => {
                    // Mesclar reações locais APENAS se servidor não tem reações
                    const localReactions = localReactionsMap.get(String(serverMsg.id));
                    if (localReactions && (!serverMsg.reactions || Object.keys(serverMsg.reactions).length === 0)) {
                        return { ...serverMsg, reactions: localReactions };
                    }
                    return { ...serverMsg };
                });
                
                // 🆕 CORREÇÃO: Atribuir as novas mensagens e ordenar
                this.chatMessages = newMessages;
                
                // Ordenar por timestamp para garantir ordem correta
                this.chatMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                console.log(`[State] ✅ Mensagens sincronizadas: ${this.chatMessages.length}`);
            } else {
                console.log('[State] ⚠️ Nenhuma mensagem retornada do servidor');
            }
            
            return this.chatMessages;
        } catch (error) {
            console.error('[State] ❌ Erro ao atualizar mensagens:', error);
            return this.chatMessages;
        }
    },
    
    async refreshCoffeeData() {
        try {
            const [made, brought, history, ratings] = await Promise.all([
                Api.getCoffeeMade(),
                Api.getCoffeeBrought(),
                Api.getCoffeeHistory(),
                Api.getRatings()
            ]);
            
            this.coffeeData.made = made || [];
            this.coffeeData.brought = brought || [];
            this.coffeeData.history = history || [];
            this.coffeeData.ratings = ratings || {};
            
            return this.coffeeData;
        } catch (error) {
            console.error('Erro ao atualizar dados de café:', error);
            return this.coffeeData;
        }
    },
    
    // ============================================
    // QUOTE METHODS
    // ============================================
    
    getRandomQuote() {
        const randomIndex = Math.floor(Math.random() * this.quotes.length);
        return this.quotes[randomIndex];
    }
};
