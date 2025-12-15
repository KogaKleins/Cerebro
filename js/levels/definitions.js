/**
 * 📊 LEVEL SYSTEM - DEFINITIONS
 * Definições de níveis, ranks e XP
 * 
 * Sistema inspirado em jogos com progressão equilibrada:
 * - XP por ações (fazer café, trazer café, chat, etc)
 * - Níveis com requisitos progressivos
 * - Ranks/Títulos que mudam conforme o nível
 * - Bônus especiais em marcos importantes
 * 
 * 🔧 NOTA: Os valores de XP são DEFAULTS - valores reais devem ser
 * carregados do servidor via Api.getXPConfig() para sincronizar com o admin.
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 CONFIGURAÇÃO DE XP POR AÇÃO
// Valores padrão (fallback se servidor não responder)
// Valores reais são carregados do servidor via loadXPConfigFromServer()
// ═══════════════════════════════════════════════════════════════

export const XP_ACTIONS = {
    // ☕ Café
    'coffee-made': {
        name: 'Fazer Café',
        xp: 50,
        icon: '☕',
        description: 'Fez um café para a equipe'
    },
    'coffee-brought': {
        name: 'Trazer Café',
        xp: 75,
        icon: '🛒',
        description: 'Trouxe café para abastecer o setor'
    },
    
    // 🍞 Itens Especiais
    'filtro-cafe': {
        name: 'Filtro de Café',
        xp: 30,
        icon: '🔽',
        description: 'Trouxe filtro de café para o setor'
    },
    'bolo': {
        name: 'Bolo',
        xp: 250,
        icon: '🎂',
        description: 'Trouxe bolo para a equipe'
    },
    'bolo-supreme': {
        name: 'Bolo Supreme',
        xp: 400,
        icon: '👑🎂',
        description: 'Trouxe bolo supreme para a equipe'
    },
    'bolacha': {
        name: 'Bolacha',
        xp: 25,
        icon: '🍪',
        description: 'Trouxe bolacha para a equipe'
    },
    'bolacha-recheada': {
        name: 'Bolacha Recheada',
        xp: 35,
        icon: '🥮',
        description: 'Trouxe bolacha recheada para a equipe'
    },
    'biscoito': {
        name: 'Biscoito',
        xp: 50,
        icon: '🥠',
        description: 'Trouxe biscoito para a equipe'
    },
    'sonho': {
        name: 'Sonho',
        xp: 75,
        icon: '🍩',
        description: 'Trouxe sonho para a equipe'
    },
    
    // ⭐ Avaliações
    'rating-given': {
        name: 'Avaliar Café',
        xp: 15,
        icon: '⭐',
        description: 'Avaliou o café de alguém'
    },
    'five-star-received': {
        name: 'Receber 5 Estrelas',
        xp: 30,
        icon: '🌟',
        description: 'Recebeu uma avaliação 5 estrelas'
    },
    
    // 💬 Chat
    'message-sent': {
        name: 'Enviar Mensagem',
        xp: 1,
        icon: '💬',
        description: 'Participou do chat'
    },
    'reaction-given': {
        name: 'Reagir Mensagem',
        xp: 3,
        icon: '👍',
        description: 'Reagiu a uma mensagem'
    },
    'reaction-received': {
        name: 'Receber Reação',
        xp: 5,
        icon: '❤️',
        description: 'Recebeu uma reação'
    },
    
    // 🏆 Conquistas (bônus quando desbloqueia)
    'achievement-common': {
        name: 'Conquista Comum',
        xp: 25,
        icon: '🎖️',
        description: 'Desbloqueou conquista comum'
    },
    'achievement-rare': {
        name: 'Conquista Rara',
        xp: 50,
        icon: '💠',
        description: 'Desbloqueou conquista rara'
    },
    'achievement-epic': {
        name: 'Conquista Épica',
        xp: 100,
        icon: '💎',
        description: 'Desbloqueou conquista épica'
    },
    'achievement-legendary': {
        name: 'Conquista Lendária',
        xp: 200,
        icon: '👑',
        description: 'Desbloqueou conquista lendária'
    },
    'achievement-platinum': {
        name: 'Conquista Platina',
        xp: 500,
        icon: '🏆',
        description: 'Desbloqueou conquista platina'
    },
    
    // ✨ Ações Especiais
    'early-coffee': {
        name: 'Café Madrugador',
        xp: 100,
        icon: '🌅',
        description: 'Fez café antes das 7h'
    },
    'late-coffee': {
        name: 'Café Coruja',
        xp: 75,
        icon: '🦉',
        description: 'Fez café após as 20h'
    },
    'weekend-coffee': {
        name: 'Café de Fim de Semana',
        xp: 150,
        icon: '🎉',
        description: 'Fez café no fim de semana'
    },
    'streak-bonus': {
        name: 'Bônus de Sequência',
        xp: 25, // Por dia de streak
        icon: '🔥',
        description: 'Bônus por manter sequência'
    },
    'daily-login': {
        name: 'Login Diário',
        xp: 10,
        icon: '📅',
        description: 'Acessou o sistema hoje'
    }
};

/**
 * Atualiza os valores de XP com configuração do servidor
 * @param {Object} xpConfig - Configuração de XP do servidor
 */
