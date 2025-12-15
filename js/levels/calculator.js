/**
 * 🧮 LEVEL CALCULATOR
 * Cálculos de XP, níveis e progressão
 */

import { 
    XP_ACTIONS,
    LEVEL_CONFIG,
    getXPForLevel,
    getTotalXPForLevel,
    getRankForLevel,
    isMilestone,
    getMilestoneReward
} from './definitions.js';
import { Logger } from '../logger.js';

export const LevelCalculator = {
    /**
     * Calcula nível baseado no XP total
     */
    calculateLevel(totalXP) {
        let level = 1;
        let xpNeeded = 0;
        
        while (level < LEVEL_CONFIG.maxLevel) {
            const nextLevelXP = getXPForLevel(level + 1);
            if (totalXP < xpNeeded + nextLevelXP) {
                break;
            }
            xpNeeded += nextLevelXP;
            level++;
        }
        
        return level;
    },

    /**
     * Calcula XP atual dentro do nível (progresso)
     */
    calculateCurrentLevelXP(totalXP, level) {
        const xpForPreviousLevels = getTotalXPForLevel(level);
        return totalXP - xpForPreviousLevels;
    },

    /**
     * Calcula progresso percentual para o próximo nível
     */
    calculateProgress(totalXP, level) {
        if (level >= LEVEL_CONFIG.maxLevel) {
            return 100; // Nível máximo = 100%
        }
        
        const currentLevelXP = this.calculateCurrentLevelXP(totalXP, level);
        const xpNeededForNextLevel = getXPForLevel(level + 1);
        
        return Math.min(100, (currentLevelXP / xpNeededForNextLevel) * 100);
    },

    /**
     * Adiciona XP e calcula level up
     */
    addXP(userData, xpAmount, reason = 'unknown') {
        const previousLevel = userData.level;
        const previousXP = userData.totalXP;
        
        // Adicionar XP
        userData.totalXP += xpAmount;
        userData.xp = this.calculateCurrentLevelXP(userData.totalXP, userData.level);
        
        // Recalcular nível
        const newLevel = this.calculateLevel(userData.totalXP);
        
        // Verificar level ups
        const levelUps = [];
        if (newLevel > previousLevel) {
            for (let lvl = previousLevel + 1; lvl <= newLevel; lvl++) {
                const rank = getRankForLevel(lvl);
                const milestone = isMilestone(lvl) ? getMilestoneReward(lvl) : null;
                
                levelUps.push({
                    level: lvl,
                    rank: rank,
                    milestone: milestone
                });
                
                // Se é milestone, adicionar bônus
                if (milestone) {
                    userData.totalXP += milestone.bonus;
                    Logger.info(`🎁 Bônus de milestone nível ${lvl}: +${milestone.bonus} XP`);
                }
            }
            
            userData.level = newLevel;
            userData.xp = this.calculateCurrentLevelXP(userData.totalXP, newLevel);
        }
        
        // 🔒 CORREÇÃO: Garantir que history é um array antes de fazer push
        if (!Array.isArray(userData.history)) {
            userData.history = [];
        }
        
        // Registrar no histórico
        userData.history.push({
            timestamp: new Date().toISOString(),
            xp: xpAmount,
            reason: reason,
            previousXP: previousXP,
            newXP: userData.totalXP,
            levelUp: levelUps.length > 0
        });
        
        // Limitar histórico a últimos 100 registros
        if (userData.history.length > 100) {
            userData.history = userData.history.slice(-100);
        }
        
        userData.updatedAt = new Date().toISOString();
        
        return {
            xpGained: xpAmount,
            totalXP: userData.totalXP,
            level: userData.level,
            progress: this.calculateProgress(userData.totalXP, userData.level),
            levelUps: levelUps
        };
    },

    /**
     * Calcula XP retroativo baseado em dados históricos
     * @param {string} userName - Nome do usuário
     * @param {Object} coffeeData - Dados de café
     * @param {Array} messages - Mensagens do chat
     * @param {Array} ratings - Avaliações
     * @param {Object} customConfig - Configuração customizada de XP (opcional)
     */
    calculateRetroactiveXP(userName, coffeeData, messages, ratings, customConfig = null) {
        let totalXP = 0;
        const breakdown = {};
        
        // Usar config customizada ou padrão
        const getXP = (actionKey) => {
            if (customConfig && customConfig[actionKey]) {
                return customConfig[actionKey].xp;
            }
            return XP_ACTIONS[actionKey]?.xp || 0;
        };
        
        // XP por cafés feitos
        const coffeesMade = coffeeData.made.filter(c => c.name === userName);
        breakdown.coffeesMade = coffeesMade.length * getXP('coffee-made');
        totalXP += breakdown.coffeesMade;
        
        // Verificar cafés especiais
        for (const coffee of coffeesMade) {
            const date = new Date(coffee.date);
            const hour = date.getHours();
            const day = date.getDay();
            
            if (hour < 7) {
                breakdown.earlyCoffee = (breakdown.earlyCoffee || 0) + getXP('early-coffee');
                totalXP += getXP('early-coffee');
            }
            if (hour >= 20) {
                breakdown.lateCoffee = (breakdown.lateCoffee || 0) + getXP('late-coffee');
                totalXP += getXP('late-coffee');
            }
            if (day === 0 || day === 6) {
                breakdown.weekendCoffee = (breakdown.weekendCoffee || 0) + getXP('weekend-coffee');
                totalXP += getXP('weekend-coffee');
            }
        }
        
        // XP por cafés trazidos
        const coffeesBrought = coffeeData.brought.filter(c => c.name === userName);
        breakdown.coffeesBrought = coffeesBrought.length * getXP('coffee-brought');
        totalXP += breakdown.coffeesBrought;
        
        // XP por mensagens
        const userMessages = messages.filter(m => m.author === userName || m.name === userName);
        breakdown.messages = userMessages.length * getXP('message-sent');
        totalXP += breakdown.messages;
        
        // XP por avaliações dadas
        const ratingsGiven = ratings.filter(r => r.rater === userName);
        breakdown.ratingsGiven = ratingsGiven.length * getXP('rating-given');
        totalXP += breakdown.ratingsGiven;
        
        // XP por 5 estrelas recebidas
        const fiveStarsReceived = ratings.filter(r => r.maker === userName && r.rating === 5);
        breakdown.fiveStarsReceived = fiveStarsReceived.length * getXP('five-star-received');
        totalXP += breakdown.fiveStarsReceived;
        
        // XP por reações recebidas
        let reactionsReceived = 0;
        for (const msg of messages) {
            if ((msg.author === userName || msg.name === userName) && msg.reactions) {
                for (const reaction of Object.values(msg.reactions)) {
                    reactionsReceived += reaction.count || (Array.isArray(reaction.users) ? reaction.users.length : 0);
                }
            }
        }
        breakdown.reactionsReceived = reactionsReceived * getXP('reaction-received');
        totalXP += breakdown.reactionsReceived;
        
        // XP por reações dadas
        let reactionsGiven = 0;
        for (const msg of messages) {
            if (msg.reactions) {
                for (const reaction of Object.values(msg.reactions)) {
                    if (Array.isArray(reaction.users) && reaction.users.includes(userName)) {
                        reactionsGiven++;
                    }
                }
            }
        }
        breakdown.reactionsGiven = reactionsGiven * getXP('reaction-given');
        totalXP += breakdown.reactionsGiven;
        
        return { totalXP, breakdown };
    },

    /**
     * Gera estatísticas completas do usuário
     */
    generateStats(userData) {
        const level = userData.level;
        const rank = getRankForLevel(level);
        const xpForNextLevel = level >= LEVEL_CONFIG.maxLevel ? 0 : getXPForLevel(level + 1);
        const currentLevelXP = this.calculateCurrentLevelXP(userData.totalXP, level);
        const progress = this.calculateProgress(userData.totalXP, level);
        
        // Próximo milestone
        let nextMilestone = null;
        for (const milestone of LEVEL_CONFIG.milestones) {
            if (milestone > level) {
                nextMilestone = {
                    level: milestone,
                    ...getMilestoneReward(milestone)
                };
                break;
            }
        }
        
        return {
            level,
            rank,
            totalXP: userData.totalXP,
            currentLevelXP,
            xpForNextLevel,
            progress,
            nextMilestone,
            isMaxLevel: level >= LEVEL_CONFIG.maxLevel,
            streak: userData.streak || 0,
            bestStreak: userData.bestStreak || 0,
            memberSince: userData.createdAt
        };
    },

    /**
     * Calcula streak diário
     */
    calculateDailyStreak(userData) {
        const today = new Date().toDateString();
        const lastDaily = userData.lastDaily ? new Date(userData.lastDaily).toDateString() : null;
        
        if (lastDaily === today) {
            // Já fez login hoje
            return { 
                streak: userData.streak, 
                isNew: false, 
                xpGained: 0 
            };
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        
        let newStreak = userData.streak || 0;
        let xpGained = XP_ACTIONS['daily-login'].xp;
        
        if (lastDaily === yesterdayStr) {
            // Manteve a sequência
            newStreak++;
            // Bônus por streak
            xpGained += Math.min(newStreak * XP_ACTIONS['streak-bonus'].xp, 250); // Cap em 250
        } else if (lastDaily) {
            // Perdeu a sequência
            newStreak = 1;
        } else {
            // Primeiro login
            newStreak = 1;
        }
        
        // Atualizar best streak
        if (newStreak > (userData.bestStreak || 0)) {
            userData.bestStreak = newStreak;
        }
        
        userData.streak = newStreak;
        userData.lastDaily = new Date().toISOString();
        
        return {
            streak: newStreak,
            isNew: true,
            xpGained: xpGained
        };
    }
};
