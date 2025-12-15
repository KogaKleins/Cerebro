/**
 * 🏆 ACHIEVEMENT DEFINITIONS
 * Todas as definições de conquistas do sistema
 * 
 * Raridades:
 * - common: Conquistas comuns (bordas cinzas)
 * - rare: Conquistas raras (bordas azuis)
 * - epic: Conquistas épicas (bordas roxas)
 * - legendary: Conquistas lendárias (bordas douradas com brilho)
 * - platinum: Conquistas platina (bordas platinadas com efeito especial)
 * 
 * 🔧 NOTA: Os pontos de XP são valores padrão. Os valores reais devem ser
 * carregados do servidor via Api.getXPConfig() para sincronizar com o admin.
 */

// ═══════════════════════════════════════════════════════════════
// 🎨 CONFIGURAÇÃO VISUAL DE RARIDADES
// Valores de XP são DEFAULTS - valores reais vêm do servidor
// ═══════════════════════════════════════════════════════════════

// Valores padrão (fallback se servidor não responder)
const DEFAULT_RARITY_POINTS = {
    common: 25,
    rare: 50,
    epic: 100,
    legendary: 200,
    platinum: 500
};

// Configuração visual (não muda com servidor)
export const RARITY_CONFIG = {
    common: {
        name: 'Comum',
        color: '#9ca3af',
        gradient: 'linear-gradient(135deg, #6b7280 0%, #9ca3af 100%)',
        glow: 'none',
        points: DEFAULT_RARITY_POINTS.common
    },
    rare: {
        name: 'Raro',
        color: '#3b82f6',
        gradient: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
        glow: '0 0 15px rgba(59, 130, 246, 0.5)',
        points: DEFAULT_RARITY_POINTS.rare
    },
    epic: {
        name: 'Épico',
        color: '#8b5cf6',
        gradient: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
        glow: '0 0 20px rgba(139, 92, 246, 0.6)',
        points: DEFAULT_RARITY_POINTS.epic
    },
    legendary: {
        name: 'Lendário',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #d97706 0%, #fbbf24 50%, #f59e0b 100%)',
        glow: '0 0 25px rgba(245, 158, 11, 0.7)',
        points: DEFAULT_RARITY_POINTS.legendary
    },
    platinum: {
        name: 'Platina',
        color: '#e5e7eb',
        gradient: 'linear-gradient(135deg, #9ca3af 0%, #e5e7eb 25%, #d1d5db 50%, #f3f4f6 75%, #9ca3af 100%)',
        glow: '0 0 30px rgba(229, 231, 235, 0.8), 0 0 60px rgba(156, 163, 175, 0.4)',
        points: DEFAULT_RARITY_POINTS.platinum
    }
};

/**
 * Atualiza os pontos de raridade com valores do servidor
 * @param {Object} xpConfig - Configuração de XP do servidor
 */
export function updateRarityPointsFromConfig(xpConfig) {
    if (!xpConfig) return;
    
    const rarityMapping = {
        'achievement-common': 'common',
        'achievement-rare': 'rare',
        'achievement-epic': 'epic',
        'achievement-legendary': 'legendary',
        'achievement-platinum': 'platinum'
    };
    
    for (const [configKey, rarity] of Object.entries(rarityMapping)) {
        if (xpConfig[configKey] && typeof xpConfig[configKey].xp === 'number') {
            RARITY_CONFIG[rarity].points = xpConfig[configKey].xp;
        }
    }
}

/**
 * Obtém os pontos de XP para uma raridade
 * @param {string} rarity - Nome da raridade
 * @returns {number} Pontos de XP
 */
export function getPointsForRarity(rarity) {
    return RARITY_CONFIG[rarity]?.points || DEFAULT_RARITY_POINTS.common;
}

