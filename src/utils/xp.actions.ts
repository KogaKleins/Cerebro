/**
 * XP Actions Defaults (server-side)
 * Valores padrão usados caso não haja configuração customizada salva pelo admin.
 * 
 * 🔧 IMPORTANTE: Estes valores são DEFAULTS - os valores REAIS devem ser buscados
 * do banco de dados via SettingRepository.getXPConfig()
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 MAPA COMPLETO DE AÇÕES DE XP
// Deve estar sincronizado com js/levels/definitions.js
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_XP_ACTIONS: Record<string, { name: string; xp: number }> = {
  // ═══════════════════════════════════════════════════════════════
  // ☕ Café
  // ═══════════════════════════════════════════════════════════════
  'coffee-made': { name: 'Fazer Café', xp: 50 },
  'coffee-brought': { name: 'Trazer Café', xp: 75 },
  
  // ═══════════════════════════════════════════════════════════════
  // 🍞 Itens Especiais
  // ═══════════════════════════════════════════════════════════════
  'filtro-cafe': { name: 'Filtro de Café', xp: 30 },
  'bolo': { name: 'Bolo', xp: 250 },
  'bolo-supreme': { name: 'Bolo Supreme', xp: 400 },
  'bolacha': { name: 'Bolacha', xp: 25 },
  'bolacha-recheada': { name: 'Bolacha Recheada', xp: 35 },
  'biscoito': { name: 'Biscoito', xp: 50 },
  'sonho': { name: 'Sonho', xp: 75 },
  
  // ═══════════════════════════════════════════════════════════════
  // ⭐ Avaliações
  // ═══════════════════════════════════════════════════════════════
  'rating-given': { name: 'Avaliar Café', xp: 15 },
  'five-star-received': { name: 'Receber 5 Estrelas', xp: 30 },
  'four-star-received': { name: 'Receber 4 Estrelas', xp: 15 },
  
  // ═══════════════════════════════════════════════════════════════
  // 💬 Chat
  // ═══════════════════════════════════════════════════════════════
  'message-sent': { name: 'Enviar Mensagem', xp: 1 },
  'reaction-given': { name: 'Reagir Mensagem', xp: 3 },
  'reaction-received': { name: 'Receber Reação', xp: 5 },
  
  // ═══════════════════════════════════════════════════════════════
  // 🏆 Conquistas por Raridade
  // ═══════════════════════════════════════════════════════════════
  'achievement-common': { name: 'Conquista Comum', xp: 25 },
  'achievement-rare': { name: 'Conquista Rara', xp: 50 },
  'achievement-epic': { name: 'Conquista Épica', xp: 100 },
  'achievement-legendary': { name: 'Conquista Lendária', xp: 200 },
  'achievement-platinum': { name: 'Conquista Platina', xp: 500 },
  
  // ═══════════════════════════════════════════════════════════════
  // ✨ Ações Especiais
  // ═══════════════════════════════════════════════════════════════
  'early-coffee': { name: 'Café Madrugador', xp: 100 },
  'late-coffee': { name: 'Café Coruja', xp: 75 },
  'weekend-coffee': { name: 'Café de Fim de Semana', xp: 150 },
  'streak-bonus': { name: 'Bônus de Sequência', xp: 25 },
  'daily-login': { name: 'Login Diário', xp: 10 }
};

/**
 * Obtém o XP padrão para uma ação
 * @param actionKey - Chave da ação (ex: 'coffee-made', 'achievement-rare')
 * @returns XP padrão ou 0 se não encontrada
 */
export function getDefaultXPForAction(actionKey: string): number {
  return DEFAULT_XP_ACTIONS[actionKey]?.xp || 0;
}

/**
 * Obtém o nome da ação
 * @param actionKey - Chave da ação
 * @returns Nome da ação ou a própria chave se não encontrada
 */
export function getActionName(actionKey: string): string {
  return DEFAULT_XP_ACTIONS[actionKey]?.name || actionKey;
}

/**
 * Lista todas as ações disponíveis
 * @returns Array com todas as chaves de ações
 */
export function getAllActionKeys(): string[] {
  return Object.keys(DEFAULT_XP_ACTIONS);
}

/**
 * Mapa de raridades de conquistas para XP
 * IMPORTANTE: Deve estar sincronizado com achievement.service.ts
 */
export const ACHIEVEMENT_RARITY_XP: Record<string, number> = {
  'common': 25,
  'rare': 50,
  'epic': 100,
  'legendary': 200,
  'platinum': 500
};

/**
 * Obtém XP de conquista por raridade
 * @param rarity - Raridade da conquista
 * @returns XP correspondente
 */
export function getAchievementXPByRarity(rarity: string): number {
  return ACHIEVEMENT_RARITY_XP[rarity] || ACHIEVEMENT_RARITY_XP['common'];
}
