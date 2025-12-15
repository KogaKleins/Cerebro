/**
 * 🔍 ACHIEVEMENT CHECKER
 * Lógica de verificação e desbloqueio de conquistas
 */

import { achievementDefinitions } from './definitions.js';
import { Logger } from '../logger.js';

export const AchievementChecker = {
    /**
     * Verifica e desbloqueia conquistas para um usuário
     */
    check(userName, stats, metadata = {}, unlockedAchievements = {}) {
        if (!userName) return [];
        
        const newUnlocks = [];
        const userAchievements = unlockedAchievements[userName] || {};
        
        for (const [id, achievement] of Object.entries(achievementDefinitions)) {
            // Pular se já desbloqueada
            if (userAchievements[id]) continue;
            
            if (this.shouldUnlock(achievement, stats, unlockedAchievements, userName)) {
                Logger.debug(`🏆 Desbloqueando ${achievement.name} para ${userName}`);
                newUnlocks.push({ id, achievement, metadata });
            }
        }
        
        return newUnlocks;
    },

    /**
     * Verifica se deve desbloquear uma conquista
     */
    shouldUnlock(achievement, stats, unlockedAchievements = {}, userName = null) {
        switch (achievement.type) {
            case 'coffee-made':
                return (stats.coffeeMade || 0) >= achievement.requirement;
                
            case 'coffee-brought':
                return (stats.coffeeBrought || 0) >= achievement.requirement;
                
            case 'messages-sent':
                return (stats.messagesSent || 0) >= achievement.requirement;
                
            case 'ratings-given':
                return (stats.ratingsGiven || 0) >= achievement.requirement;
                
            case 'five-star-received':
                return (stats.fiveStarsReceived || 0) >= achievement.requirement;
                
            case 'average-rating':
                return (stats.averageRating || 0) >= achievement.requirement;
                
            case 'perfect-average':
                // Precisa ter média 5.0 com pelo menos 10 avaliações
                return (stats.averageRating || 0) >= achievement.requirement && 
                       (stats.totalRatingsReceived || 0) >= 10;
                
            case 'early-coffee':
                return stats.earlyCoffee === true;
                
            case 'late-coffee':
                return stats.lateCoffee === true;
                
            case 'weekend-coffee':
                return stats.weekendCoffee === true;
                
            case 'monday-coffee':
                return stats.mondayCoffee === true;
                
            case 'friday-coffee':
                return stats.fridayCoffee === true;
                
            case 'streak':
                return (stats.currentStreak || 0) >= achievement.requirement;
                
            case 'days-active':
                return (stats.daysActive || 0) >= achievement.requirement;
                
            case 'reactions-received':
                return (stats.reactionsReceived || 0) >= achievement.requirement;
                
            case 'reactions-given':
                return (stats.reactionsGiven || 0) >= achievement.requirement;
                
            case 'unique-emojis':
                return (stats.uniqueEmojis || 0) >= achievement.requirement;
                
            case 'messages-per-minute':
                return stats.messagesBurst >= achievement.requirement;
                
            case 'coffee-same-day':
                return stats.coffeeSameDay === true;
                
            case 'triple-action':
                return stats.tripleAction === true;
            
            // ═══════════════════════════════════════════════════════════════
            // 🆕 NOVOS TIPOS DE CONQUISTAS
            // ═══════════════════════════════════════════════════════════════
            case 'midnight-coffee':
                return stats.midnightCoffee === true;
                
            case 'early-coffee-count':
                return (stats.earlyCoffeeCount || 0) >= achievement.requirement;
                
            case 'humble-supplier':
                // Precisa ter trazido 10+ vezes - simplificado no frontend
                return (stats.coffeeBrought || 0) >= achievement.requirement;
                
            case 'perfect-month':
                return stats.perfectMonth === true;
                
            case 'comeback':
                return stats.comeback === true;
                
            case 'double-five-star':
                return stats.doubleFiveStar === true;
                
            case 'unanimous-five-star':
                return stats.unanimousFiveStar === true;
                
            case 'first-coffee-of-day':
                return (stats.firstCoffeeOfDayCount || 0) >= achievement.requirement;
                
            case 'last-coffee-of-day':
                return (stats.lastCoffeeOfDayCount || 0) >= achievement.requirement;
                
            case 'rated-different-makers':
                return (stats.differentMakersRated || 0) >= achievement.requirement;
                
            case 'all-categories':
                // Verificar se tem pelo menos uma conquista de cada categoria
                if (!unlockedAchievements || !userName) return false;
                const userAch = unlockedAchievements[userName] || {};
                const categories = new Set();
                for (const achId of Object.keys(userAch)) {
                    const ach = achievementDefinitions[achId];
                    if (ach) categories.add(ach.category);
                }
                const allCategories = new Set(Object.values(achievementDefinitions).map(a => a.category));
                return categories.size >= allCategories.size;
                
            case 'achievement-percentage':
                if (!unlockedAchievements || !userName) return false;
                const userAchievements = unlockedAchievements[userName] || {};
                const totalAchievements = Object.keys(achievementDefinitions).length;
                const unlockedCount = Object.keys(userAchievements).length;
                const percentage = unlockedCount / totalAchievements;
                return percentage >= achievement.requirement;
                
            default:
                return false;
        }
    },

    /**
     * Calcula estatísticas para um usuário
     * 🔧 CORREÇÃO: Verifica múltiplos campos possíveis para nome do usuário
     */
    calculateStats(userName, coffeeData, messages, ratings) {
        const stats = {
            coffeeMade: 0,
            coffeeBrought: 0,
            messagesSent: 0,
            ratingsGiven: 0,
            fiveStarsReceived: 0,
            totalRatingsReceived: 0,
            averageRating: 0,
            earlyCoffee: false,
            lateCoffee: false,
            weekendCoffee: false,
            mondayCoffee: false,
            fridayCoffee: false,
            currentStreak: 0,
            daysActive: 0,
            reactionsReceived: 0,
            reactionsGiven: 0,
            uniqueEmojis: 0,
            messagesBurst: 0,
            coffeeSameDay: false,
            tripleAction: false,
            // 🆕 Novas estatísticas para conquistas adicionadas
            midnightCoffee: false,
            earlyCoffeeCount: 0,
            perfectMonth: false,
            comeback: false,
            doubleFiveStar: false,
            unanimousFiveStar: false,
            firstCoffeeOfDayCount: 0,
            lastCoffeeOfDayCount: 0,
            differentMakersRated: 0
        };

        // 🔧 CORREÇÃO: Helper para verificar nome do usuário em múltiplos campos
        const matchesUser = (item) => {
            const name = item.name || item.username || item.maker?.username || item.maker?.name;
            return name === userName;
        };

        // Café feito - verifica múltiplos campos possíveis
        const userCoffees = coffeeData.made.filter(matchesUser);
        stats.coffeeMade = userCoffees.length;

        // Café trazido - verifica múltiplos campos possíveis
        stats.coffeeBrought = coffeeData.brought.filter(matchesUser).length;

        // Mensagens enviadas (campo 'author' ou 'name' nas mensagens)
        const userMessages = messages.filter(m => 
            m.author === userName || 
            m.name === userName || 
            m.username === userName ||
            m.sender === userName
        );
        stats.messagesSent = userMessages.length;

        // Avaliações dadas - verifica múltiplos campos
        stats.ratingsGiven = ratings.filter(r => 
            r.rater === userName || 
            r.raterName === userName ||
            r.evaluator === userName
        ).length;

        // 5 estrelas recebidas e total de avaliações recebidas
        const receivedRatings = ratings.filter(r => 
            r.maker === userName ||
            r.makerName === userName ||
            r.owner === userName
        );
        stats.totalRatingsReceived = receivedRatings.length;
        stats.fiveStarsReceived = receivedRatings.filter(r => r.rating === 5 || r.stars === 5).length;

        // Média de avaliações recebidas
        if (receivedRatings.length > 0) {
            // 🔧 CORREÇÃO: Aceitar tanto 'rating' quanto 'stars'
            const sum = receivedRatings.reduce((acc, r) => acc + (r.rating || r.stars || 0), 0);
            stats.averageRating = sum / receivedRatings.length;
        }

        // Verificar cafés em horários/dias especiais
        for (const coffee of userCoffees) {
            // 🔧 CORREÇÃO: Aceitar tanto 'date' quanto 'timestamp' ou 'createdAt'
            const dateValue = coffee.date || coffee.timestamp || coffee.createdAt;
            const date = new Date(dateValue);
            const hour = date.getHours();
            const day = date.getDay(); // 0 = Domingo, 6 = Sábado
            
            if (hour < 7) stats.earlyCoffee = true;
            if (hour >= 20) stats.lateCoffee = true;
            if (day === 0 || day === 6) stats.weekendCoffee = true;
            if (day === 1 && hour < 10) stats.mondayCoffee = true;
            if (day === 5 && hour >= 14) stats.fridayCoffee = true;
            
            // 🆕 Novas conquistas de horário
            if (hour >= 0 && hour < 5) stats.midnightCoffee = true; // Café entre 00:00 e 04:59
            if (hour < 6) stats.earlyCoffeeCount++; // Contagem de cafés antes das 6h
        }

        // Streak (dias consecutivos)
        stats.currentStreak = this.calculateStreak(userName, coffeeData.made);

        // Dias ativos (primeiro registro até hoje)
        stats.daysActive = this.calculateDaysActive(userName, coffeeData, messages);

        // Reações recebidas
        stats.reactionsReceived = this.countReactionsReceived(userName, messages);
        
        // Reações dadas
        stats.reactionsGiven = this.countReactionsGiven(userName, messages);
        
        // Emojis únicos usados
        stats.uniqueEmojis = this.countUniqueEmojis(userName, messages);
        
        // Burst de mensagens (máx mensagens em 1 minuto)
        stats.messagesBurst = this.calculateMessageBurst(userName, messages);
        
        // Verificar se fez café no mesmo dia que outro membro
        stats.coffeeSameDay = this.checkCoffeeSameDay(userName, coffeeData.made);
        
        // Triple action (café + trouxe + avaliou no mesmo dia)
        stats.tripleAction = this.checkTripleAction(userName, coffeeData, ratings);
        
        // 🆕 Contagem de makers diferentes avaliados
        stats.differentMakersRated = this.countDifferentMakersRated(userName, ratings);

        return stats;
    },

    /**
     * Calcula sequência de dias consecutivos
     * 🔧 CORREÇÃO: Agora ignora finais de semana (sábado e domingo)!
     * - Sexta -> Segunda = 1 dia consecutivo (não quebra streak)
     * - Faltou segunda = quebra streak
     */
    calculateStreak(userName, coffees) {
        // Helper: verifica se é dia útil (segunda a sexta)
        const isWeekday = (date) => {
            const day = date.getDay();
            return day !== 0 && day !== 6; // 0 = domingo, 6 = sábado
        };

        // Helper: retorna o dia útil anterior
        const getPreviousWorkday = (date) => {
            const result = new Date(date);
            result.setDate(result.getDate() - 1);
            while (!isWeekday(result)) {
                result.setDate(result.getDate() - 1);
            }
            return result;
        };

        // Helper: retorna o último dia útil
        const getLastWorkday = (date) => {
            const result = new Date(date);
            result.setHours(0, 0, 0, 0);
            while (!isWeekday(result)) {
                result.setDate(result.getDate() - 1);
            }
            return result;
        };

        // 🔧 CORREÇÃO: Helper para verificar nome
        const matchesUser = (c) => {
            const name = c.name || c.username || c.maker?.username || c.maker?.name;
            return name === userName;
        };
        
        // Filtrar cafés do usuário e apenas em dias úteis
        const userCoffees = coffees
            .filter(matchesUser)
            .map(c => {
                const date = new Date(c.date || c.timestamp || c.createdAt);
                date.setHours(0, 0, 0, 0);
                return date;
            })
            .filter(date => isWeekday(date))
            .sort((a, b) => b - a); // Mais recente primeiro

        if (userCoffees.length === 0) return 0;

        // Criar set de datas únicas de dias úteis
        const uniqueWorkdays = new Set();
        for (const date of userCoffees) {
            const dayKey = date.toISOString().split('T')[0];
            uniqueWorkdays.add(dayKey);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastWorkday = getLastWorkday(today);
        const lastWorkdayKey = lastWorkday.toISOString().split('T')[0];

        // Último café do usuário
        const lastCoffeeDate = userCoffees[0];
        const lastCoffeeKey = lastCoffeeDate.toISOString().split('T')[0];

        // Se o último café não foi no último dia útil, verificar tolerância
        if (lastCoffeeKey !== lastWorkdayKey) {
            const prevWorkday = getPreviousWorkday(lastWorkday);
            const prevWorkdayKey = prevWorkday.toISOString().split('T')[0];
            
            // Se não foi nem no dia útil anterior, verificar distância
            if (lastCoffeeKey !== prevWorkdayKey) {
                const daysDiff = Math.floor((lastWorkday - lastCoffeeDate) / (1000 * 60 * 60 * 24));
                if (daysDiff > 3) {
                    return 0; // Streak quebrada
                }
            }
        }

        // Contar dias úteis consecutivos
        let streak = 0;
        let currentDate = new Date(lastCoffeeDate);

        // Contar o primeiro dia
        if (uniqueWorkdays.has(currentDate.toISOString().split('T')[0])) {
            streak = 1;
        }

        // Contar dias anteriores
        while (true) {
            currentDate = getPreviousWorkday(currentDate);
            const dayKey = currentDate.toISOString().split('T')[0];
            
            if (uniqueWorkdays.has(dayKey)) {
                streak++;
            } else {
                break;
            }
            
            // Limite de segurança
            if (streak > 500) break;
        }

        return streak;
    },
    
    /**
     * Calcula dias desde o primeiro registro
     * 🔧 CORREÇÃO: Verifica múltiplos campos
     */
    calculateDaysActive(userName, coffeeData, messages) {
        const dates = [];
        
        // Helper para verificar nome
        const matchesUser = (item) => {
            const name = item.name || item.username || item.author || item.maker?.username;
            return name === userName;
        };
        
        // Coletar datas de cafés feitos
        coffeeData.made.filter(matchesUser).forEach(c => {
            dates.push(new Date(c.date || c.timestamp || c.createdAt));
        });
        
        // Coletar datas de mensagens
        messages.filter(matchesUser).forEach(m => {
            dates.push(new Date(m.timestamp || m.date || m.createdAt));
        });
        
        if (dates.length === 0) return 0;
        
        const firstDate = new Date(Math.min(...dates));
        const today = new Date();
        
        return Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    },
    
    /**
     * Conta reações recebidas nas mensagens do usuário
     * 🔧 CORREÇÃO: Verifica múltiplos campos
     */
    countReactionsReceived(userName, messages) {
        let count = 0;
        const matchesUser = (m) => {
            const author = m.author || m.name || m.username || m.sender;
            return author === userName;
        };
        
        messages.filter(matchesUser).forEach(m => {
            if (m.reactions) {
                // Reactions pode ser objeto ou array
                if (Array.isArray(m.reactions)) {
                    count += m.reactions.length;
                } else {
                    count += Object.keys(m.reactions).length;
                }
            }
        });
        return count;
    },
    
    /**
     * Conta reações dadas pelo usuário
     */
    countReactionsGiven(userName, messages) {
        let count = 0;
        messages.forEach(m => {
            if (m.reactions) {
                // Reactions pode ser objeto com estrutura {user: reaction} ou array
                if (Array.isArray(m.reactions)) {
                    count += m.reactions.filter(r => 
                        r.user === userName || r.username === userName
                    ).length;
                } else {
                    for (const [user, reaction] of Object.entries(m.reactions)) {
                        if (user === userName) count++;
                    }
                }
            }
        });
        return count;
    },
    
    /**
     * Conta emojis únicos usados pelo usuário
     * 🔧 CORREÇÃO: Verifica múltiplos campos
     */
    countUniqueEmojis(userName, messages) {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
        const emojis = new Set();
        
        const matchesUser = (m) => {
            const author = m.author || m.name || m.username || m.sender;
            return author === userName;
        };
        
        messages.filter(matchesUser).forEach(m => {
            const text = m.text || m.content || m.message || '';
            const matches = text.match(emojiRegex);
            if (matches) {
                matches.forEach(emoji => emojis.add(emoji));
            }
        });
        
        return emojis.size;
    },
    
    /**
     * Calcula maior burst de mensagens em 1 minuto
     * 🔧 CORREÇÃO: Verifica múltiplos campos
     */
    calculateMessageBurst(userName, messages) {
        const matchesUser = (m) => {
            const author = m.author || m.name || m.username || m.sender;
            return author === userName;
        };
        
        const userMsgs = messages
            .filter(matchesUser)
            .map(m => new Date(m.timestamp || m.date || m.createdAt).getTime())
            .sort((a, b) => a - b);
        
        let maxBurst = 0;
        
        for (let i = 0; i < userMsgs.length; i++) {
            let burst = 1;
            for (let j = i + 1; j < userMsgs.length; j++) {
                if (userMsgs[j] - userMsgs[i] <= 60000) { // 1 minuto
                    burst++;
                } else {
                    break;
                }
            }
            maxBurst = Math.max(maxBurst, burst);
        }
        
        return maxBurst;
    },
    
    /**
     * Verifica se fez café no mesmo dia que outro membro
     * 🔧 CORREÇÃO: Verifica múltiplos campos
     */
    checkCoffeeSameDay(userName, coffees) {
        const matchesUser = (c) => {
            const name = c.name || c.username || c.maker?.username || c.maker?.name;
            return name === userName;
        };
        const getName = (c) => c.name || c.username || c.maker?.username || c.maker?.name;
        const getDate = (c) => c.date || c.timestamp || c.createdAt;
        
        const userCoffees = coffees.filter(matchesUser);
        
        for (const userCoffee of userCoffees) {
            const userDate = new Date(getDate(userCoffee)).toDateString();
            const otherCoffees = coffees.filter(c => 
                getName(c) !== userName && 
                new Date(getDate(c)).toDateString() === userDate
            );
            if (otherCoffees.length > 0) return true;
        }
        
        return false;
    },
    
    /**
     * Verifica triple action (café + trouxe + avaliou no mesmo dia)
     * 🔧 CORREÇÃO: Verifica múltiplos campos
     */
    checkTripleAction(userName, coffeeData, ratings) {
        const matchesUser = (c) => {
            const name = c.name || c.username || c.maker?.username || c.maker?.name;
            return name === userName;
        };
        const getDate = (c) => c.date || c.timestamp || c.createdAt;
        
        const madeDates = coffeeData.made
            .filter(matchesUser)
            .map(c => new Date(getDate(c)).toDateString());
        
        const broughtDates = coffeeData.brought
            .filter(matchesUser)
            .map(c => new Date(getDate(c)).toDateString());
        
        const ratedDates = ratings
            .filter(r => r.rater === userName || r.raterName === userName)
            .map(r => new Date(r.date || r.timestamp || r.createdAt).toDateString());
        
        // Verificar se alguma data aparece nas 3 listas
        for (const date of madeDates) {
            if (broughtDates.includes(date) && ratedDates.includes(date)) {
                return true;
            }
        }
        
        return false;
    },
    
    /**
     * 🆕 Conta quantos makers diferentes o usuário avaliou
     */
    countDifferentMakersRated(userName, ratings) {
        const makers = new Set();
        
        ratings.forEach(r => {
            const rater = r.rater || r.raterName || r.evaluator;
            if (rater === userName) {
                const maker = r.maker || r.makerName || r.owner;
                if (maker && maker !== userName) {
                    makers.add(maker);
                }
            }
        });
        
        return makers.size;
    }
};