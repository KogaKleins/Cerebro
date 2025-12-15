/**
 * 🔧 RECÁLCULO COMPLETO DE XP E CONQUISTAS
 * 
 * Este script:
 * 1. LIMPA e recalcula XP de todos os usuários baseado nas ações reais
 * 2. Remove conquistas dadas incorretamente
 * 3. Adiciona conquistas faltando
 * 4. Usa os valores CORRETOS da configuração do banco
 * 
 * USO:
 * npx ts-node scripts/recalculate-all-xp.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// ═══════════════════════════════════════════════════════════════
// 📋 DEFINIÇÕES DE CONQUISTAS COM CRITÉRIOS CORRETOS
// ═══════════════════════════════════════════════════════════════

interface AchievementDef {
  title: string;
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'platinum';
  check: (stats: UserStats) => boolean;
}

const ACHIEVEMENTS: Record<string, AchievementDef> = {
  // ☕ Café feito
  'first-coffee': {
    title: '☕ Primeiro Café',
    description: 'Fez seu primeiro café',
    rarity: 'common',
    check: (s) => s.coffeesMade >= 1
  },
  'coffee-lover': {
    title: '☕ Amante do Café',
    description: 'Fez 10 cafés',
    rarity: 'common',
    check: (s) => s.coffeesMade >= 10
  },
  'barista-junior': {
    title: '☕ Barista Júnior',
    description: 'Fez 25 cafés',
    rarity: 'rare',
    check: (s) => s.coffeesMade >= 25
  },
  'barista-senior': {
    title: '☕ Barista Sênior',
    description: 'Fez 50 cafés',
    rarity: 'epic',
    check: (s) => s.coffeesMade >= 50
  },
  'coffee-master': {
    title: '☕ Mestre do Café',
    description: 'Fez 100 cafés',
    rarity: 'legendary',
    check: (s) => s.coffeesMade >= 100
  },
  
  // 🎁 Café trazido (supply)
  'first-supply': {
    title: '🎁 Primeiro Suprimento',
    description: 'Trouxe café pela primeira vez',
    rarity: 'common',
    check: (s) => s.coffeesBrought >= 1
  },
  'supplier': {
    title: '🎁 Fornecedor',
    description: 'Trouxe café 5 vezes',
    rarity: 'common',
    check: (s) => s.coffeesBrought >= 5
  },
  'generous': {
    title: '🎁 Generoso',
    description: 'Trouxe café 15 vezes',
    rarity: 'rare',
    check: (s) => s.coffeesBrought >= 15
  },
  'benefactor': {
    title: '🎁 Benfeitor',
    description: 'Trouxe café 30 vezes',
    rarity: 'epic',
    check: (s) => s.coffeesBrought >= 30
  },
  'philanthropist': {
    title: '🎁 Filantropo',
    description: 'Trouxe café 50 vezes',
    rarity: 'legendary',
    check: (s) => s.coffeesBrought >= 50
  },
  
  // ⭐ 5 estrelas RECEBIDAS
  'five-stars': {
    title: '⭐ Cinco Estrelas',
    description: 'Recebeu primeira avaliação 5 estrelas',
    rarity: 'common',
    check: (s) => s.fiveStarsReceived >= 1
  },
  'five-stars-master': {
    title: '⭐ Mestre 5 Estrelas',
    description: 'Recebeu 10 avaliações 5 estrelas',
    rarity: 'epic',
    check: (s) => s.fiveStarsReceived >= 10
  },
  'five-stars-legend': {
    title: '⭐ Lenda 5 Estrelas',
    description: 'Recebeu 25 avaliações 5 estrelas',
    rarity: 'legendary',
    check: (s) => s.fiveStarsReceived >= 25
  },
  
  // 🏆 MÉDIA DE AVALIAÇÕES (top-rated / perfect-score)
  // 🆕 CRITÉRIO AJUSTADO: Quem recebeu pelo menos 2 avaliações 5 estrelas merece top-rated
  // Isso reconhece o esforço mesmo que avaliações ruins posteriores tenham baixado a média
  'top-rated': {
    title: '🏆 Mais Bem Avaliado',
    description: 'Recebeu pelo menos 2 avaliações 5 estrelas',
    rarity: 'epic',
    check: (s) => s.fiveStarsReceived >= 2
  },
  'perfect-score': {
    title: '🏆 Nota Perfeita',
    description: 'Média 5.0 com pelo menos 10 avaliações',
    rarity: 'legendary',
    check: (s) => s.avgRating === 5.0 && s.totalRatingsReceived >= 10
  },
  
  // ⭐ Avaliações DADAS
  'first-rate': {
    title: '⭐ Crítico',
    description: 'Deu sua primeira avaliação',
    rarity: 'common',
    check: (s) => s.ratingsGiven >= 1
  },
  'taste-expert': {
    title: '⭐ Expert em Sabores',
    description: 'Avaliou 20 cafés',
    rarity: 'rare',
    check: (s) => s.ratingsGiven >= 20
  },
  'sommelier': {
    title: '⭐ Sommelier',
    description: 'Avaliou 50 cafés',
    rarity: 'epic',
    check: (s) => s.ratingsGiven >= 50
  },
  
  // 💬 Mensagens
  'first-message': {
    title: '💬 Primeiro Contato',
    description: 'Enviou primeira mensagem no chat',
    rarity: 'common',
    check: (s) => s.messagesSent >= 1
  },
  'chatterbox': {
    title: '💬 Tagarela',
    description: 'Enviou 50 mensagens',
    rarity: 'common',
    check: (s) => s.messagesSent >= 50
  },
  'social-butterfly': {
    title: '💬 Borboleta Social',
    description: 'Enviou 200 mensagens',
    rarity: 'rare',
    check: (s) => s.messagesSent >= 200
  },
  'communicator': {
    title: '💬 Comunicador',
    description: 'Enviou 500 mensagens',
    rarity: 'epic',
    check: (s) => s.messagesSent >= 500
  },
  'influencer': {
    title: '💬 Influenciador',
    description: 'Enviou 1000 mensagens',
    rarity: 'legendary',
    check: (s) => s.messagesSent >= 1000
  },
  
  // ⏰ Tempo no sistema
  'veteran': {
    title: '🎖️ Veterano',
    description: '30 dias no sistema',
    rarity: 'rare',
    check: (s) => s.daysActive >= 30
  },
  'ancient': {
    title: '🎖️ Ancião',
    description: '90 dias no sistema',
    rarity: 'epic',
    check: (s) => s.daysActive >= 90
  },
  'founding-member': {
    title: '🎖️ Membro Fundador',
    description: '180 dias no sistema',
    rarity: 'legendary',
    check: (s) => s.daysActive >= 180
  },
  
  // 🕐 Horários especiais
  'early-bird': {
    title: '🌅 Madrugador',
    description: 'Fez café antes das 7h',
    rarity: 'rare',
    check: (s) => s.hasEarlyBird
  },
  'night-owl': {
    title: '🦉 Coruja Noturna',
    description: 'Fez café após as 20h',
    rarity: 'rare',
    check: (s) => s.hasNightOwl
  },
  'weekend-warrior': {
    title: '🎉 Guerreiro de Fim de Semana',
    description: 'Fez café no fim de semana',
    rarity: 'rare',
    check: (s) => s.hasWeekend
  },
};

// ═══════════════════════════════════════════════════════════════
// 📊 ESTRUTURA DE ESTATÍSTICAS
// ═══════════════════════════════════════════════════════════════

interface UserStats {
  coffeesMade: number;
  coffeesBrought: number;
  fiveStarsReceived: number;
  avgRating: number;
  totalRatingsReceived: number;
  ratingsGiven: number;
  messagesSent: number;
  daysActive: number;
  hasEarlyBird: boolean;
  hasNightOwl: boolean;
  hasWeekend: boolean;
}

async function getUserStats(userId: string): Promise<UserStats> {
  // Cafés feitos
  const coffeesMade = await prisma.coffee.count({
    where: { makerId: userId, type: 'MADE' }
  });
  
  // Cafés trazidos
  const coffeesBrought = await prisma.coffee.count({
    where: { makerId: userId, type: 'BROUGHT' }
  });
  
  // 5 estrelas RECEBIDAS
  const fiveStarsReceived = await prisma.rating.count({
    where: {
      rating: 5,
      coffee: { makerId: userId }
    }
  });
  
  // Todas avaliações recebidas (para calcular média)
  const ratingsReceived = await prisma.rating.findMany({
    where: { coffee: { makerId: userId } }
  });
  const totalRatingsReceived = ratingsReceived.length;
  const avgRating = totalRatingsReceived > 0
    ? ratingsReceived.reduce((sum, r) => sum + r.rating, 0) / totalRatingsReceived
    : 0;
  
  // Avaliações DADAS
  const ratingsGiven = await prisma.rating.count({
    where: { userId }
  });
  
  // Mensagens enviadas
  const messagesSent = await prisma.message.count({
    where: { authorId: userId }
  });
  
  // Dias desde o cadastro
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const daysActive = user ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Verificar horários especiais
  const coffees = await prisma.coffee.findMany({
    where: { makerId: userId, type: 'MADE' },
    select: { timestamp: true }
  });
  
  let hasEarlyBird = false;
  let hasNightOwl = false;
  let hasWeekend = false;
  
  for (const coffee of coffees) {
    const hour = coffee.timestamp.getHours();
    const day = coffee.timestamp.getDay();
    
    if (hour < 7) hasEarlyBird = true;
    if (hour >= 20) hasNightOwl = true;
    if (day === 0 || day === 6) hasWeekend = true;
  }
  
  return {
    coffeesMade,
    coffeesBrought,
    fiveStarsReceived,
    avgRating,
    totalRatingsReceived,
    ratingsGiven,
    messagesSent,
    daysActive,
    hasEarlyBird,
    hasNightOwl,
    hasWeekend
  };
}

// ═══════════════════════════════════════════════════════════════
// 💰 OBTER VALORES DE XP DA CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════

interface XPConfig {
  [key: string]: { xp: number; icon?: string; name?: string };
}

async function getXPConfig(): Promise<XPConfig> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });
  
  if (!setting || !setting.value) {
    // Defaults
    return {
      'coffee-made': { xp: 25 },
      'coffee-brought': { xp: 150 },
      'rating-given': { xp: 3 },
      'message-sent': { xp: 1 },
      'five-star-received': { xp: 30 },
      'achievement-common': { xp: 50 },
      'achievement-rare': { xp: 500 },
      'achievement-epic': { xp: 1500 },
      'achievement-legendary': { xp: 3000 },
      'achievement-platinum': { xp: 5000 },
    };
  }
  
  return setting.value as XPConfig;
}

function getRarityXP(config: XPConfig, rarity: string): number {
  const key = `achievement-${rarity}`;
  return config[key]?.xp || 50;
}

// ═══════════════════════════════════════════════════════════════
// 🧮 CALCULAR NÍVEL BASEADO NO XP
// ═══════════════════════════════════════════════════════════════

function calculateLevel(totalXP: number): { level: number; xpInLevel: number; xpForNextLevel: number } {
  // Sistema de níveis progressivo
  // Nível 1: 0-99 XP
  // Nível 2: 100-299 XP  
  // Nível 3: 300-599 XP
  // Nível 4: 600-999 XP
  // Nível 5: 1000-1499 XP
  // ...
  
  const thresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500, 6600, 7800, 9100, 10500, 12000];
  
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (totalXP >= thresholds[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  
  // Se passou de todos os thresholds, calcular níveis extras
  if (totalXP >= thresholds[thresholds.length - 1]) {
    const extraXP = totalXP - thresholds[thresholds.length - 1];
    const extraLevels = Math.floor(extraXP / 2000);
    level = thresholds.length + extraLevels;
  }
  
  // XP no nível atual
  const currentThreshold = level <= thresholds.length ? thresholds[level - 1] : thresholds[thresholds.length - 1] + (level - thresholds.length) * 2000;
  const nextThreshold = level < thresholds.length ? thresholds[level] : currentThreshold + 2000;
  
  return {
    level,
    xpInLevel: totalXP - currentThreshold,
    xpForNextLevel: nextThreshold - currentThreshold
  };
}

// ═══════════════════════════════════════════════════════════════
// 🔧 FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════

async function recalculateAll() {
  console.log('\n🔧 ═══════════════════════════════════════════════════');
  console.log('   RECÁLCULO COMPLETO DE XP E CONQUISTAS');
  console.log('═══════════════════════════════════════════════════\n');

  const xpConfig = await getXPConfig();
  console.log('📋 Configuração de XP carregada:');
  console.log(`   - Café feito: ${xpConfig['coffee-made']?.xp || 25} XP`);
  console.log(`   - Café trazido: ${xpConfig['coffee-brought']?.xp || 150} XP`);
  console.log(`   - Avaliação dada: ${xpConfig['rating-given']?.xp || 3} XP`);
  console.log(`   - Mensagem enviada: ${xpConfig['message-sent']?.xp || 1} XP`);
  console.log(`   - Conquista comum: ${xpConfig['achievement-common']?.xp || 50} XP`);
  console.log(`   - Conquista rara: ${xpConfig['achievement-rare']?.xp || 500} XP`);
  console.log(`   - Conquista épica: ${xpConfig['achievement-epic']?.xp || 1500} XP`);
  console.log(`   - Conquista lendária: ${xpConfig['achievement-legendary']?.xp || 3000} XP`);

  const users = await prisma.user.findMany();
  console.log(`\n📊 Total de usuários: ${users.length}\n`);

  const results: Array<{
    username: string;
    oldXP: number;
    newXP: number;
    oldLevel: number;
    newLevel: number;
    achievementsAdded: string[];
    achievementsRemoved: string[];
  }> = [];

  for (const user of users) {
    console.log(`\n👤 Processando: ${user.name} (${user.username})`);
    
    // 1. Obter estatísticas
    const stats = await getUserStats(user.id);
    console.log(`   📊 Stats: ${stats.coffeesMade} cafés, ${stats.ratingsGiven} avaliações, ${stats.messagesSent} msgs`);
    console.log(`   📊 Média: ${stats.avgRating.toFixed(2)} (${stats.totalRatingsReceived} avaliações recebidas)`);
    
    // 2. Obter conquistas atuais
    const currentAchievements = await prisma.achievement.findMany({
      where: { userId: user.id }
    });
    const currentTypes = new Set(currentAchievements.map(a => a.type));
    
    // 3. Calcular conquistas que DEVERIA ter
    const expectedTypes = new Set<string>();
    for (const [type, def] of Object.entries(ACHIEVEMENTS)) {
      if (def.check(stats)) {
        expectedTypes.add(type);
      }
    }
    
    // 4. Conquistas para ADICIONAR (faltando)
    const toAdd = [...expectedTypes].filter(t => !currentTypes.has(t));
    
    // 5. Conquistas para REMOVER (dadas incorretamente)
    const toRemove = [...currentTypes].filter(t => !expectedTypes.has(t) && ACHIEVEMENTS[t]);
    
    console.log(`   🏆 Conquistas atuais: ${currentTypes.size}`);
    console.log(`   ✅ Conquistas esperadas: ${expectedTypes.size}`);
    
    // 6. Remover conquistas incorretas
    if (toRemove.length > 0) {
      console.log(`   ❌ Removendo ${toRemove.length} conquistas incorretas:`);
      for (const type of toRemove) {
        const def = ACHIEVEMENTS[type];
        console.log(`      - ${def?.title || type}`);
        await prisma.achievement.deleteMany({
          where: { userId: user.id, type }
        });
      }
    }
    
    // 7. Adicionar conquistas faltando
    if (toAdd.length > 0) {
      console.log(`   ✅ Adicionando ${toAdd.length} conquistas:`);
      for (const type of toAdd) {
        const def = ACHIEVEMENTS[type];
        if (!def) continue;
        console.log(`      + ${def.title} (${def.rarity})`);
        await prisma.achievement.create({
          data: {
            userId: user.id,
            type,
            title: def.title,
            description: def.description
          }
        });
      }
    }
    
    // 8. RECALCULAR XP DO ZERO
    let totalXP = 0;
    
    // XP de cafés feitos
    totalXP += stats.coffeesMade * (xpConfig['coffee-made']?.xp || 25);
    
    // XP de cafés trazidos
    totalXP += stats.coffeesBrought * (xpConfig['coffee-brought']?.xp || 150);
    
    // XP de avaliações dadas
    totalXP += stats.ratingsGiven * (xpConfig['rating-given']?.xp || 3);
    
    // XP de mensagens enviadas
    totalXP += stats.messagesSent * (xpConfig['message-sent']?.xp || 1);
    
    // XP de 5 estrelas recebidas
    totalXP += stats.fiveStarsReceived * (xpConfig['five-star-received']?.xp || 30);
    
    // XP de conquistas FINAIS (após correções)
    const finalAchievements = [...expectedTypes];
    for (const type of finalAchievements) {
      const def = ACHIEVEMENTS[type];
      if (def) {
        totalXP += getRarityXP(xpConfig, def.rarity);
      }
    }
    
    // 9. Calcular nível
    const levelInfo = calculateLevel(totalXP);
    
    // 10. Obter XP antigo
    const oldLevel = await prisma.userLevel.findUnique({
      where: { userId: user.id }
    });
    
    // 11. Atualizar UserLevel
    await prisma.userLevel.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        level: levelInfo.level,
        xp: levelInfo.xpInLevel,
        totalXP: totalXP,
        history: []
      },
      update: {
        level: levelInfo.level,
        xp: levelInfo.xpInLevel,
        totalXP: totalXP
      }
    });
    
    console.log(`   💰 XP: ${oldLevel?.totalXP || 0} → ${totalXP} XP`);
    console.log(`   📈 Nível: ${oldLevel?.level || 1} → ${levelInfo.level}`);
    
    results.push({
      username: user.username,
      oldXP: oldLevel?.totalXP || 0,
      newXP: totalXP,
      oldLevel: oldLevel?.level || 1,
      newLevel: levelInfo.level,
      achievementsAdded: toAdd.map(t => ACHIEVEMENTS[t]?.title || t),
      achievementsRemoved: toRemove.map(t => ACHIEVEMENTS[t]?.title || t)
    });
  }

  // Relatório final
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('📊 RELATÓRIO FINAL');
  console.log('═══════════════════════════════════════════════════\n');
  
  for (const r of results) {
    const xpChange = r.newXP - r.oldXP;
    const levelChange = r.newLevel - r.oldLevel;
    
    console.log(`👤 ${r.username}:`);
    console.log(`   XP: ${r.oldXP} → ${r.newXP} (${xpChange >= 0 ? '+' : ''}${xpChange})`);
    console.log(`   Nível: ${r.oldLevel} → ${r.newLevel} (${levelChange >= 0 ? '+' : ''}${levelChange})`);
    
    if (r.achievementsAdded.length > 0) {
      console.log(`   ✅ Conquistas adicionadas: ${r.achievementsAdded.join(', ')}`);
    }
    if (r.achievementsRemoved.length > 0) {
      console.log(`   ❌ Conquistas removidas: ${r.achievementsRemoved.join(', ')}`);
    }
    console.log('');
  }

  console.log('✅ Recálculo completo finalizado!');
  
  await prisma.$disconnect();
  await pool.end();
}

recalculateAll().catch(console.error);
