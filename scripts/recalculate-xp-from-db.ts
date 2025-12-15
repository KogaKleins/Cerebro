/**
 * RECÁLCULO CORRETO DE XP E NÍVEIS
 * USA AS CONFIGURAÇÕES DO BANCO DE DADOS
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Mapeamento de conquistas para suas raridades (do definitions.js)
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
  'top-rated': 'epic',  // Média > 4.5 = EPIC = 1500 XP
  'crowd-favorite': 'epic',
  'legendary-barista': 'legendary',
  
  // Special Time
  'early-bird': 'rare',
  'night-owl': 'rare',
  'weekend-warrior': 'rare',
  'monday-hero': 'rare',      // RARA = 500 XP
  'friday-finisher': 'rare',  // RARA = 500 XP
  
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
  console.log('   (Usando configurações do banco de dados)');
  console.log('═══════════════════════════════════════════════════\n');

  // Buscar configurações de XP do banco
  const xpConfigSetting = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });
  
  const xpConfig = xpConfigSetting?.value as Record<string, { xp: number }> || {};
  
  console.log('📊 CONFIGURAÇÕES DE XP DO BANCO:');
  console.log(`   coffee-made: ${xpConfig['coffee-made']?.xp || 'N/A'} XP`);
  console.log(`   coffee-brought: ${xpConfig['coffee-brought']?.xp || 'N/A'} XP`);
  console.log(`   rating-given: ${xpConfig['rating-given']?.xp || 'N/A'} XP`);
  console.log(`   five-star-received: ${xpConfig['five-star-received']?.xp || 'N/A'} XP`);
  console.log(`   message-sent: ${xpConfig['message-sent']?.xp || 'N/A'} XP`);
  console.log(`   achievement-common: ${xpConfig['achievement-common']?.xp || 'N/A'} XP`);
  console.log(`   achievement-rare: ${xpConfig['achievement-rare']?.xp || 'N/A'} XP`);
  console.log(`   achievement-epic: ${xpConfig['achievement-epic']?.xp || 'N/A'} XP`);
  console.log(`   achievement-legendary: ${xpConfig['achievement-legendary']?.xp || 'N/A'} XP`);
  console.log(`   achievement-platinum: ${xpConfig['achievement-platinum']?.xp || 'N/A'} XP`);

  // Valores de XP do banco
  const XP = {
    coffeeMade: xpConfig['coffee-made']?.xp || 25,
    coffeeBrought: xpConfig['coffee-brought']?.xp || 150,
    ratingGiven: xpConfig['rating-given']?.xp || 3,
    fiveStarReceived: xpConfig['five-star-received']?.xp || 30,
    fourStarReceived: 15, // Metade do 5 estrelas
    messageSent: xpConfig['message-sent']?.xp || 1,
    achievementCommon: xpConfig['achievement-common']?.xp || 50,
    achievementRare: xpConfig['achievement-rare']?.xp || 500,
    achievementEpic: xpConfig['achievement-epic']?.xp || 1500,
    achievementLegendary: xpConfig['achievement-legendary']?.xp || 3000,
    achievementPlatinum: xpConfig['achievement-platinum']?.xp || 5000,
  };

  const RARITY_XP: Record<string, number> = {
    'common': XP.achievementCommon,
    'rare': XP.achievementRare,
    'epic': XP.achievementEpic,
    'legendary': XP.achievementLegendary,
    'platinum': XP.achievementPlatinum,
  };

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  const results: any[] = [];

  for (const user of users) {
    console.log(`\n\n👤 ══════════════════════════════════════════════════`);
    console.log(`   ${user.name} (@${user.username})`);
    console.log(`══════════════════════════════════════════════════\n`);

    let totalXP = 0;

    // 1. XP por CAFÉS FEITOS
    const coffeesMade = await prisma.coffee.count({
      where: { makerId: user.id, type: 'MADE' }
    });
    const xpCoffeesMade = coffeesMade * XP.coffeeMade;
    totalXP += xpCoffeesMade;
    console.log(`   ☕ Cafés feitos: ${coffeesMade} × ${XP.coffeeMade} = ${xpCoffeesMade} XP`);

    // 2. XP por CAFÉS TRAZIDOS
    const coffeesBrought = await prisma.coffee.count({
      where: { makerId: user.id, type: 'BROUGHT' }
    });
    const xpCoffeesBrought = coffeesBrought * XP.coffeeBrought;
    totalXP += xpCoffeesBrought;
    console.log(`   🛒 Cafés trazidos: ${coffeesBrought} × ${XP.coffeeBrought} = ${xpCoffeesBrought} XP`);

    // 3. XP por AVALIAÇÕES DADAS
    const ratingsGiven = await prisma.rating.count({
      where: { userId: user.id }
    });
    const xpRatingsGiven = ratingsGiven * XP.ratingGiven;
    totalXP += xpRatingsGiven;
    console.log(`   ⭐ Avaliações dadas: ${ratingsGiven} × ${XP.ratingGiven} = ${xpRatingsGiven} XP`);

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
          xpRatingsReceived += XP.fiveStarReceived;
        } else if (rating.rating === 4) {
          ratings4Star++;
          xpRatingsReceived += XP.fourStarReceived;
        }
      }
    }
    totalXP += xpRatingsReceived;
    console.log(`   🌟 Avaliações 5⭐ recebidas: ${ratings5Star} × ${XP.fiveStarReceived} = ${ratings5Star * XP.fiveStarReceived} XP`);
    console.log(`   ⭐ Avaliações 4⭐ recebidas: ${ratings4Star} × ${XP.fourStarReceived} = ${ratings4Star * XP.fourStarReceived} XP`);

    // 5. XP por MENSAGENS
    const messages = await prisma.message.count({
      where: { authorId: user.id }
    });
    const xpMessages = messages * XP.messageSent;
    totalXP += xpMessages;
    console.log(`   💬 Mensagens: ${messages} × ${XP.messageSent} = ${xpMessages} XP`);

    // 6. XP por CONQUISTAS
    const achievements = await prisma.achievement.findMany({
      where: { userId: user.id }
    });
    
    let xpAchievements = 0;
    console.log(`\n   🏆 CONQUISTAS (${achievements.length}):`);
    
    for (const ach of achievements) {
      const rarity = ACHIEVEMENT_RARITY[ach.type] || 'common';
      const achXP = RARITY_XP[rarity] || XP.achievementCommon;
      xpAchievements += achXP;
      console.log(`      - ${ach.type} (${rarity.toUpperCase()}): +${achXP} XP`);
    }
    if (achievements.length === 0) {
      console.log(`      (nenhuma conquista)`);
    }
    
    totalXP += xpAchievements;
    console.log(`      TOTAL CONQUISTAS: ${xpAchievements} XP`);

    // Calcular nível
    const calculatedLevel = calculateLevel(totalXP);
    const currentLevelXP = calculateCurrentLevelXP(totalXP, calculatedLevel);

    // Buscar nível atual
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: user.id }
    });

    console.log(`\n   📊 ═══════════════════════════════════════════════`);
    console.log(`      RESUMO`);
    console.log(`   ═══════════════════════════════════════════════`);
    console.log(`      XP Cafés Feitos:       ${xpCoffeesMade}`);
    console.log(`      XP Cafés Trazidos:     ${xpCoffeesBrought}`);
    console.log(`      XP Avaliações Dadas:   ${xpRatingsGiven}`);
    console.log(`      XP Avaliações 4-5⭐:   ${xpRatingsReceived}`);
    console.log(`      XP Mensagens:          ${xpMessages}`);
    console.log(`      XP Conquistas:         ${xpAchievements}`);
    console.log(`      ─────────────────────────────────────────────`);
    console.log(`      XP TOTAL CALCULADO:    ${totalXP}`);
    console.log(`      NÍVEL CALCULADO:       ${calculatedLevel}`);
    console.log(`      ─────────────────────────────────────────────`);
    console.log(`      XP ATUAL NO BANCO:     ${userLevel?.totalXP || 0}`);
    console.log(`      NÍVEL ATUAL NO BANCO:  ${userLevel?.level || 1}`);

    const diff = totalXP - (userLevel?.totalXP || 0);
    if (diff !== 0) {
      console.log(`\n      ⚠️ DIFERENÇA: ${diff > 0 ? '+' : ''}${diff} XP`);
      if (diff > 0) {
        console.log(`      ❌ USUÁRIO TEM MENOS XP DO QUE DEVERIA!`);
      }
    } else {
      console.log(`\n      ✅ XP CORRETO!`);
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
      diff
    });
  }

  // Resumo geral
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('   RESUMO GERAL');
  console.log('═══════════════════════════════════════════════════\n');

  console.log('| Usuário | XP Atual | XP Correto | Diferença | Nível Atual | Nível Correto |');
  console.log('|---------|----------|------------|-----------|-------------|---------------|');
  
  for (const r of results) {
    const diffStr = r.diff > 0 ? `+${r.diff}` : r.diff.toString();
    const status = r.diff !== 0 ? '⚠️' : '✅';
    console.log(`| ${r.name.padEnd(7)} | ${r.currentXP.toString().padStart(8)} | ${r.calculatedXP.toString().padStart(10)} | ${diffStr.padStart(9)} | ${r.currentLevel.toString().padStart(11)} | ${r.calculatedLevel.toString().padStart(13)} | ${status}`);
  }

  // Aplicar correções
  console.log('\n\n🔧 APLICANDO CORREÇÕES...\n');

  for (const r of results) {
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
    
    if (r.diff !== 0) {
      console.log(`   ✅ ${r.name}: ${r.currentXP} → ${r.calculatedXP} XP, Nível ${r.currentLevel} → ${r.calculatedLevel}`);
    } else {
      console.log(`   ✓ ${r.name}: Já está correto (${r.calculatedXP} XP, Nível ${r.calculatedLevel})`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n✅ Recálculo concluído!');
}

main().catch(console.error);
