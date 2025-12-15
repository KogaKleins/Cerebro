/**
 * AUDITORIA COMPLETA DE XP E NÍVEIS
 * Verifica todas as fontes de XP para cada usuário
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Tabela de XP por ação (deve corresponder às configurações do sistema)
const XP_TABLE = {
  // Café
  'coffee-made': 10,
  'coffee-brought': 15,
  
  // Avaliações
  'rating-given': 5,      // Quem avaliou
  'rating-4-star': 15,    // Quem recebeu 4 estrelas
  'rating-5-star': 30,    // Quem recebeu 5 estrelas
  
  // Mensagens
  'message-sent': 2,
  
  // Conquistas (variam por conquista)
  'achievement': 'varies',
};

// XP por conquista
const ACHIEVEMENT_XP: Record<string, number> = {
  'first-coffee': 25,
  'coffee-lover': 50,
  'coffee-addict': 100,
  'coffee-master': 200,
  'first-rating': 25,
  'rating-hero': 50,
  'generous-rater': 100,
  'rating-machine': 200,
  'five-star-received': 25,
  'rating-star': 50,
  'crowd-favorite': 100,
  'legendary-barista': 200,
  'early-bird': 25,
  'night-owl': 25,
  'weekend-warrior': 25,
  'monday-hero': 25,
  'friday-finisher': 25,
  'veteran-30': 50,
  'veteran-90': 100,
  'veteran-365': 200,
  'first-message': 10,
  'chatterbox': 25,
  'social-butterfly': 50,
  'community-pillar': 100,
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

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🔍 ═══════════════════════════════════════════════════');
  console.log('   AUDITORIA COMPLETA DE XP E NÍVEIS');
  console.log('═══════════════════════════════════════════════════\n');

  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  });

  const results: any[] = [];

  for (const user of users) {
    console.log(`\n👤 ══════════════════════════════════════════════════`);
    console.log(`   ${user.name} (@${user.username})`);
    console.log(`══════════════════════════════════════════════════\n`);

    // 1. Buscar nível atual no banco
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: user.id }
    });
    
    console.log(`📊 NÍVEL ATUAL NO BANCO:`);
    console.log(`   Nível: ${userLevel?.level || 'N/A'}`);
    console.log(`   XP Total: ${userLevel?.totalXP || 0}`);
    console.log(`   XP no nível atual: ${userLevel?.xp || 0}`);
    console.log('');

    // 2. Calcular XP esperado por CAFÉS FEITOS
    const coffeesMade = await prisma.coffee.count({
      where: { makerId: user.id, type: 'MADE' }
    });
    const xpCoffeesMade = coffeesMade * XP_TABLE['coffee-made'];
    console.log(`☕ CAFÉS FEITOS: ${coffeesMade} × ${XP_TABLE['coffee-made']} XP = ${xpCoffeesMade} XP`);

    // 3. Calcular XP esperado por CAFÉS TRAZIDOS
    const coffeesBrought = await prisma.coffee.count({
      where: { makerId: user.id, type: 'BROUGHT' }
    });
    const xpCoffeesBrought = coffeesBrought * XP_TABLE['coffee-brought'];
    console.log(`🛒 CAFÉS TRAZIDOS: ${coffeesBrought} × ${XP_TABLE['coffee-brought']} XP = ${xpCoffeesBrought} XP`);

    // 4. Calcular XP por AVALIAÇÕES DADAS
    const ratingsGiven = await prisma.rating.count({
      where: { userId: user.id }
    });
    const xpRatingsGiven = ratingsGiven * XP_TABLE['rating-given'];
    console.log(`⭐ AVALIAÇÕES DADAS: ${ratingsGiven} × ${XP_TABLE['rating-given']} XP = ${xpRatingsGiven} XP`);

    // 5. Calcular XP por AVALIAÇÕES RECEBIDAS (4 e 5 estrelas)
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
          xpRatingsReceived += XP_TABLE['rating-5-star'];
        } else if (rating.rating === 4) {
          ratings4Star++;
          xpRatingsReceived += XP_TABLE['rating-4-star'];
        }
      }
    }
    console.log(`🌟 AVALIAÇÕES 5⭐ RECEBIDAS: ${ratings5Star} × ${XP_TABLE['rating-5-star']} XP = ${ratings5Star * XP_TABLE['rating-5-star']} XP`);
    console.log(`⭐ AVALIAÇÕES 4⭐ RECEBIDAS: ${ratings4Star} × ${XP_TABLE['rating-4-star']} XP = ${ratings4Star * XP_TABLE['rating-4-star']} XP`);

    // 6. Calcular XP por MENSAGENS
    const messages = await prisma.message.count({
      where: { authorId: user.id }
    });
    const xpMessages = messages * XP_TABLE['message-sent'];
    console.log(`💬 MENSAGENS ENVIADAS: ${messages} × ${XP_TABLE['message-sent']} XP = ${xpMessages} XP`);

    // 7. Calcular XP por CONQUISTAS
    const achievements = await prisma.achievement.findMany({
      where: { userId: user.id }
    });
    
    let xpAchievements = 0;
    console.log(`\n🏆 CONQUISTAS (${achievements.length}):`);
    for (const ach of achievements) {
      const achXP = ACHIEVEMENT_XP[ach.type] || 0;
      xpAchievements += achXP;
      console.log(`   - ${ach.type}: +${achXP} XP (em ${new Date(ach.unlockedAt).toLocaleDateString('pt-BR')})`);
    }
    if (achievements.length === 0) {
      console.log(`   (nenhuma conquista)`);
    }

    // 8. Verificar XP Audit Log
    const auditLogs = await prisma.xPAuditLog.findMany({
      where: { userId: user.id, status: 'confirmed' },
      orderBy: { timestamp: 'desc' }
    });
    
    let xpFromAudit = 0;
    console.log(`\n📋 AUDIT LOG (${auditLogs.length} transações):`);
    const auditSummary: Record<string, { count: number; total: number }> = {};
    
    for (const log of auditLogs) {
      xpFromAudit += log.amount;
      if (!auditSummary[log.source]) {
        auditSummary[log.source] = { count: 0, total: 0 };
      }
      auditSummary[log.source].count++;
      auditSummary[log.source].total += log.amount;
    }
    
    for (const [source, data] of Object.entries(auditSummary)) {
      console.log(`   - ${source}: ${data.count} × = ${data.total} XP`);
    }
    console.log(`   TOTAL DO AUDIT LOG: ${xpFromAudit} XP`);

    // 9. Calcular XP ESPERADO TOTAL
    const xpExpected = xpCoffeesMade + xpCoffeesBrought + xpRatingsGiven + xpRatingsReceived + xpMessages + xpAchievements;
    const expectedLevel = calculateLevel(xpExpected);
    
    console.log(`\n📊 ═══════════════════════════════════════════════`);
    console.log(`   RESUMO PARA ${user.name}`);
    console.log(`═══════════════════════════════════════════════`);
    console.log(`   XP por cafés feitos:       ${xpCoffeesMade}`);
    console.log(`   XP por cafés trazidos:     ${xpCoffeesBrought}`);
    console.log(`   XP por avaliações dadas:   ${xpRatingsGiven}`);
    console.log(`   XP por avaliações 4-5⭐:   ${xpRatingsReceived}`);
    console.log(`   XP por mensagens:          ${xpMessages}`);
    console.log(`   XP por conquistas:         ${xpAchievements}`);
    console.log(`   ─────────────────────────────────────────────`);
    console.log(`   XP ESPERADO TOTAL:         ${xpExpected}`);
    console.log(`   NÍVEL ESPERADO:            ${expectedLevel}`);
    console.log(`   ─────────────────────────────────────────────`);
    console.log(`   XP ATUAL NO BANCO:         ${userLevel?.totalXP || 0}`);
    console.log(`   NÍVEL ATUAL NO BANCO:      ${userLevel?.level || 1}`);
    console.log(`   XP DO AUDIT LOG:           ${xpFromAudit}`);
    
    const diff = xpExpected - (userLevel?.totalXP || 0);
    if (diff !== 0) {
      console.log(`\n   ⚠️ DIFERENÇA: ${diff > 0 ? '+' : ''}${diff} XP`);
      if (diff > 0) {
        console.log(`   ❌ USUÁRIO TEM MENOS XP DO QUE DEVERIA!`);
      } else {
        console.log(`   ⚠️ Usuário tem mais XP do que calculado (pode haver ações manuais)`);
      }
    } else {
      console.log(`\n   ✅ XP CORRETO!`);
    }

    results.push({
      user: user.name,
      username: user.username,
      currentXP: userLevel?.totalXP || 0,
      currentLevel: userLevel?.level || 1,
      expectedXP: xpExpected,
      expectedLevel,
      xpFromAudit,
      diff,
      breakdown: {
        coffeesMade: { count: coffeesMade, xp: xpCoffeesMade },
        coffeesBrought: { count: coffeesBrought, xp: xpCoffeesBrought },
        ratingsGiven: { count: ratingsGiven, xp: xpRatingsGiven },
        ratings4Star: { count: ratings4Star, xp: ratings4Star * XP_TABLE['rating-4-star'] },
        ratings5Star: { count: ratings5Star, xp: ratings5Star * XP_TABLE['rating-5-star'] },
        messages: { count: messages, xp: xpMessages },
        achievements: { count: achievements.length, xp: xpAchievements }
      }
    });
  }

  // Resumo geral
  console.log(`\n\n🔍 ═══════════════════════════════════════════════════`);
  console.log(`   RESUMO GERAL`);
  console.log(`═══════════════════════════════════════════════════\n`);
  
  console.log('| Usuário | XP Atual | XP Esperado | Diferença | Nível Atual | Nível Esperado |');
  console.log('|---------|----------|-------------|-----------|-------------|----------------|');
  
  for (const r of results) {
    const diffStr = r.diff > 0 ? `+${r.diff}` : r.diff.toString();
    const status = r.diff !== 0 ? '❌' : '✅';
    console.log(`| ${r.user.padEnd(7)} | ${r.currentXP.toString().padStart(8)} | ${r.expectedXP.toString().padStart(11)} | ${diffStr.padStart(9)} | ${r.currentLevel.toString().padStart(11)} | ${r.expectedLevel.toString().padStart(14)} | ${status}`);
  }

  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n✅ Auditoria concluída!');
}

main().catch(console.error);
