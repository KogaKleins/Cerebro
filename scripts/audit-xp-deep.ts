/**
 * 🔍 AUDITORIA PROFUNDA DE XP
 * Analisa todos os problemas do sistema de pontos
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  console.log('\n🔍 ═══════════════════════════════════════════════════');
  console.log('   AUDITORIA PROFUNDA DE XP');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Settings de XP
  console.log('📋 CONFIGURAÇÕES DE XP:');
  const settings = await prisma.setting.findMany();
  if (settings.length === 0) {
    console.log('   ⚠️ NENHUMA CONFIGURAÇÃO ENCONTRADA!');
  } else {
    settings.forEach(s => console.log(`   ${s.key}: ${JSON.stringify(s.value)}`));
  }

  // 2. Níveis atuais
  console.log('\n📊 NÍVEIS ATUAIS DOS USUÁRIOS:');
  const levels = await prisma.userLevel.findMany({
    include: { user: { select: { username: true, name: true } } }
  });
  
  for (const l of levels) {
    console.log(`   ${l.user.name} (${l.user.username}): Nível ${l.level}, ${l.totalXP} XP total, ${l.xp} XP no nível`);
  }

  // 3. Análise detalhada por usuário
  console.log('\n\n🔍 ANÁLISE DETALHADA POR USUÁRIO:');
  console.log('═══════════════════════════════════════════════════');

  const users = await prisma.user.findMany();
  
  for (const user of users) {
    console.log(`\n👤 ${user.name} (${user.username}):`);
    
    // Cafés feitos
    const coffeesMade = await prisma.coffee.count({
      where: { makerId: user.id, type: 'MADE' }
    });
    console.log(`   ☕ Cafés feitos: ${coffeesMade} (deveria dar ${coffeesMade * 15} XP @ 15 XP cada)`);
    
    // Cafés trazidos
    const coffeesBrought = await prisma.coffee.count({
      where: { makerId: user.id, type: 'BROUGHT' }
    });
    console.log(`   🎁 Cafés trazidos: ${coffeesBrought} (deveria dar ${coffeesBrought * 20} XP @ 20 XP cada)`);
    
    // Avaliações DADAS
    const ratingsGiven = await prisma.rating.count({
      where: { userId: user.id }
    });
    console.log(`   ⭐ Avaliações dadas: ${ratingsGiven} (deveria dar ${ratingsGiven * 5} XP @ 5 XP cada)`);
    
    // 5 estrelas RECEBIDAS
    const fiveStarsReceived = await prisma.rating.count({
      where: {
        rating: 5,
        coffee: { makerId: user.id }
      }
    });
    console.log(`   🌟 5 estrelas recebidas: ${fiveStarsReceived}`);
    
    // Média de avaliações recebidas
    const ratingsReceived = await prisma.rating.findMany({
      where: { coffee: { makerId: user.id } }
    });
    const avgRating = ratingsReceived.length > 0
      ? ratingsReceived.reduce((sum, r) => sum + r.rating, 0) / ratingsReceived.length
      : 0;
    console.log(`   📊 Média de avaliações: ${avgRating.toFixed(2)} (${ratingsReceived.length} avaliações)`);
    
    // Mensagens enviadas
    const messagesSent = await prisma.message.count({
      where: { authorId: user.id }
    });
    console.log(`   💬 Mensagens enviadas: ${messagesSent} (deveria dar ${messagesSent * 2} XP @ 2 XP cada)`);
    
    // Conquistas
    const achievements = await prisma.achievement.findMany({
      where: { userId: user.id }
    });
    console.log(`   🏆 Conquistas: ${achievements.length}`);
    achievements.forEach(a => console.log(`      - ${a.type}: ${a.title}`));
    
    // Calcular XP esperado
    const XP_RATES = {
      coffeeMade: 15,
      coffeeBrought: 20,
      ratingGiven: 5,
      messageSent: 2,
      achievementCommon: 10,
      achievementRare: 25,
      achievementEpic: 50,
      achievementLegendary: 100
    };
    
    // XP esperado de ações
    let expectedXP = 0;
    expectedXP += coffeesMade * XP_RATES.coffeeMade;
    expectedXP += coffeesBrought * XP_RATES.coffeeBrought;
    expectedXP += ratingsGiven * XP_RATES.ratingGiven;
    expectedXP += messagesSent * XP_RATES.messageSent;
    
    // XP esperado de conquistas (simplificado - todas como common por ora)
    expectedXP += achievements.length * XP_RATES.achievementCommon;
    
    // XP atual
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: user.id }
    });
    const currentXP = userLevel?.totalXP || 0;
    
    console.log(`\n   📈 XP ATUAL: ${currentXP}`);
    console.log(`   📈 XP ESPERADO (mínimo): ${expectedXP}`);
    console.log(`   📈 DIFERENÇA: ${expectedXP - currentXP} XP faltando!`);
    
    // Verificar conquistas faltando
    const EXPECTED_ACHIEVEMENTS: Record<string, { check: boolean, name: string }> = {
      'first-coffee': { check: coffeesMade >= 1, name: 'Primeiro Café' },
      'coffee-lover': { check: coffeesMade >= 10, name: 'Amante do Café' },
      'first-supply': { check: coffeesBrought >= 1, name: 'Primeiro Suprimento' },
      'five-stars': { check: fiveStarsReceived >= 1, name: '5 Estrelas' },
      'top-rated': { check: avgRating >= 4.5 && ratingsReceived.length >= 3, name: 'Mais Bem Avaliado' },
      'perfect-score': { check: avgRating === 5.0 && ratingsReceived.length >= 10, name: 'Nota Perfeita' },
      'first-rate': { check: ratingsGiven >= 1, name: 'Crítico' },
      'first-message': { check: messagesSent >= 1, name: 'Primeiro Contato' },
    };
    
    const missingAchievements = Object.entries(EXPECTED_ACHIEVEMENTS)
      .filter(([type, config]) => config.check && !achievements.some(a => a.type === type))
      .map(([type, config]) => `${config.name} (${type})`);
    
    if (missingAchievements.length > 0) {
      console.log(`\n   ⚠️ CONQUISTAS FALTANDO:`);
      missingAchievements.forEach(a => console.log(`      - ${a}`));
    }
  }

  // 4. Histórico de transações de XP
  console.log('\n\n📜 ÚLTIMAS 20 TRANSAÇÕES DE XP:');
  console.log('═══════════════════════════════════════════════════');
  
  const auditLogs = await prisma.xPAuditLog.findMany({
    take: 20,
    orderBy: { timestamp: 'desc' }
  });
  
  if (auditLogs.length === 0) {
    console.log('   ⚠️ NENHUMA TRANSAÇÃO ENCONTRADA!');
  } else {
    auditLogs.forEach(log => {
      console.log(`   ${log.timestamp.toISOString().split('T')[0]} | ${log.username} | +${log.amount} XP | ${log.reason}`);
    });
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
