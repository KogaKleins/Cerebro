/**
 * RECÁLCULO CORRETO DE XP E NÍVEIS
 * Baseado em todas as ações do usuário
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuração de XP por ação
const XP_CONFIG = {
  // Café
  'coffee-made': 10,
  'coffee-brought': 15,
  
  // Avaliações dadas
  'rating-given': 5,
  
  // Avaliações recebidas
  'rating-4-star-received': 15,
  'rating-5-star-received': 30,
  
  // Mensagens
  'message-sent': 2,
};

// XP por conquista baseado na RARIDADE (do definitions.js)
const RARITY_XP: Record<string, number> = {
  'common': 10,
  'rare': 25,
  'epic': 50,
  'legendary': 100,
  'platinum': 250,
};

// Mapeamento de conquistas para suas raridades
const ACHIEVEMENT_RARITY: Record<string, string> = {
  // Coffee Making
  'first-coffee': 'common',
  'coffee-lover': 'common',
  'barista-junior': 'rare',
  'barista-senior': 'epic',
  'coffee-master': 'legendary',
  'coffee-legend': 'platinum',
  'coffee-god': 'platinum',
  
  // Coffee Bringing
  'first-supply': 'common',
  'supplier': 'common',
  'generous': 'rare',
  'benefactor': 'epic',
  
  // Ratings Given
  'first-rate': 'common',
  'taste-tester': 'common',
  'critic': 'rare',
  'professional-critic': 'epic',
  
  // Ratings Received
  'five-stars': 'common',
  'five-star-received': 'common',
  'top-rated': 'rare',
  'crowd-favorite': 'epic',
  'legendary-barista': 'legendary',
  
  // Special Time
  'early-bird': 'rare',
  'night-owl': 'rare',
  'weekend-warrior': 'rare',
  'monday-hero': 'rare',
  'friday-finisher': 'rare',
  
  // Veteran
  'veteran-30': 'rare',
  'veteran-90': 'epic',
  'veteran-365': 'legendary',
  
  // Messages
  'first-message': 'common',
  'chatterbox': 'common',
  'social-butterfly': 'rare',
  'community-pillar': 'epic',
};

// Níveis e XP necessário
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
    1: 0,
    2: 100,
    3: 250,
    4: 500,
    5: 1000,
    6: 2000,
    7: 3500,
    8: 5500,
    9: 8000,
    10: 11000,
  };
  
  return totalXP - (levelXP[level] || 0);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🔧 ═══════════════════════════════════════════════════');
  console.log('   RECÁLCULO CORRETO DE XP E NÍVEIS');
  console.log('═══════════════════════════════════════════════════\n');

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  const results: any[] = [];

  for (const user of users) {
    console.log(`\n👤 Recalculando: ${user.name} (@${user.username})`);
    console.log('─'.repeat(50));

    let totalXP = 0;
    const breakdown: Record<string, { count: number; xp: number }> = {};

    // 1. XP por CAFÉS FEITOS
    const coffeesMade = await prisma.coffee.count({
      where: { makerId: user.id, type: 'MADE' }
    });
    const xpCoffeesMade = coffeesMade * XP_CONFIG['coffee-made'];
    totalXP += xpCoffeesMade;
    breakdown['coffees-made'] = { count: coffeesMade, xp: xpCoffeesMade };
    console.log(`   ☕ Cafés feitos: ${coffeesMade} × ${XP_CONFIG['coffee-made']} = ${xpCoffeesMade} XP`);

    // 2. XP por CAFÉS TRAZIDOS
    const coffeesBrought = await prisma.coffee.count({
      where: { makerId: user.id, type: 'BROUGHT' }
    });
    const xpCoffeesBrought = coffeesBrought * XP_CONFIG['coffee-brought'];
    totalXP += xpCoffeesBrought;
    breakdown['coffees-brought'] = { count: coffeesBrought, xp: xpCoffeesBrought };
    console.log(`   🛒 Cafés trazidos: ${coffeesBrought} × ${XP_CONFIG['coffee-brought']} = ${xpCoffeesBrought} XP`);

    // 3. XP por AVALIAÇÕES DADAS
    const ratingsGiven = await prisma.rating.count({
      where: { userId: user.id }
    });
    const xpRatingsGiven = ratingsGiven * XP_CONFIG['rating-given'];
    totalXP += xpRatingsGiven;
    breakdown['ratings-given'] = { count: ratingsGiven, xp: xpRatingsGiven };
    console.log(`   ⭐ Avaliações dadas: ${ratingsGiven} × ${XP_CONFIG['rating-given']} = ${xpRatingsGiven} XP`);

    // 4. XP por AVALIAÇÕES RECEBIDAS (4-5 estrelas)
    const userCoffees = await prisma.coffee.findMany({
      where: { makerId: user.id },
      select: { id: true }
    });
    const coffeeIds = userCoffees.map(c => c.id);
    
    let xpRatingsReceived = 0;
    let ratings4Star = 0;
    let ratings5Star = 0;
    
    if (coffeeIds.length > 0) {
      const ratingsReceived = await prisma.rating.findMany({
        where: { coffeeId: { in: coffeeIds } }
      });
      
      for (const rating of ratingsReceived) {
        if (rating.rating === 5) {
          ratings5Star++;
          xpRatingsReceived += XP_CONFIG['rating-5-star-received'];
        } else if (rating.rating === 4) {
          ratings4Star++;
          xpRatingsReceived += XP_CONFIG['rating-4-star-received'];
        }
      }
    }
    totalXP += xpRatingsReceived;
    breakdown['ratings-4-star'] = { count: ratings4Star, xp: ratings4Star * XP_CONFIG['rating-4-star-received'] };
    breakdown['ratings-5-star'] = { count: ratings5Star, xp: ratings5Star * XP_CONFIG['rating-5-star-received'] };
    console.log(`   🌟 Avaliações 5⭐ recebidas: ${ratings5Star} × ${XP_CONFIG['rating-5-star-received']} = ${ratings5Star * XP_CONFIG['rating-5-star-received']} XP`);
    console.log(`   ⭐ Avaliações 4⭐ recebidas: ${ratings4Star} × ${XP_CONFIG['rating-4-star-received']} = ${ratings4Star * XP_CONFIG['rating-4-star-received']} XP`);

    // 5. XP por MENSAGENS
    const messages = await prisma.message.count({
      where: { authorId: user.id }
    });
    const xpMessages = messages * XP_CONFIG['message-sent'];
    totalXP += xpMessages;
    breakdown['messages'] = { count: messages, xp: xpMessages };
    console.log(`   💬 Mensagens: ${messages} × ${XP_CONFIG['message-sent']} = ${xpMessages} XP`);

    // 6. XP por CONQUISTAS
    const achievements = await prisma.achievement.findMany({
      where: { userId: user.id }
    });
    
    let xpAchievements = 0;
    console.log(`   🏆 Conquistas (${achievements.length}):`);
    for (const ach of achievements) {
      const rarity = ACHIEVEMENT_RARITY[ach.type] || 'common';
      const achXP = RARITY_XP[rarity] || 10;
      xpAchievements += achXP;
      console.log(`      - ${ach.type} (${rarity}): +${achXP} XP`);
    }
    totalXP += xpAchievements;
    breakdown['achievements'] = { count: achievements.length, xp: xpAchievements };

    // Calcular nível
    const calculatedLevel = calculateLevel(totalXP);
    const currentLevelXP = calculateCurrentLevelXP(totalXP, calculatedLevel);

    // Buscar nível atual
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: user.id }
    });

    console.log(`\n   📊 RESULTADO:`);
    console.log(`      XP Total Calculado: ${totalXP}`);
    console.log(`      Nível Calculado: ${calculatedLevel}`);
    console.log(`      XP Atual no Banco: ${userLevel?.totalXP || 0}`);
    console.log(`      Nível Atual no Banco: ${userLevel?.level || 1}`);

    const diff = totalXP - (userLevel?.totalXP || 0);
    if (diff !== 0) {
      console.log(`      ⚠️ Diferença: ${diff > 0 ? '+' : ''}${diff} XP`);
    }

    results.push({
      userId: user.id,
      username: user.username,
      name: user.name,
      currentXP: userLevel?.totalXP || 0,
      currentLevel: userLevel?.level || 1,
      calculatedXP: totalXP,
      calculatedLevel,
      currentLevelXP,
      diff,
      breakdown
    });
  }

  // Perguntar se quer aplicar as correções
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('   RESUMO DAS CORREÇÕES NECESSÁRIAS');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('| Usuário | XP Atual | XP Correto | Diferença | Nível Atual | Nível Correto |');
  console.log('|---------|----------|------------|-----------|-------------|---------------|');
  
  for (const r of results) {
    const diffStr = r.diff > 0 ? `+${r.diff}` : r.diff.toString();
    const status = r.diff !== 0 ? '⚠️' : '✅';
    console.log(`| ${r.name.padEnd(7)} | ${r.currentXP.toString().padStart(8)} | ${r.calculatedXP.toString().padStart(10)} | ${diffStr.padStart(9)} | ${r.currentLevel.toString().padStart(11)} | ${r.calculatedLevel.toString().padStart(13)} | ${status}`);
  }

  // Aplicar correções
  console.log('\n🔧 Aplicando correções...\n');

  for (const r of results) {
    if (r.diff !== 0 || r.currentLevel !== r.calculatedLevel) {
      await prisma.userLevel.upsert({
        where: { userId: r.userId },
        create: {
          userId: r.userId,
          totalXP: r.calculatedXP,
          level: r.calculatedLevel,
          xp: r.currentLevelXP,
          history: []
        },
        update: {
          totalXP: r.calculatedXP,
          level: r.calculatedLevel,
          xp: r.currentLevelXP
        }
      });
      console.log(`   ✅ ${r.name}: ${r.currentXP} → ${r.calculatedXP} XP, Nível ${r.currentLevel} → ${r.calculatedLevel}`);
    } else {
      console.log(`   ✓ ${r.name}: Já está correto`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n✅ Recálculo concluído!');
}

main().catch(console.error);