export function updateXPActionsFromConfig(xpConfig) {
    if (!xpConfig || typeof xpConfig !== 'object') return;
    
    for (const [key, value] of Object.entries(xpConfig)) {
        if (XP_ACTIONS[key] && typeof value === 'object' && typeof value.xp === 'number') {
            XP_ACTIONS[key].xp = value.xp;
            // Atualizar nome se fornecido
            if (value.name) {
                XP_ACTIONS[key].name = value.name;
            }
        }
    }
}

/**
 * Obtém o XP para uma ação (usa valor atualizado do servidor ou padrão)
 * @param {string} actionKey - Chave da ação
 * @returns {number} Valor de XP
 */
export function getXPForAction(actionKey) {
    return XP_ACTIONS[actionKey]?.xp || 0;
}

// ═══════════════════════════════════════════════════════════════
// 📈 CONFIGURAÇÃO DE NÍVEIS
// Fórmula: XP necessário = BASE * (NÍVEL ^ EXPONENT)
// ═══════════════════════════════════════════════════════════════

export const LEVEL_CONFIG = {
    baseXP: 100,           // XP base para nível 1→2
    exponent: 1.5,         // Fator de crescimento
    maxLevel: 100,         // Nível máximo
    
    // Níveis com bônus especiais (marcos)
    milestones: [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100]
};

// ═══════════════════════════════════════════════════════════════
// 🎖️ RANKS/TÍTULOS POR NÍVEL
// ═══════════════════════════════════════════════════════════════