export const achievementDefinitions = {
    // ═══════════════════════════════════════════════════════════════
    // ☕ COFFEE MAKING ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'first-coffee': {
        id: 'first-coffee',
        name: 'Primeiro Café',
        description: 'Fez seu primeiro café',
        icon: '☕',
        category: 'coffee',
        requirement: 1,
        type: 'coffee-made',
        rarity: 'common'
    },
    'coffee-lover': {
        id: 'coffee-lover',
        name: 'Amante do Café',
        description: 'Fez 10 cafés',
        icon: '❤️',
        category: 'coffee',
        requirement: 10,
        type: 'coffee-made',
        rarity: 'common'
    },
    'barista-junior': {
        id: 'barista-junior',
        name: 'Barista Jr.',
        description: 'Fez 25 cafés',
        icon: '👨‍🍳',
        category: 'coffee',
        requirement: 25,
        type: 'coffee-made',
        rarity: 'rare'
    },
    'barista-senior': {
        id: 'barista-senior',
        name: 'Barista Sênior',
        description: 'Fez 50 cafés',
        icon: '🎖️',
        category: 'coffee',
        requirement: 50,
        type: 'coffee-made',
        rarity: 'epic'
    },
    'coffee-master': {
        id: 'coffee-master',
        name: 'Mestre do Café',
        description: 'Fez 100 cafés',
        icon: '👑',
        category: 'coffee',
        requirement: 100,
        type: 'coffee-made',
        rarity: 'legendary'
    },
    'coffee-legend': {
        id: 'coffee-legend',
        name: 'Lenda do Café',
        description: 'Fez 250 cafés - Um verdadeiro mito',
        icon: '🏆',
        category: 'coffee',
        requirement: 250,
        type: 'coffee-made',
        rarity: 'platinum'
    },
    'coffee-god': {
        id: 'coffee-god',
        name: 'Deus do Café',
        description: 'Fez 500 cafés - Transcendeu a humanidade',
        icon: '⚡',
        category: 'coffee',
        requirement: 500,
        type: 'coffee-made',
        rarity: 'platinum'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // 🛒 COFFEE BRINGING ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'first-supply': {
        id: 'first-supply',
        name: 'Primeiro Suprimento',
        description: 'Trouxe café pela primeira vez',
        icon: '🛒',
        category: 'supply',
        requirement: 1,
        type: 'coffee-brought',
        rarity: 'common'
    },
    'supplier': {
        id: 'supplier',
        name: 'Fornecedor',
        description: 'Trouxe café 5 vezes',
        icon: '📦',
        category: 'supply',
        requirement: 5,
        type: 'coffee-brought',
        rarity: 'common'
    },
    'generous': {
        id: 'generous',
        name: 'Generoso',
        description: 'Trouxe café 15 vezes',
        icon: '🎁',
        category: 'supply',
        requirement: 15,
        type: 'coffee-brought',
        rarity: 'rare'
    },
    'benefactor': {
        id: 'benefactor',
        name: 'Benfeitor',
        description: 'Trouxe café 30 vezes',
        icon: '🤝',
        category: 'supply',
        requirement: 30,
        type: 'coffee-brought',
        rarity: 'epic'
    },
    'philanthropist': {
        id: 'philanthropist',
        name: 'Filantropo do Café',
        description: 'Trouxe café 50 vezes - Coração de ouro',
        icon: '💝',
        category: 'supply',
        requirement: 50,
        type: 'coffee-brought',
        rarity: 'legendary'
    },
    'supply-king': {
        id: 'supply-king',
        name: 'Rei dos Suprimentos',
        description: 'Trouxe café 100 vezes - O escritório depende de você',
        icon: '👑',
        category: 'supply',
        requirement: 100,
        type: 'coffee-brought',
        rarity: 'platinum'
    },
    'supply-legend': {
        id: 'supply-legend',
        name: 'Lenda do Abastecimento',
        description: 'Trouxe café 200 vezes - Eterno benfeitor',
        tooltip: '📦 Seja o herói que mantém o escritório abastecido! Traga café 200 vezes para se tornar uma lenda.',
        icon: '🏰',
        category: 'supply',
        requirement: 200,
        type: 'coffee-brought',
        rarity: 'platinum'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // ⭐ RATING ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'first-rate': {
        id: 'first-rate',
        name: 'Crítico',
        description: 'Avaliou seu primeiro café',
        icon: '⭐',
        category: 'rating',
        requirement: 1,
        type: 'ratings-given',
        rarity: 'common'
    },
    'taste-expert': {
        id: 'taste-expert',
        name: 'Especialista',
        description: 'Avaliou 20 cafés',
        icon: '🏅',
        category: 'rating',
        requirement: 20,
        type: 'ratings-given',
        rarity: 'rare'
    },
    'sommelier': {
        id: 'sommelier',
        name: 'Sommelier de Café',
        description: 'Avaliou 50 cafés com precisão',
        icon: '🍷',
        category: 'rating',
        requirement: 50,
        type: 'ratings-given',
        rarity: 'epic'
    },
    'five-stars': {
        id: 'five-stars',
        name: '5 Estrelas',
        description: 'Recebeu uma avaliação 5 estrelas',
        icon: '🌟',
        category: 'rating',
        requirement: 1,
        type: 'five-star-received',
        rarity: 'common'
    },
    'five-stars-master': {
        id: 'five-stars-master',
        name: 'Colecionador de Estrelas',
        description: 'Recebeu 10 avaliações 5 estrelas',
        icon: '✨',
        category: 'rating',
        requirement: 10,
        type: 'five-star-received',
        rarity: 'epic'
    },
    'five-stars-legend': {
        id: 'five-stars-legend',
        name: 'Constelação',
        description: 'Recebeu 25 avaliações 5 estrelas',
        icon: '🌌',
        category: 'rating',
        requirement: 25,
        type: 'five-star-received',
        rarity: 'legendary'
    },
    'top-rated': {
        id: 'top-rated',
        name: 'Mais Bem Avaliado',
        description: 'Média de avaliação acima de 4.5',
        icon: '💎',
        category: 'rating',
        requirement: 4.5,
        type: 'average-rating',
        rarity: 'epic'
    },
    'perfect-score': {
        id: 'perfect-score',
        name: 'Perfeição',
        description: 'Mantém média 5.0 com pelo menos 10 avaliações',
        icon: '💯',
        category: 'rating',
        requirement: 5.0,
        type: 'perfect-average',
        rarity: 'platinum'
    },
    'galaxy-of-stars': {
        id: 'galaxy-of-stars',
        name: 'Galáxia de Estrelas',
        description: 'Recebeu 50 avaliações 5 estrelas - Uma verdadeira Via Láctea!',
        tooltip: '🌌 O universo se curva diante da sua qualidade! Receba 50 avaliações 5 estrelas.',
        icon: '🌠',
        category: 'rating',
        requirement: 50,
        type: 'five-star-received',
        rarity: 'platinum'
    },
    'critic-master': {
        id: 'critic-master',
        name: 'Mestre Crítico',
        description: 'Avaliou 100 cafés - Paladar refinadíssimo',
        tooltip: '🎭 Seu paladar é lendário! Avalie 100 cafés para provar seu conhecimento.',
        icon: '🎭',
        category: 'rating',
        requirement: 100,
        type: 'ratings-given',
        rarity: 'legendary'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // 💬 CHAT ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'first-message': {
        id: 'first-message',
        name: 'Primeiro Contato',
        description: 'Enviou sua primeira mensagem',
        icon: '💬',
        category: 'chat',
        requirement: 1,
        type: 'messages-sent',
        rarity: 'common'
    },
    'chatterbox': {
        id: 'chatterbox',
        name: 'Tagarela',
        description: 'Enviou 50 mensagens',
        icon: '🗣️',
        category: 'chat',
        requirement: 50,
        type: 'messages-sent',
        rarity: 'common'
    },
    'social-butterfly': {
        id: 'social-butterfly',
        name: 'Sociável',
        description: 'Enviou 200 mensagens',
        icon: '🦋',
        category: 'chat',
        requirement: 200,
        type: 'messages-sent',
        rarity: 'rare'
    },
    'communicator': {
        id: 'communicator',
        name: 'Comunicador',
        description: 'Enviou 500 mensagens',
        icon: '📢',
        category: 'chat',
        requirement: 500,
        type: 'messages-sent',
        rarity: 'epic'
    },
    'influencer': {
        id: 'influencer',
        name: 'Influenciador',
        description: 'Enviou 1000 mensagens - Voz ativa no grupo',
        icon: '📣',
        category: 'chat',
        requirement: 1000,
        type: 'messages-sent',
        rarity: 'legendary'
    },
    'viral': {
        id: 'viral',
        name: 'Viral',
        description: 'Recebeu 50 reações em suas mensagens',
        icon: '🔥',
        category: 'chat',
        requirement: 50,
        type: 'reactions-received',
        rarity: 'epic'
    },
    'popular': {
        id: 'popular',
        name: 'Popular',
        description: 'Recebeu 200 reações em suas mensagens',
        icon: '⭐',
        category: 'chat',
        requirement: 200,
        type: 'reactions-received',
        rarity: 'legendary'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // ✨ SPECIAL & TIME-BASED ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'early-bird': {
        id: 'early-bird',
        name: 'Madrugador',
        description: 'Fez café antes das 7h da manhã',
        tooltip: '☀️ Registre um café entre 00:00 e 06:59 para desbloquear esta conquista!',
        icon: '🌅',
        category: 'special',
        requirement: 1,
        type: 'early-coffee',
        rarity: 'rare'
    },
    'night-owl': {
        id: 'night-owl',
        name: 'Coruja',
        description: 'Fez café após as 20h da noite',
        tooltip: '🌙 Registre um café a partir das 20:00 para desbloquear esta conquista!',
        icon: '🦉',
        category: 'special',
        requirement: 1,
        type: 'late-coffee',
        rarity: 'rare'
    },
    'weekend-warrior': {
        id: 'weekend-warrior',
        name: 'Guerreiro de Fim de Semana',
        description: 'Fez café no sábado ou domingo',
        tooltip: '🗓️ Registre um café no sábado ou domingo para desbloquear esta conquista!',
        icon: '🎉',
        category: 'special',
        requirement: 1,
        type: 'weekend-coffee',
        rarity: 'rare'
    },
    'monday-hero': {
        id: 'monday-hero',
        name: 'Herói da Segunda',
        description: 'Fez café na segunda-feira antes das 10h',
        tooltip: '📅 Registre um café na segunda-feira entre 00:00 e 09:59 para desbloquear!',
        icon: '💪',
        category: 'special',
        requirement: 1,
        type: 'monday-coffee',
        rarity: 'rare'
    },
    'friday-finisher': {
        id: 'friday-finisher',
        name: 'Finalizador da Sexta',
        description: 'Fez café na sexta-feira após as 14h',
        tooltip: '🎉 Registre um café na sexta-feira a partir das 14:00 para desbloquear! Finalize a semana com estilo!',
        icon: '🎊',
        category: 'special',
        requirement: 1,
        type: 'friday-coffee',
        rarity: 'rare'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // 🔥 STREAK ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'streak-3': {
        id: 'streak-3',
        name: 'Consistente',
        description: 'Fez café 3 dias seguidos',
        icon: '🔥',
        category: 'streak',
        requirement: 3,
        type: 'streak',
        rarity: 'common'
    },
    'streak-7': {
        id: 'streak-7',
        name: 'Dedicado',
        description: 'Fez café 7 dias seguidos',
        icon: '💪',
        category: 'streak',
        requirement: 7,
        type: 'streak',
        rarity: 'rare'
    },
    'streak-14': {
        id: 'streak-14',
        name: 'Duas Semanas',
        description: 'Fez café 14 dias seguidos',
        icon: '⚡',
        category: 'streak',
        requirement: 14,
        type: 'streak',
        rarity: 'epic'
    },
    'streak-30': {
        id: 'streak-30',
        name: 'Imbatível',
        description: 'Fez café 30 dias seguidos - Um mês inteiro!',
        icon: '🏅',
        category: 'streak',
        requirement: 30,
        type: 'streak',
        rarity: 'legendary'
    },
    'streak-60': {
        id: 'streak-60',
        name: 'Máquina de Café',
        description: 'Fez café 60 dias seguidos - Lenda viva',
        icon: '🤖',
        category: 'streak',
        requirement: 60,
        type: 'streak',
        rarity: 'platinum'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // 🏆 MILESTONE & PLATINUM ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    'veteran': {
        id: 'veteran',
        name: 'Veterano',
        description: 'Está no sistema há mais de 30 dias',
        icon: '🎖️',
        category: 'milestone',
        requirement: 30,
        type: 'days-active',
        rarity: 'rare'
    },
    'ancient': {
        id: 'ancient',
        name: 'Ancião',
        description: 'Está no sistema há mais de 90 dias',
        icon: '📜',
        category: 'milestone',
        requirement: 90,
        type: 'days-active',
        rarity: 'epic'
    },
    'founding-member': {
        id: 'founding-member',
        name: 'Membro Fundador',
        description: 'Está no sistema há mais de 180 dias',
        icon: '🏛️',
        category: 'milestone',
        requirement: 180,
        type: 'days-active',
        rarity: 'legendary'
    },
    'all-rounder': {
        id: 'all-rounder',
        name: 'Completo',
        description: 'Desbloqueou conquistas de todas as categorias',
        icon: '🎯',
        category: 'milestone',
        requirement: 1,
        type: 'all-categories',
        rarity: 'epic'
    },
    'perfectionist': {
        id: 'perfectionist',
        name: 'Perfeccionista',
        description: 'Desbloqueou 75% de todas as conquistas',
        icon: '🎭',
        category: 'milestone',
        requirement: 0.75,
        type: 'achievement-percentage',
        rarity: 'legendary'
    },
    'completionist': {
        id: 'completionist',
        name: 'Completista',
        description: 'Desbloqueou TODAS as conquistas - O máximo!',
        icon: '🌟',
        category: 'milestone',
        requirement: 1.0,
        type: 'achievement-percentage',
        rarity: 'platinum'
    },
    
    // ═══════════════════════════════════════════════════════════════
    // 🎮 FUN & SECRET ACHIEVEMENTS
    // ═══════════════════════════════════════════════════════════════
    // 🔧 NOTA: Conquistas de emojis baseadas em QUANTIDADE de reações, não variedade
    // (Sistema só tem 8 emojis de reação - variedade é muito fácil)
    'reactor': {
        id: 'reactor',
        name: 'Reator Nuclear',
        description: 'Reagiu a 100 mensagens',
        icon: '⚛️',
        category: 'fun',
        requirement: 100,
        type: 'reactions-given',
        rarity: 'rare'
    },
    'reaction-god': {
        id: 'reaction-god',
        name: 'Deus das Reações',
        description: 'Reagiu a 500 mensagens - O engajamento personificado!',
        tooltip: '⚡ Mostre seu apreço reagindo a 500 mensagens no chat!',
        icon: '💥',
        category: 'fun',
        requirement: 500,
        type: 'reactions-given',
        rarity: 'legendary'
    },
    'speed-typer': {
        id: 'speed-typer',
        name: 'Digitador Veloz',
        description: 'Enviou 5 mensagens em 1 minuto',
        icon: '⌨️',
        category: 'fun',
        requirement: 5,
        type: 'messages-per-minute',
        rarity: 'rare',
        secret: true
    },
    'coffee-duo': {
        id: 'coffee-duo',
        name: 'Dupla do Café',
        description: 'Fez café junto com outro membro no mesmo dia',
        icon: '👯',
        category: 'fun',
        requirement: 1,
        type: 'coffee-same-day',
        rarity: 'rare',
        secret: true
    },
    'triple-threat': {
        id: 'triple-threat',
        name: 'Ameaça Tripla',
        description: 'Fez café, trouxe café e avaliou no mesmo dia',
        icon: '🎲',
        category: 'fun',
        requirement: 1,
        type: 'triple-action',
        rarity: 'legendary',
        secret: true
    },
    
    // ═══════════════════════════════════════════════════════════════
    // 🔮 NOVAS CONQUISTAS SECRETAS E ULTRA DIFÍCEIS
    // ═══════════════════════════════════════════════════════════════
    'night-shift': {
        id: 'night-shift',
        name: 'Turno da Noite',
        description: 'Fez café após meia-noite - Comprometimento extremo!',
        icon: '🌙',
        category: 'special',
        requirement: 1,
        type: 'midnight-coffee',
        rarity: 'epic',
        secret: true
    },
    'early-legend': {
        id: 'early-legend',
        name: 'Lenda Matinal',
        description: 'Fez café antes das 6h por 5 dias diferentes',
        tooltip: '🌅 Acorde cedo! Faça café antes das 6h por 5 dias diferentes.',
        icon: '🌄',
        category: 'special',
        requirement: 5,
        type: 'early-coffee-count',
        rarity: 'legendary'
    },
    'silent-hero': {
        id: 'silent-hero',
        name: 'Herói Silencioso',
        description: 'Trouxe café 10 vezes sem nunca ter pedido reconhecimento',
        icon: '🦸',
        category: 'supply',
        requirement: 10,
        type: 'humble-supplier',
        rarity: 'epic',
        secret: true
    },
    'coffee-streak-master': {
        id: 'coffee-streak-master',
        name: 'Senhor das Sequências',
        description: 'Alcançou uma sequência de 100 dias',
        tooltip: '🔥 100 dias consecutivos fazendo café? Você é uma lenda viva!',
        icon: '🎖️',
        category: 'streak',
        requirement: 100,
        type: 'streak',
        rarity: 'platinum'
    },
    'perfect-month': {
        id: 'perfect-month',
        name: 'Mês Perfeito',
        description: 'Fez pelo menos um café em todos os dias úteis do mês',
        icon: '📅',
        category: 'streak',
        requirement: 1,
        type: 'perfect-month',
        rarity: 'legendary',
        secret: true
    },
    'comeback-king': {
        id: 'comeback-king',
        name: 'Rei do Retorno',
        description: 'Voltou a fazer café após mais de 30 dias ausente',
        icon: '👑',
        category: 'special',
        requirement: 1,
        type: 'comeback',
        rarity: 'rare',
        secret: true
    },
    'double-rainbow': {
        id: 'double-rainbow',
        name: 'Arco-Íris Duplo',
        description: 'Recebeu duas avaliações 5 estrelas no mesmo café',
        icon: '🌈',
        category: 'rating',
        requirement: 1,
        type: 'double-five-star',
        rarity: 'epic',
        secret: true
    },
    'unanimous': {
        id: 'unanimous',
        name: 'Unanimidade',
        description: 'Recebeu 5 avaliações 5 estrelas no mesmo café',
        icon: '🏛️',
        category: 'rating',
        requirement: 1,
        type: 'unanimous-five-star',
        rarity: 'platinum',
        secret: true
    },
    'first-of-the-day': {
        id: 'first-of-the-day',
        name: 'Primeiro do Dia',
        description: 'Foi o primeiro a fazer café do dia por 10 vezes',
        tooltip: '☀️ Seja o primeiro a fazer café do dia por 10 vezes diferentes!',
        icon: '🥇',
        category: 'special',
        requirement: 10,
        type: 'first-coffee-of-day',
        rarity: 'epic'
    },
    'last-of-the-day': {
        id: 'last-of-the-day',
        name: 'Último do Dia',
        description: 'Foi o último a fazer café do dia por 10 vezes',
        tooltip: '🌃 Seja o último a fazer café do dia por 10 vezes diferentes!',
        icon: '🥉',
        category: 'special',
        requirement: 10,
        type: 'last-coffee-of-day',
        rarity: 'epic'
    },
    'diversity-champion': {
        id: 'diversity-champion',
        name: 'Campeão da Diversidade',
        description: 'Avaliou café de pelo menos 10 pessoas diferentes',
        tooltip: '🤝 Avalie café de 10 pessoas diferentes para desbloquear!',
        icon: '🌍',
        category: 'rating',
        requirement: 10,
        type: 'rated-different-makers',
        rarity: 'rare'
    },
    'community-pillar': {
        id: 'community-pillar',
        name: 'Pilar da Comunidade',
        description: 'Está no sistema há mais de 365 dias - Um ano de café!',
        tooltip: '🏛️ Um ano inteiro de comunidade e café! Continue firme.',
        icon: '🗿',
        category: 'milestone',
        requirement: 365,
        type: 'days-active',
        rarity: 'platinum'
    },
    'eternal-legend': {
        id: 'eternal-legend',
        name: 'Lenda Eterna',
        description: 'Está no sistema há mais de 2 anos - Veteraníssimo!',
        tooltip: '⏳ 730 dias de dedicação ao café e à comunidade!',
        icon: '👴',
        category: 'milestone',
        requirement: 730,
        type: 'days-active',
        rarity: 'platinum'
    }
};

/**
 * Obtém conquistas por categoria
 */
export function getAchievementsByCategory(category) {
    return Object.values(achievementDefinitions).filter(
        achievement => achievement.category === category
    );
}

/**
 * Obtém conquista por ID
 */
export function getAchievementById(id) {
    return achievementDefinitions[id];
}

/**
 * Lista todas as categorias
 */
export function getCategories() {
    const categories = new Set();
    Object.values(achievementDefinitions).forEach(achievement => {
        categories.add(achievement.category);
    });
    return Array.from(categories);
}
