/**
 * 🔍 DIAGNÓSTICO DE PERSISTÊNCIA DE XP
 * 
 * Este script verifica se TODAS as ações que dão XP estão sendo
 * corretamente persistidas no banco de dados.
 * 
 * Execução: npx tsx scripts/diagnose-xp-persistence.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface DiagnosticResult {
  action: string;
  description: string;
  tablePersisted: string;
  status: 'OK' | 'PROBLEMA' | 'AVISO';
  details: string;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('');
  console.log('🔍 ═══════════════════════════════════════════════════════════════');
  console.log('   DIAGNÓSTICO DE PERSISTÊNCIA DE XP');
  console.log('   Verificando se todas as ações que dão XP estão no banco');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const results: DiagnosticResult[] = [];

  // ═══════════════════════════════════════════════════════════════
  // ☕ CAFÉ
  // ═══════════════════════════════════════════════════════════════
  console.log('☕ CAFÉ\n');

  // coffee-made
  const coffeesMade = await prisma.coffee.count({ where: { type: 'MADE' } });
  const auditCoffeeMade = await prisma.xPAuditLog.count({ where: { source: 'coffee-made' } });
  results.push({
    action: 'coffee-made',
    description: 'Fazer café (50 XP)',
    tablePersisted: 'coffees + xp_audit_logs',
    status: auditCoffeeMade >= coffeesMade ? 'OK' : 'PROBLEMA',
    details: `Cafés: ${coffeesMade}, Audits: ${auditCoffeeMade}`
  });
  console.log(`   coffee-made: Cafés=${coffeesMade}, Audits=${auditCoffeeMade} ${auditCoffeeMade >= coffeesMade ? '✅' : '❌'}`);

  // coffee-brought
  const coffeesBrought = await prisma.coffee.count({ where: { type: 'BROUGHT' } });
  const auditCoffeeBrought = await prisma.xPAuditLog.count({ where: { source: 'coffee-brought' } });
  results.push({
    action: 'coffee-brought',
    description: 'Trazer café (75 XP)',
    tablePersisted: 'coffees + xp_audit_logs',
    status: auditCoffeeBrought >= coffeesBrought ? 'OK' : 'PROBLEMA',
    details: `Cafés: ${coffeesBrought}, Audits: ${auditCoffeeBrought}`
  });
  console.log(`   coffee-brought: Cafés=${coffeesBrought}, Audits=${auditCoffeeBrought} ${auditCoffeeBrought >= coffeesBrought ? '✅' : '❌'}`);

  // ═══════════════════════════════════════════════════════════════
  // 🍞 ITENS ESPECIAIS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🍞 ITENS ESPECIAIS\n');
  
  const specialItems = ['filtro-cafe', 'bolo', 'bolo-supreme', 'bolacha', 'bolacha-recheada', 'biscoito', 'sonho'];
  for (const item of specialItems) {
    const auditCount = await prisma.xPAuditLog.count({ where: { source: item } });
    // Itens especiais são armazenados como BROUGHT com description
    const status = auditCount > 0 ? 'OK' : 'AVISO';
    results.push({
      action: item,
      description: `Item especial: ${item}`,
      tablePersisted: 'xp_audit_logs (coffees como BROUGHT)',
      status,
      details: `Audits: ${auditCount} - ${auditCount === 0 ? 'Nenhum registrado ainda OU não persistido' : 'Encontrado'}`
    });
    console.log(`   ${item}: Audits=${auditCount} ${auditCount > 0 ? '✅' : '⚠️ Nenhum ou não persistido'}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // ⭐ AVALIAÇÕES
  // ═══════════════════════════════════════════════════════════════
  console.log('\n⭐ AVALIAÇÕES\n');

  // rating-given
  const totalRatings = await prisma.rating.count();
  const auditRatingGiven = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { source: 'rating' },
        { reason: { contains: 'Avaliou' } },
        { reason: { contains: 'avaliar' } }
      ]
    } 
  });
  results.push({
    action: 'rating-given',
    description: 'Avaliar café (15 XP)',
    tablePersisted: 'ratings + xp_audit_logs',
    status: auditRatingGiven >= totalRatings ? 'OK' : 'PROBLEMA',
    details: `Ratings: ${totalRatings}, Audits: ${auditRatingGiven}`
  });
  console.log(`   rating-given: Ratings=${totalRatings}, Audits=${auditRatingGiven} ${auditRatingGiven >= totalRatings ? '✅' : '❌'}`);

  // five-star-received / four-star-received
  const fiveStarRatings = await prisma.rating.count({ where: { rating: 5 } });
  const fourStarRatings = await prisma.rating.count({ where: { rating: 4 } });
  const auditFiveStar = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { reason: { contains: '5 estrelas' } },
        { reason: { contains: '⭐⭐⭐⭐⭐' } },
        { sourceId: { contains: '5star' } }
      ]
    } 
  });
  const auditFourStar = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { reason: { contains: '4 estrelas' } },
        { reason: { contains: '⭐⭐⭐⭐' } },
        { sourceId: { contains: '4star' } }
      ]
    } 
  });
  results.push({
    action: 'five-star-received',
    description: 'Receber 5 estrelas (30 XP)',
    tablePersisted: 'ratings + xp_audit_logs',
    status: auditFiveStar >= fiveStarRatings ? 'OK' : 'PROBLEMA',
    details: `5⭐ ratings: ${fiveStarRatings}, Audits: ${auditFiveStar}`
  });
  results.push({
    action: 'four-star-received',
    description: 'Receber 4 estrelas (15 XP)',
    tablePersisted: 'ratings + xp_audit_logs',
    status: auditFourStar >= fourStarRatings * 0.5 ? 'OK' : 'AVISO', // 50% é OK pois nem sempre 4 estrelas gera XP
    details: `4⭐ ratings: ${fourStarRatings}, Audits: ${auditFourStar}`
  });
  console.log(`   five-star-received: 5⭐=${fiveStarRatings}, Audits=${auditFiveStar} ${auditFiveStar >= fiveStarRatings ? '✅' : '❌'}`);
  console.log(`   four-star-received: 4⭐=${fourStarRatings}, Audits=${auditFourStar} ${auditFourStar > 0 ? '✅' : '⚠️'}`);

  // ═══════════════════════════════════════════════════════════════
  // 💬 CHAT
  // ═══════════════════════════════════════════════════════════════
  console.log('\n💬 CHAT\n');

  // message-sent
  const totalMessages = await prisma.message.count();
  const auditMessages = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { source: 'message' },
        { reason: { contains: 'mensagem' } },
        { reason: { contains: 'Mensagem' } }
      ]
    } 
  });
  results.push({
    action: 'message-sent',
    description: 'Enviar mensagem (1 XP)',
    tablePersisted: 'messages + xp_audit_logs',
    status: auditMessages >= totalMessages * 0.8 ? 'OK' : 'PROBLEMA', // 80% é aceitável por limites diários
    details: `Mensagens: ${totalMessages}, Audits: ${auditMessages}`
  });
  console.log(`   message-sent: Mensagens=${totalMessages}, Audits=${auditMessages} ${auditMessages >= totalMessages * 0.5 ? '✅' : '❌'}`);

  // reaction-given / reaction-received
  const totalReactions = await prisma.messageReaction.count();
  const auditReactionsGiven = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { sourceId: { contains: 'reaction-' } },
        { reason: { contains: 'Reagiu' } },
        { reason: { contains: 'reação' } }
      ]
    } 
  });
  results.push({
    action: 'reaction-given',
    description: 'Reagir mensagem (3 XP)',
    tablePersisted: 'message_reactions + xp_audit_logs',
    status: totalReactions === 0 || auditReactionsGiven > 0 ? 'OK' : 'PROBLEMA',
    details: `Reações: ${totalReactions}, Audits: ${auditReactionsGiven}`
  });
  console.log(`   reaction-given: Reações=${totalReactions}, Audits=${auditReactionsGiven} ${auditReactionsGiven > 0 || totalReactions === 0 ? '✅' : '❌'}`);
  console.log(`   reaction-received: (verificado junto com reaction-given)`);

  // ═══════════════════════════════════════════════════════════════
  // 🏆 CONQUISTAS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🏆 CONQUISTAS\n');

  const totalAchievements = await prisma.achievement.count();
  const auditAchievements = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { source: 'achievement' },
        { reason: { contains: 'conquista' } },
        { reason: { contains: 'Desbloqueou' } }
      ]
    } 
  });
  results.push({
    action: 'achievement-*',
    description: 'Conquistas (25-500 XP)',
    tablePersisted: 'achievements + xp_audit_logs',
    status: auditAchievements >= totalAchievements ? 'OK' : 'PROBLEMA',
    details: `Conquistas: ${totalAchievements}, Audits: ${auditAchievements}`
  });
  console.log(`   achievement-*: Conquistas=${totalAchievements}, Audits=${auditAchievements} ${auditAchievements >= totalAchievements ? '✅' : '❌'}`);

  // ═══════════════════════════════════════════════════════════════
  // ✨ AÇÕES ESPECIAIS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n✨ AÇÕES ESPECIAIS\n');

  // daily-login
  const totalLogins = await prisma.dailyLogin.count();
  const auditDailyLogin = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { sourceId: { contains: 'daily-login' } },
        { reason: { contains: 'Login diário' } }
      ]
    } 
  });
  results.push({
    action: 'daily-login',
    description: 'Login diário (10 XP)',
    tablePersisted: 'daily_logins + xp_audit_logs',
    status: auditDailyLogin >= totalLogins ? 'OK' : 'PROBLEMA',
    details: `Logins: ${totalLogins}, Audits: ${auditDailyLogin}`
  });
  console.log(`   daily-login: Logins=${totalLogins}, Audits=${auditDailyLogin} ${auditDailyLogin >= totalLogins ? '✅' : '❌'}`);

  // streak-bonus
  const auditStreakBonus = await prisma.xPAuditLog.count({ 
    where: { 
      OR: [
        { sourceId: { contains: 'streak-bonus' } },
        { reason: { contains: 'Bônus de sequência' } },
        { reason: { contains: 'streak' } }
      ]
    } 
  });
  results.push({
    action: 'streak-bonus',
    description: 'Bônus de sequência (5-100 XP)',
    tablePersisted: 'xp_audit_logs (sem tabela própria)',
    status: auditStreakBonus > 0 ? 'OK' : 'AVISO',
    details: `Audits: ${auditStreakBonus}`
  });
  console.log(`   streak-bonus: Audits=${auditStreakBonus} ${auditStreakBonus > 0 ? '✅' : '⚠️ Nenhum ainda'}`);

  // early-coffee, late-coffee, weekend-coffee (conquistados via achievements)
  const specialTimeAchievements = ['early-bird', 'night-owl', 'weekend-warrior'];
  for (const achType of specialTimeAchievements) {
    const count = await prisma.achievement.count({ where: { type: achType } });
    console.log(`   ${achType}: ${count} conquistas ${count > 0 ? '✅' : '⚠️'}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 📊 RESUMO
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n📊 ═══════════════════════════════════════════════════════════════');
  console.log('   RESUMO DO DIAGNÓSTICO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const ok = results.filter(r => r.status === 'OK').length;
  const problems = results.filter(r => r.status === 'PROBLEMA').length;
  const warnings = results.filter(r => r.status === 'AVISO').length;

  console.log(`   ✅ OK: ${ok}`);
  console.log(`   ❌ PROBLEMAS: ${problems}`);
  console.log(`   ⚠️ AVISOS: ${warnings}`);

  if (problems > 0) {
    console.log('\n   🚨 AÇÕES COM PROBLEMAS DE PERSISTÊNCIA:\n');
    for (const r of results.filter(r => r.status === 'PROBLEMA')) {
      console.log(`      - ${r.action}: ${r.details}`);
    }
  }

  if (warnings > 0) {
    console.log('\n   ⚠️ AVISOS (pode ser normal):\n');
    for (const r of results.filter(r => r.status === 'AVISO')) {
      console.log(`      - ${r.action}: ${r.details}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 🔧 ANÁLISE DE ITENS ESPECIAIS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\n🔧 ═══════════════════════════════════════════════════════════════');
  console.log('   ANÁLISE: ITENS ESPECIAIS (filtro, bolo, etc.)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar cafés BROUGHT com descrições que possam ser itens especiais
  const broughtWithDesc = await prisma.coffee.findMany({
    where: { 
      type: 'BROUGHT',
      description: { not: null }
    },
    select: { description: true },
    take: 100
  });
  
  console.log(`   Cafés BROUGHT com descrição: ${broughtWithDesc.length}`);
  console.log('   Descrições encontradas:');
  const descCounts: Record<string, number> = {};
  for (const c of broughtWithDesc) {
    const desc = c.description?.toLowerCase() || 'vazio';
    descCounts[desc] = (descCounts[desc] || 0) + 1;
  }
  for (const [desc, count] of Object.entries(descCounts)) {
    console.log(`      - "${desc}": ${count}`);
  }

  console.log('\n   ⚠️ NOTA: Itens especiais (filtro, bolo, etc.) parecem ser');
  console.log('   armazenados apenas no FRONTEND, não no backend!');
  console.log('   Isso significa que ao recalcular XP, eles serão PERDIDOS.');

  await prisma.$disconnect();
  await pool.end();

  console.log('\n\n✅ Diagnóstico concluído!\n');
}

main().catch(console.error);