export const RANKS = [
    // Níveis 1-5: Iniciante
    { minLevel: 1, name: 'Estagiário do Café', icon: '🆕', color: '#9ca3af', tier: 'bronze' },
    { minLevel: 2, name: 'Aprendiz', icon: '📚', color: '#9ca3af', tier: 'bronze' },
    { minLevel: 3, name: 'Curioso', icon: '🔍', color: '#9ca3af', tier: 'bronze' },
    { minLevel: 4, name: 'Novato Promissor', icon: '🌱', color: '#9ca3af', tier: 'bronze' },
    { minLevel: 5, name: 'Iniciante Graduado', icon: '🎓', color: '#cd7f32', tier: 'bronze' },
    
    // Níveis 6-10: Bronze
    { minLevel: 6, name: 'Assistente de Café', icon: '☕', color: '#cd7f32', tier: 'bronze' },
    { minLevel: 7, name: 'Auxiliar do Cérebro', icon: '🧠', color: '#cd7f32', tier: 'bronze' },
    { minLevel: 8, name: 'Colaborador', icon: '🤝', color: '#cd7f32', tier: 'bronze' },
    { minLevel: 9, name: 'Membro Ativo', icon: '⚡', color: '#cd7f32', tier: 'bronze' },
    { minLevel: 10, name: 'Bronze Completo', icon: '🥉', color: '#cd7f32', tier: 'bronze' },
    
    // Níveis 11-20: Prata
    { minLevel: 11, name: 'Cafeteiro Jr.', icon: '☕', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 12, name: 'Contribuidor', icon: '📦', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 13, name: 'Participante Assíduo', icon: '📊', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 14, name: 'Membro Dedicado', icon: '💪', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 15, name: 'Barista Júnior', icon: '👨‍🍳', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 16, name: 'Especialista', icon: '🎯', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 17, name: 'Veterano Jr.', icon: '🎖️', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 18, name: 'Cafeicultor', icon: '🌿', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 19, name: 'Conhecedor', icon: '📖', color: '#c0c0c0', tier: 'silver' },
    { minLevel: 20, name: 'Prata Completo', icon: '🥈', color: '#c0c0c0', tier: 'silver' },
    
    // Níveis 21-35: Ouro
    { minLevel: 21, name: 'Barista', icon: '☕', color: '#ffd700', tier: 'gold' },
    { minLevel: 23, name: 'Sommelier de Café', icon: '🍷', color: '#ffd700', tier: 'gold' },
    { minLevel: 25, name: 'Mestre Cafeteiro', icon: '👑', color: '#ffd700', tier: 'gold' },
    { minLevel: 27, name: 'Guru do Setor', icon: '🧘', color: '#ffd700', tier: 'gold' },
    { minLevel: 30, name: 'Veterano', icon: '🎖️', color: '#ffd700', tier: 'gold' },
    { minLevel: 33, name: 'Expert', icon: '💫', color: '#ffd700', tier: 'gold' },
    { minLevel: 35, name: 'Ouro Completo', icon: '🥇', color: '#ffd700', tier: 'gold' },
    
    // Níveis 36-50: Platina
    { minLevel: 36, name: 'Elite do Café', icon: '💎', color: '#e5e4e2', tier: 'platinum' },
    { minLevel: 38, name: 'Prodígio', icon: '✨', color: '#e5e4e2', tier: 'platinum' },
    { minLevel: 40, name: 'Sábio do Cérebro', icon: '🦉', color: '#e5e4e2', tier: 'platinum' },
    { minLevel: 43, name: 'Guardião', icon: '🛡️', color: '#e5e4e2', tier: 'platinum' },
    { minLevel: 46, name: 'Mentor', icon: '🎓', color: '#e5e4e2', tier: 'platinum' },
    { minLevel: 50, name: 'Platina Completo', icon: '💠', color: '#e5e4e2', tier: 'platinum' },
    
    // Níveis 51-75: Diamante
    { minLevel: 51, name: 'Lenda Viva', icon: '🌟', color: '#b9f2ff', tier: 'diamond' },
    { minLevel: 55, name: 'Fenômeno', icon: '⚡', color: '#b9f2ff', tier: 'diamond' },
    { minLevel: 60, name: 'Ícone do Café', icon: '🏆', color: '#b9f2ff', tier: 'diamond' },
    { minLevel: 65, name: 'Supremo', icon: '👑', color: '#b9f2ff', tier: 'diamond' },
    { minLevel: 70, name: 'Iluminado', icon: '💡', color: '#b9f2ff', tier: 'diamond' },
    { minLevel: 75, name: 'Diamante Completo', icon: '💎', color: '#b9f2ff', tier: 'diamond' },
    
    // Níveis 76-99: Mestre
    { minLevel: 76, name: 'Grão-Mestre', icon: '🎭', color: '#ff6b6b', tier: 'master' },
    { minLevel: 80, name: 'Arquiteto do Café', icon: '🏛️', color: '#ff6b6b', tier: 'master' },
    { minLevel: 85, name: 'Oráculo', icon: '🔮', color: '#ff6b6b', tier: 'master' },
    { minLevel: 90, name: 'Transcendente', icon: '🌌', color: '#ff6b6b', tier: 'master' },
    { minLevel: 95, name: 'Imortal do Café', icon: '⭐', color: '#ff6b6b', tier: 'master' },
    { minLevel: 99, name: 'Pré-Divino', icon: '🌠', color: '#ff6b6b', tier: 'master' },
    
    // Nível 100: Máximo
    { minLevel: 100, name: 'Deus do Café', icon: '☀️', color: '#ffd700', tier: 'divine', special: true }
];

// ═══════════════════════════════════════════════════════════════
// 🎨 CONFIGURAÇÃO DE TIERS (para estilos visuais)
// ═══════════════════════════════════════════════════════════════

