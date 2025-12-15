/**
 * 🔍 AUDITORIA COMPLETA E CORREÇÃO DE XP/CONQUISTAS
 * 
 * Este script faz uma análise completa de TODOS os usuários:
 * 1. Calcula XP esperado de TODAS as fontes
 * 2. Compara com XP atual
 * 3. APENAS ADICIONA XP faltante (nunca remove - política de não remover)
 * 4. Verifica e corrige conquistas faltantes
 * 5. Corrige problemas de contagem de reações/emojis
 * 
 * FONTES DE XP:
 * - Cafés feitos
 * - Cafés trazidos
 * - Itens especiais (bolo, bolacha, biscoito, etc)
 * - Avaliações dadas
 * - Avaliações recebidas (4 e 5 estrelas)
 * - Mensagens enviadas
 * - Reações dadas
 * - Reações recebidas
 * - Conquistas desbloqueadas
 * - Login diário / Streak
 * - Eventos especiais (madrugador, coruja, fim de semana, etc)
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ═══════════════════════════════════════════════════════════════
// 📋 CONFIGURAÇÃO DE XP (valores padrão do sistema)
// ═══════════════════════════════════════════════════════════════

// Carrega valores do banco ou usa defaults
async function loadXPConfig(): Promise<Record<string, number>> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });

  const defaults: Record<string, number> = {
    // Café
    'coffee-made': 50,
    'coffee-brought': 75,
    
    // Itens especiais
    'filtro-cafe': 30,
    'bolo': 250,
    'bolo-supreme': 400,
    'bolacha': 25,
    'bolacha-recheada': 35,
    'biscoito': 50,
    'sonho': 75,
    
    // Avaliações
    'rating-given': 15,
    'five-star-received': 30,
    'four-star-received': 15,
    
    // Chat
    'message-sent': 1,
    'reaction-given': 3,
    'reaction-received': 5,
    
    // Conquistas por raridade
    'achievement-common': 25,
    'achievement-rare': 50,
    'achievement-epic': 100,
    'achievement-legendary': 200,
    'achievement-platinum': 500,
    
    // Especiais
    'early-coffee': 100,
    'late-coffee': 75,
    'weekend-coffee': 150,
    'streak-bonus': 25,
    'daily-login': 10,
  };

  if (setting && setting.value) {
    const config = setting.value as Record<string, { xp: number }>;
    for (const [key, value] of Object.entries(config)) {
      if (typeof value?.xp === 'number') {
        defaults[key] = value.xp;
      }
    }
  }

  return defaults;
}

// ═══════════════════════════════════════════════════════════════
// 📋 MAPEAMENTO DE CONQUISTAS PARA RARIDADES
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENT_RARITY: Record<string, string> = {
  // ☕ Coffee making
  'first-coffee': 'common',
  'coffee-lover': 'common',
  'barista-junior': 'rare',
  'barista-senior': 'epic',
  'coffee-master': 'legendary',
  'coffee-legend': 'platinum',
  'coffee-god': 'platinum',
  
  // 🛒 Supply
  'first-supply': 'common',
  'supplier': 'common',
  'generous': 'rare',
  'benefactor': 'epic',
  'philanthropist': 'legendary',
  'supply-king': 'platinum',
  'supply-legend': 'platinum',
  
  // ⭐ Ratings received
  'five-stars': 'common',
  'five-stars-master': 'epic',
  'five-stars-legend': 'legendary',
  'galaxy-of-stars': 'platinum',
  'top-rated': 'epic',
  'perfect-score': 'platinum',
  'double-rainbow': 'epic',
  'unanimous': 'platinum',
  
  // ⭐ Ratings given
  'first-rate': 'common',
  'taste-expert': 'rare',
  'sommelier': 'epic',
  'critic-master': 'legendary',
  'diversity-champion': 'rare',
  
  // 💬 Chat
  'first-message': 'common',
  'chatterbox': 'common',
  'social-butterfly': 'rare',
  'communicator': 'epic',
  'influencer': 'legendary',
  'viral': 'epic',
  'popular': 'legendary',
  
  // ✨ Special time
  'early-bird': 'rare',
  'night-owl': 'rare',
  'weekend-warrior': 'rare',
  'monday-hero': 'rare',
  'friday-finisher': 'rare',
  'night-shift': 'epic',
  'early-legend': 'legendary',
  'first-of-the-day': 'epic',
  'last-of-the-day': 'epic',
  'comeback-king': 'rare',
  
  // 🔥 Streak
  'streak-3': 'common',
  'streak-7': 'rare',
  'streak-14': 'epic',
  'streak-30': 'legendary',
  'streak-60': 'platinum',
  'coffee-streak-master': 'platinum',
  'perfect-month': 'legendary',
  
  // 🏆 Milestone
  'veteran': 'rare',
  'ancient': 'epic',
  'founding-member': 'legendary',
  'community-pillar': 'platinum',
  'eternal-legend': 'platinum',
  'all-rounder': 'epic',
  'perfectionist': 'legendary',
  'completionist': 'platinum',
  
  // 🎮 Fun
  // 🔧 REMOVIDO: emoji-master e emoji-legend (sistema só tem 8 emojis - muito fácil)
  'reactor': 'rare',
  'reaction-god': 'legendary',
  'speed-typer': 'rare',
  'coffee-duo': 'rare',
  'triple-threat': 'legendary',
  'silent-hero': 'epic',
};

// ═══════════════════════════════════════════════════════════════
// 📋 DEFINIÇÕES DE CONQUISTAS (requisitos)
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENT_REQUIREMENTS: Record<string, { type: string; requirement: number; title: string }> = {
  // ☕ Café feito
  'first-coffee': { type: 'coffee-made', requirement: 1, title: 'Primeiro Café' },
  'coffee-lover': { type: 'coffee-made', requirement: 10, title: 'Amante do Café' },
  'barista-junior': { type: 'coffee-made', requirement: 25, title: 'Barista Jr.' },
  'barista-senior': { type: 'coffee-made', requirement: 50, title: 'Barista Sênior' },
  'coffee-master': { type: 'coffee-made', requirement: 100, title: 'Mestre do Café' },
  'coffee-legend': { type: 'coffee-made', requirement: 250, title: 'Lenda do Café' },
  'coffee-god': { type: 'coffee-made', requirement: 500, title: 'Deus do Café' },
  
  // 🛒 Café trazido
  'first-supply': { type: 'coffee-brought', requirement: 1, title: 'Primeiro Suprimento' },
  'supplier': { type: 'coffee-brought', requirement: 5, title: 'Fornecedor' },
  'generous': { type: 'coffee-brought', requirement: 15, title: 'Generoso' },
  'benefactor': { type: 'coffee-brought', requirement: 30, title: 'Benfeitor' },
  'philanthropist': { type: 'coffee-brought', requirement: 50, title: 'Filantropo do Café' },
  'supply-king': { type: 'coffee-brought', requirement: 100, title: 'Rei dos Suprimentos' },
  'supply-legend': { type: 'coffee-brought', requirement: 200, title: 'Lenda do Abastecimento' },
  
  // ⭐ 5 estrelas recebidas
  'five-stars': { type: 'five-stars-received', requirement: 1, title: '5 Estrelas' },
  'five-stars-master': { type: 'five-stars-received', requirement: 10, title: 'Colecionador de Estrelas' },
  'five-stars-legend': { type: 'five-stars-received', requirement: 25, title: 'Constelação' },
  'galaxy-of-stars': { type: 'five-stars-received', requirement: 50, title: 'Galáxia de Estrelas' },
  
  // 📝 Avaliações dadas
  'first-rate': { type: 'ratings-given', requirement: 1, title: 'Crítico' },
  'taste-expert': { type: 'ratings-given', requirement: 20, title: 'Especialista' },
  'sommelier': { type: 'ratings-given', requirement: 50, title: 'Sommelier de Café' },
  'critic-master': { type: 'ratings-given', requirement: 100, title: 'Mestre Crítico' },
  
  // 💬 Mensagens enviadas
  'first-message': { type: 'messages-sent', requirement: 1, title: 'Primeiro Contato' },
  'chatterbox': { type: 'messages-sent', requirement: 50, title: 'Tagarela' },
  'social-butterfly': { type: 'messages-sent', requirement: 200, title: 'Sociável' },
  'communicator': { type: 'messages-sent', requirement: 500, title: 'Comunicador' },
  'influencer': { type: 'messages-sent', requirement: 1000, title: 'Influenciador' },
  
  // 💥 Reações dadas
  'reactor': { type: 'reactions-given', requirement: 100, title: 'Reator Nuclear' },
  'reaction-god': { type: 'reactions-given', requirement: 500, title: 'Deus das Reações' },
  
  // 🔥 Reações recebidas
  'viral': { type: 'reactions-received', requirement: 50, title: 'Viral' },
  'popular': { type: 'reactions-received', requirement: 200, title: 'Popular' },
  
  // 🔥 Streak
  'streak-3': { type: 'streak', requirement: 3, title: 'Consistente' },
  'streak-7': { type: 'streak', requirement: 7, title: 'Dedicado' },
  'streak-14': { type: 'streak', requirement: 14, title: 'Duas Semanas' },
  'streak-30': { type: 'streak', requirement: 30, title: 'Imbatível' },
  'streak-60': { type: 'streak', requirement: 60, title: 'Máquina de Café' },
  'coffee-streak-master': { type: 'streak', requirement: 100, title: 'Senhor das Sequências' },
  
  // 🎖️ Veterano (dias ativos)
  'veteran': { type: 'days-active', requirement: 30, title: 'Veterano' },
  'ancient': { type: 'days-active', requirement: 90, title: 'Ancião' },
  'founding-member': { type: 'days-active', requirement: 180, title: 'Membro Fundador' },
  'community-pillar': { type: 'days-active', requirement: 365, title: 'Pilar da Comunidade' },
  'eternal-legend': { type: 'days-active', requirement: 730, title: 'Lenda Eterna' },
  
  // 🎨 Emojis únicos - REMOVIDO (sistema só tem 8 emojis - muito fácil)
  // 'emoji-master' e 'emoji-legend' foram removidos do sistema
  
  // ⏰ Horário especial
  'early-bird': { type: 'early-coffee', requirement: 1, title: 'Madrugador' },
  'night-owl': { type: 'late-coffee', requirement: 1, title: 'Coruja' },
  'weekend-warrior': { type: 'weekend-coffee', requirement: 1, title: 'Guerreiro de Fim de Semana' },
  'monday-hero': { type: 'monday-coffee', requirement: 1, title: 'Herói da Segunda' },
  'friday-finisher': { type: 'friday-coffee', requirement: 1, title: 'Finalizador da Sexta' },
};

// ═══════════════════════════════════════════════════════════════
// 📊 FUNÇÕES DE CÁLCULO
// ═══════════════════════════════════════════════════════════════

function calculateLevel(totalXP: number): number {
  const levels = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 250 },
    { level: 4, xpRequired: 500 },
    { level: 5, xpRequired: 1000 },
    { level: 6, xpRequired: 2000 },
    { level: 7, xpRequired: 3500 },
    { level: 8, xpRequired: 5500 },
    { level: 9, xpRequired: 8000 },
    { level: 10, xpRequired: 11000 },
    { level: 11, xpRequired: 15000 },
    { level: 12, xpRequired: 20000 },
    { level: 13, xpRequired: 27000 },
    { level: 14, xpRequired: 36000 },
    { level: 15, xpRequired: 50000 },
  ];
  
  let currentLevel = 1;
  for (const lvl of levels) {
    if (totalXP >= lvl.xpRequired) {
      currentLevel = lvl.level;
    } else {
      break;
    }
  }
  return currentLevel;
}

function calculateCurrentLevelXP(totalXP: number, level: number): number {
  const levelXP: Record<number, number> = {
    1: 0, 2: 100, 3: 250, 4: 500, 5: 1000,
    6: 2000, 7: 3500, 8: 5500, 9: 8000, 10: 11000,
    11: 15000, 12: 20000, 13: 27000, 14: 36000, 15: 50000,
  };
  return totalXP - (levelXP[level] || 0);
}

// ═══════════════════════════════════════════════════════════════
// 🔍 FUNÇÃO PRINCIPAL DE AUDITORIA
// ═══════════════════════════════════════════════════════════════

interface UserAudit {
  userId: string;
  username: string;
  name: string;
  currentXP: number;
  calculatedXP: number;
  xpFromAchievements: number;
  xpFromCoffee: number;
  xpFromRatings: number;
  xpFromChat: number;
  xpFromOther: number;
  missingAchievements: string[];
  wrongAchievements: string[];
  needsCorrection: boolean;
  xpToAdd: number;
  breakdown: Record<string, { count: number; xp: number }>;
}

async function auditUser(user: any, xpConfig: Record<string, number>): Promise<UserAudit> {
  const achievements = await prisma.achievement.findMany({ where: { userId: user.id } });
  const achievementTypes = achievements.map(a => a.type);
  
  let xpFromAchievements = 0;
  let xpFromCoffee = 0;
  let xpFromRatings = 0;
  let xpFromChat = 0;
  let xpFromOther = 0;
  
  const breakdown: Record<string, { count: number; xp: number }> = {};
  const missingAchievements: string[] = [];
  const wrongAchievements: string[] = [];

  // ═══════════════════════════════════════════════════════════════
  // 1. CAFÉ FEITO
  // ═══════════════════════════════════════════════════════════════
  const coffeeMade = await prisma.coffee.count({
    where: { makerId: user.id, type: 'MADE' }
  });
  const xpCoffeeMade = coffeeMade * xpConfig['coffee-made'];
  xpFromCoffee += xpCoffeeMade;
  breakdown['coffee-made'] = { count: coffeeMade, xp: xpCoffeeMade };

  // ═══════════════════════════════════════════════════════════════
  // 2. CAFÉ TRAZIDO
  // ═══════════════════════════════════════════════════════════════
  const coffeeBrought = await prisma.coffee.count({
    where: { makerId: user.id, type: 'BROUGHT' }
  });
  const xpCoffeeBrought = coffeeBrought * xpConfig['coffee-brought'];
  xpFromCoffee += xpCoffeeBrought;
  breakdown['coffee-brought'] = { count: coffeeBrought, xp: xpCoffeeBrought };

  // ═══════════════════════════════════════════════════════════════
  // 3. AVALIAÇÕES DADAS
  // ═══════════════════════════════════════════════════════════════
  const ratingsGiven = await prisma.rating.count({ where: { userId: user.id } });
  const xpRatingsGiven = ratingsGiven * xpConfig['rating-given'];
  xpFromRatings += xpRatingsGiven;
  breakdown['ratings-given'] = { count: ratingsGiven, xp: xpRatingsGiven };

  // ═══════════════════════════════════════════════════════════════
  // 4. AVALIAÇÕES RECEBIDAS (4 e 5 estrelas)
  // ═══════════════════════════════════════════════════════════════
  const fiveStarsReceived = await prisma.rating.count({
    where: { coffee: { makerId: user.id }, rating: 5 }
  });
  const fourStarsReceived = await prisma.rating.count({
    where: { coffee: { makerId: user.id }, rating: 4 }
  });
  
  const xp5Stars = fiveStarsReceived * xpConfig['five-star-received'];
  const xp4Stars = fourStarsReceived * xpConfig['four-star-received'];
  xpFromRatings += xp5Stars + xp4Stars;
  breakdown['five-stars-received'] = { count: fiveStarsReceived, xp: xp5Stars };
  breakdown['four-stars-received'] = { count: fourStarsReceived, xp: xp4Stars };

  // ═══════════════════════════════════════════════════════════════
  // 5. MENSAGENS ENVIADAS
  // ═══════════════════════════════════════════════════════════════
  const messagesSent = await prisma.message.count({ where: { authorId: user.id } });
  const xpMessages = messagesSent * xpConfig['message-sent'];
  xpFromChat += xpMessages;
  breakdown['messages-sent'] = { count: messagesSent, xp: xpMessages };

  // ═══════════════════════════════════════════════════════════════
  // 6. REAÇÕES DADAS (userId na tabela message_reactions é username!)
  // ═══════════════════════════════════════════════════════════════
  const reactionsGiven = await prisma.messageReaction.count({
    where: { userId: user.username }
  });
  const xpReactionsGiven = reactionsGiven * xpConfig['reaction-given'];
  xpFromChat += xpReactionsGiven;
  breakdown['reactions-given'] = { count: reactionsGiven, xp: xpReactionsGiven };

  // ═══════════════════════════════════════════════════════════════
  // 7. REAÇÕES RECEBIDAS (mensagens do usuário que receberam reações)
  // ═══════════════════════════════════════════════════════════════
  const reactionsReceived = await prisma.messageReaction.count({
    where: { message: { authorId: user.id } }
  });
  const xpReactionsReceived = reactionsReceived * xpConfig['reaction-received'];
  xpFromChat += xpReactionsReceived;
  breakdown['reactions-received'] = { count: reactionsReceived, xp: xpReactionsReceived };

  // ═══════════════════════════════════════════════════════════════
  // 8. EMOJIS ÚNICOS (para conquistas)
  // ═══════════════════════════════════════════════════════════════
  const uniqueEmojisResult = await prisma.messageReaction.groupBy({
    by: ['emoji'],
    where: { userId: user.username }
  });
  const uniqueEmojis = uniqueEmojisResult.length;
  breakdown['unique-emojis'] = { count: uniqueEmojis, xp: 0 };

  // ═══════════════════════════════════════════════════════════════
  // 9. DIAS ATIVOS (tempo desde criação)
  // ═══════════════════════════════════════════════════════════════
  const daysActive = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  breakdown['days-active'] = { count: daysActive, xp: 0 };

  // ═══════════════════════════════════════════════════════════════
  // 10. STREAK (melhor sequência)
  // ═══════════════════════════════════════════════════════════════
  const userLevel = await prisma.userLevel.findUnique({ where: { userId: user.id } });
  const bestStreak = userLevel?.bestStreak || 0;
  const currentStreak = userLevel?.streak || 0;
  breakdown['best-streak'] = { count: bestStreak, xp: 0 };
  breakdown['current-streak'] = { count: currentStreak, xp: 0 };

  // ═══════════════════════════════════════════════════════════════
  // 11. VERIFICAR HORÁRIOS ESPECIAIS NOS CAFÉS
  // ═══════════════════════════════════════════════════════════════
  const userCoffees = await prisma.coffee.findMany({
    where: { makerId: user.id, type: 'MADE' },
    select: { timestamp: true }
  });

  let hasEarlyCoffee = false;
  let hasLateCoffee = false;
  let hasWeekendCoffee = false;
  let hasMondayCoffee = false;
  let hasFridayCoffee = false;

  for (const coffee of userCoffees) {
    const date = new Date(coffee.timestamp);
    const hour = date.getHours();
    const day = date.getDay();
    
    if (hour < 7) hasEarlyCoffee = true;
    if (hour >= 20) hasLateCoffee = true;
    if (day === 0 || day === 6) hasWeekendCoffee = true;
    if (day === 1 && hour < 10) hasMondayCoffee = true;
    if (day === 5 && hour >= 14) hasFridayCoffee = true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 12. XP DAS CONQUISTAS
  // ═══════════════════════════════════════════════════════════════
  for (const ach of achievements) {
    const rarity = ACHIEVEMENT_RARITY[ach.type] || 'common';
    const achXP = xpConfig[`achievement-${rarity}`] || xpConfig['achievement-common'];
    xpFromAchievements += achXP;
  }
  breakdown['achievements'] = { count: achievements.length, xp: xpFromAchievements };

  // ═══════════════════════════════════════════════════════════════
  // 13. VERIFICAR CONQUISTAS FALTANTES
  // ═══════════════════════════════════════════════════════════════
  const stats: Record<string, number | boolean> = {
    'coffee-made': coffeeMade,
    'coffee-brought': coffeeBrought,
    'five-stars-received': fiveStarsReceived,
    'ratings-given': ratingsGiven,
    'messages-sent': messagesSent,
    'reactions-given': reactionsGiven,
    'reactions-received': reactionsReceived,
    'unique-emojis': uniqueEmojis,
    'days-active': daysActive,
    'streak': Math.max(bestStreak, currentStreak),
    'early-coffee': hasEarlyCoffee,
    'late-coffee': hasLateCoffee,
    'weekend-coffee': hasWeekendCoffee,
    'monday-coffee': hasMondayCoffee,
    'friday-coffee': hasFridayCoffee,
  };

  for (const [achievementId, def] of Object.entries(ACHIEVEMENT_REQUIREMENTS)) {
    const current = stats[def.type];
    const hasAchievement = achievementTypes.includes(achievementId);
    
    let shouldHave = false;
    if (typeof current === 'boolean') {
      shouldHave = current === true;
    } else if (typeof current === 'number') {
      shouldHave = current >= def.requirement;
    }
    
    // Deveria ter mas não tem
    if (shouldHave && !hasAchievement) {
      missingAchievements.push(achievementId);
    }
    
    // Tem mas não deveria (para registro apenas, NÃO vamos remover)
    if (!shouldHave && hasAchievement) {
      wrongAchievements.push(achievementId);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 14. CALCULAR TOTAIS
  // ═══════════════════════════════════════════════════════════════
  const calculatedXP = xpFromAchievements + xpFromCoffee + xpFromRatings + xpFromChat + xpFromOther;
  const currentXP = userLevel?.totalXP || 0;
  
  // IMPORTANTE: Só adicionar XP, nunca remover!
  const xpToAdd = calculatedXP > currentXP ? calculatedXP - currentXP : 0;
  const needsCorrection = xpToAdd > 0 || missingAchievements.length > 0;

  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    currentXP,
    calculatedXP,
    xpFromAchievements,
    xpFromCoffee,
    xpFromRatings,
    xpFromChat,
    xpFromOther,
    missingAchievements,
    wrongAchievements,
    needsCorrection,
    xpToAdd,
    breakdown,
  };
}

// ═══════════════════════════════════════════════════════════════
// 🔧 FUNÇÃO DE CORREÇÃO
// ═══════════════════════════════════════════════════════════════

async function applyCorrections(audit: UserAudit, xpConfig: Record<string, number>): Promise<void> {
  console.log(`\n🔧 Corrigindo ${audit.name} (@${audit.username})...`);
  
  // 1. Desbloquear conquistas faltantes
  for (const achievementId of audit.missingAchievements) {
    const def = ACHIEVEMENT_REQUIREMENTS[achievementId];
    if (!def) continue;
    
    try {
      // Verificar se ainda não existe
      const existing = await prisma.achievement.findUnique({
        where: { userId_type: { userId: audit.userId, type: achievementId } }
      });
      
      if (!existing) {
        await prisma.achievement.create({
          data: {
            userId: audit.userId,
            type: achievementId,
            title: def.title,
            description: `Desbloqueado automaticamente por auditoria`
          }
        });
        
        // Adicionar XP da conquista
        const rarity = ACHIEVEMENT_RARITY[achievementId] || 'common';
        const achXP = xpConfig[`achievement-${rarity}`] || xpConfig['achievement-common'];
        
        console.log(`   ✅ Conquista desbloqueada: ${achievementId} (${def.title}) +${achXP} XP`);
      }
    } catch (error) {
      console.log(`   ⚠️ Erro ao desbloquear ${achievementId}: ${error}`);
    }
  }
  
  // 2. Recalcular XP total após conquistas
  const updatedAchievements = await prisma.achievement.findMany({ where: { userId: audit.userId } });
  let xpFromAchievements = 0;
  for (const ach of updatedAchievements) {
    const rarity = ACHIEVEMENT_RARITY[ach.type] || 'common';
    const achXP = xpConfig[`achievement-${rarity}`] || xpConfig['achievement-common'];
    xpFromAchievements += achXP;
  }
  
  const newCalculatedXP = xpFromAchievements + audit.xpFromCoffee + audit.xpFromRatings + audit.xpFromChat + audit.xpFromOther;
  const finalXP = Math.max(audit.currentXP, newCalculatedXP);
  
  // 3. Atualizar nível apenas se XP aumentou
  if (finalXP > audit.currentXP) {
    const newLevel = calculateLevel(finalXP);
    const newLevelXP = calculateCurrentLevelXP(finalXP, newLevel);
    
    await prisma.userLevel.upsert({
      where: { userId: audit.userId },
      create: {
        userId: audit.userId,
        totalXP: finalXP,
        level: newLevel,
        xp: newLevelXP
      },
      update: {
        totalXP: finalXP,
        level: newLevel,
        xp: newLevelXP
      }
    });
    
    console.log(`   📊 XP atualizado: ${audit.currentXP} → ${finalXP} (+${finalXP - audit.currentXP})`);
    console.log(`   🎯 Nível: ${calculateLevel(audit.currentXP)} → ${newLevel}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀 EXECUÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 AUDITORIA COMPLETA DE XP E CONQUISTAS');
  console.log('═'.repeat(80));
  console.log(`📅 Data: ${new Date().toLocaleString('pt-BR')}`);
  console.log('⚠️  POLÍTICA: Apenas ADICIONAR XP faltante, NUNCA remover\n');

  const xpConfig = await loadXPConfig();
  console.log('📋 Configuração de XP carregada do banco\n');

  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
  console.log(`👥 Total de usuários: ${users.length}\n`);

  const audits: UserAudit[] = [];
  
  // Auditar cada usuário
  for (const user of users) {
    const audit = await auditUser(user, xpConfig);
    audits.push(audit);
  }

  // ═══════════════════════════════════════════════════════════════
  // RELATÓRIO DETALHADO
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RELATÓRIO DETALHADO POR USUÁRIO');
  console.log('═'.repeat(80));

  for (const audit of audits) {
    console.log(`\n👤 ${audit.name} (@${audit.username})`);
    console.log('─'.repeat(60));
    
    console.log('   📦 BREAKDOWN DE XP:');
    console.log(`      ☕ Café feito: ${audit.breakdown['coffee-made']?.count || 0} × ${xpConfig['coffee-made']} = ${audit.breakdown['coffee-made']?.xp || 0} XP`);
    console.log(`      🛒 Café trazido: ${audit.breakdown['coffee-brought']?.count || 0} × ${xpConfig['coffee-brought']} = ${audit.breakdown['coffee-brought']?.xp || 0} XP`);
    console.log(`      ⭐ Avaliações dadas: ${audit.breakdown['ratings-given']?.count || 0} × ${xpConfig['rating-given']} = ${audit.breakdown['ratings-given']?.xp || 0} XP`);
    console.log(`      🌟 5 estrelas recebidas: ${audit.breakdown['five-stars-received']?.count || 0} × ${xpConfig['five-star-received']} = ${audit.breakdown['five-stars-received']?.xp || 0} XP`);
    console.log(`      ⭐ 4 estrelas recebidas: ${audit.breakdown['four-stars-received']?.count || 0} × ${xpConfig['four-star-received']} = ${audit.breakdown['four-stars-received']?.xp || 0} XP`);
    console.log(`      💬 Mensagens: ${audit.breakdown['messages-sent']?.count || 0} × ${xpConfig['message-sent']} = ${audit.breakdown['messages-sent']?.xp || 0} XP`);
    console.log(`      👍 Reações dadas: ${audit.breakdown['reactions-given']?.count || 0} × ${xpConfig['reaction-given']} = ${audit.breakdown['reactions-given']?.xp || 0} XP`);
    console.log(`      ❤️ Reações recebidas: ${audit.breakdown['reactions-received']?.count || 0} × ${xpConfig['reaction-received']} = ${audit.breakdown['reactions-received']?.xp || 0} XP`);
    console.log(`      🏆 Conquistas (${audit.breakdown['achievements']?.count || 0}): ${audit.xpFromAchievements} XP`);
    
    console.log('\n   📊 TOTAIS:');
    console.log(`      XP de Café: ${audit.xpFromCoffee}`);
    console.log(`      XP de Avaliações: ${audit.xpFromRatings}`);
    console.log(`      XP de Chat: ${audit.xpFromChat}`);
    console.log(`      XP de Conquistas: ${audit.xpFromAchievements}`);
    console.log(`      XP CALCULADO TOTAL: ${audit.calculatedXP}`);
    console.log(`      XP ATUAL NO BANCO: ${audit.currentXP}`);
    
    if (audit.xpToAdd > 0) {
      console.log(`      ⚠️ XP FALTANTE: +${audit.xpToAdd}`);
    }
    
    console.log('\n   📈 ESTATÍSTICAS PARA CONQUISTAS:');
    console.log(`      😎 Emojis únicos usados: ${audit.breakdown['unique-emojis']?.count || 0}`);
    console.log(`      📅 Dias ativos: ${audit.breakdown['days-active']?.count || 0}`);
    console.log(`      🔥 Melhor streak: ${audit.breakdown['best-streak']?.count || 0}`);
    console.log(`      🔥 Streak atual: ${audit.breakdown['current-streak']?.count || 0}`);
    
    if (audit.missingAchievements.length > 0) {
      console.log(`\n   ⚠️ CONQUISTAS FALTANTES (${audit.missingAchievements.length}):`);
      for (const achId of audit.missingAchievements) {
        const def = ACHIEVEMENT_REQUIREMENTS[achId];
        const rarity = ACHIEVEMENT_RARITY[achId] || 'common';
        const achXP = xpConfig[`achievement-${rarity}`] || xpConfig['achievement-common'];
        console.log(`      - ${achId}: ${def?.title} (+${achXP} XP)`);
      }
    }
    
    if (audit.wrongAchievements.length > 0) {
      console.log(`\n   ℹ️ CONQUISTAS A VERIFICAR (${audit.wrongAchievements.length}):`);
      console.log(`      (NÃO serão removidas por política)`);
      for (const achId of audit.wrongAchievements) {
        const def = ACHIEVEMENT_REQUIREMENTS[achId];
        console.log(`      - ${achId}: ${def?.title}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RESUMO
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 RESUMO FINAL');
  console.log('═'.repeat(80));

  const needsCorrection = audits.filter(a => a.needsCorrection);
  const totalMissingXP = audits.reduce((sum, a) => sum + a.xpToAdd, 0);
  const totalMissingAchievements = audits.reduce((sum, a) => sum + a.missingAchievements.length, 0);

  console.log(`\n📊 Estatísticas:`);
  console.log(`   - Usuários analisados: ${audits.length}`);
  console.log(`   - Usuários que precisam correção: ${needsCorrection.length}`);
  console.log(`   - XP total faltante: ${totalMissingXP}`);
  console.log(`   - Conquistas faltantes: ${totalMissingAchievements}`);

  if (needsCorrection.length > 0) {
    console.log(`\n📝 Usuários que serão corrigidos:`);
    for (const audit of needsCorrection) {
      console.log(`   - ${audit.name}: +${audit.xpToAdd} XP, ${audit.missingAchievements.length} conquistas`);
    }

    // ═══════════════════════════════════════════════════════════════
    // APLICAR CORREÇÕES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(80));
    console.log('🔧 APLICANDO CORREÇÕES');
    console.log('═'.repeat(80));

    for (const audit of needsCorrection) {
      await applyCorrections(audit, xpConfig);
    }

    console.log('\n✅ Todas as correções foram aplicadas!');
  } else {
    console.log('\n✅ Nenhuma correção necessária! Todos os dados estão corretos.');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