export const TIER_CONFIG = {
    bronze: {
        name: 'Bronze',
        color: '#cd7f32',
        gradient: 'linear-gradient(135deg, #8B4513 0%, #cd7f32 50%, #D4A574 100%)',
        glow: '0 0 10px rgba(205, 127, 50, 0.5)',
        border: '#8B4513'
    },
    silver: {
        name: 'Prata',
        color: '#c0c0c0',
        gradient: 'linear-gradient(135deg, #808080 0%, #c0c0c0 50%, #e8e8e8 100%)',
        glow: '0 0 12px rgba(192, 192, 192, 0.5)',
        border: '#808080'
    },
    gold: {
        name: 'Ouro',
        color: '#ffd700',
        gradient: 'linear-gradient(135deg, #b8860b 0%, #ffd700 50%, #ffec8b 100%)',
        glow: '0 0 15px rgba(255, 215, 0, 0.6)',
        border: '#b8860b'
    },
    platinum: {
        name: 'Platina',
        color: '#e5e4e2',
        gradient: 'linear-gradient(135deg, #9ca3af 0%, #e5e4e2 50%, #f3f4f6 100%)',
        glow: '0 0 18px rgba(229, 228, 226, 0.6)',
        border: '#9ca3af'
    },
    diamond: {
        name: 'Diamante',
        color: '#b9f2ff',
        gradient: 'linear-gradient(135deg, #00bfff 0%, #b9f2ff 50%, #e0ffff 100%)',
        glow: '0 0 20px rgba(185, 242, 255, 0.7)',
        border: '#00bfff'
    },
    master: {
        name: 'Mestre',
        color: '#ff6b6b',
        gradient: 'linear-gradient(135deg, #dc143c 0%, #ff6b6b 50%, #ffa07a 100%)',
        glow: '0 0 25px rgba(255, 107, 107, 0.7)',
        border: '#dc143c'
    },
    divine: {
        name: 'Divino',
        color: '#ffd700',
        gradient: 'linear-gradient(135deg, #ff4500 0%, #ffd700 25%, #ffffff 50%, #ffd700 75%, #ff4500 100%)',
        glow: '0 0 30px rgba(255, 215, 0, 0.8), 0 0 60px rgba(255, 69, 0, 0.5)',
        border: '#ff4500',
        animated: true
    }
};

// ═══════════════════════════════════════════════════════════════
// 🎁 RECOMPENSAS DE MILESTONE
// ═══════════════════════════════════════════════════════════════

export const MILESTONE_REWARDS = {
    5: { title: 'Primeiro Marco!', bonus: 100, badge: '🎯' },
    10: { title: 'Double Digits!', bonus: 200, badge: '🔟' },
    15: { title: 'Quinze de Glória!', bonus: 300, badge: '⭐' },
    20: { title: 'Vinte e Brilhante!', bonus: 500, badge: '✨' },
    25: { title: 'Quarto de Século!', bonus: 750, badge: '💫' },
    30: { title: 'Três Dezenas!', bonus: 1000, badge: '🏅' },
    40: { title: 'Quarentão do Café!', bonus: 1500, badge: '🎖️' },
    50: { title: 'Meio Centenário!', bonus: 2500, badge: '🏆' },
    60: { title: 'Sessenta Anos Café!', bonus: 3000, badge: '👑' },
    75: { title: 'Diamante Puro!', bonus: 5000, badge: '💎' },
    100: { title: 'NÍVEL MÁXIMO!', bonus: 10000, badge: '☀️' }
};

// ═══════════════════════════════════════════════════════════════
// 🔧 FUNÇÕES UTILITÁRIAS
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula XP necessário para um nível específico
 */
export function getXPForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(LEVEL_CONFIG.baseXP * Math.pow(level - 1, LEVEL_CONFIG.exponent));
}

/**
 * Calcula XP total necessário para alcançar um nível
 */
export function getTotalXPForLevel(level) {
    let total = 0;
    for (let i = 2; i <= level; i++) {
        total += getXPForLevel(i);
    }
    return total;
}

/**
 * Obtém o rank para um nível
 */
export function getRankForLevel(level) {
    // Percorre do maior para o menor para pegar o rank correto
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (level >= RANKS[i].minLevel) {
            return RANKS[i];
        }
    }
    return RANKS[0];
}

/**
 * Obtém configuração do tier
 */
export function getTierConfig(tier) {
    return TIER_CONFIG[tier] || TIER_CONFIG.bronze;
}

/**
 * Verifica se é um nível de milestone
 */
export function isMilestone(level) {
    return LEVEL_CONFIG.milestones.includes(level);
}

/**
 * Obtém recompensa de milestone
 */
export function getMilestoneReward(level) {
    return MILESTONE_REWARDS[level] || null;
}

/**
 * Obtém XP de uma ação
 */
export function getActionXP(actionType) {
    return XP_ACTIONS[actionType] || null;
}
