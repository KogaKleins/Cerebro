/**
 * 🔍 INVESTIGAR VALORES DE XP DE CONQUISTAS
 * Verificar se há inflação no XP de conquistas
 */

import 'dotenv/config';
import { getPrismaClient } from '../src/repositories';

const prisma = getPrismaClient();

async function investigateAchievementXP() {
  console.log('🔍 INVESTIGAÇÃO DE XP DE CONQUISTAS');
  console.log('════════════════════════════════════════════════════════════\n');

  // Buscar configuração de XP
  const xpConfig = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });

  console.log('📋 CONFIGURAÇÃO DE XP NO BANCO:');
  console.log('─────────────────────────────────');
  
  if (xpConfig) {
    const config = xpConfig.value as Record<string, { xp: number; name?: string }>;
    
    // Filtrar conquistas
    const achievementKeys = Object.entries(config)
      .filter(([key]) => key.startsWith('achievement'))
      .sort(([,a], [,b]) => b.xp - a.xp);
    
    console.log('\n🏆 XP DE CONQUISTAS (da configuração):');
    for (const [key, value] of achievementKeys) {
      console.log(`  • ${key}: ${value.xp} XP`);
    }
    
    console.log('\n\n📊 TODAS AS CONFIGURAÇÕES:');
    for (const [key, value] of Object.entries(config).sort(([,a], [,b]) => b.xp - a.xp)) {
      console.log(`  • ${key.padEnd(25)}: ${value.xp.toString().padStart(4)} XP`);
    }
  } else {
    console.log('  ⚠️ Configuração xp-config não encontrada no banco');
  }

  // Verificar transações de conquista no audit log
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 TRANSAÇÕES DE CONQUISTAS (último mês):');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const achievementTransactions = await prisma.xPAuditLog.findMany({
    where: {
      source: 'achievement',
      status: 'confirmed',
      timestamp: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    },
    orderBy: { amount: 'desc' }
  });

  // Agrupar por quantidade de XP
  const byAmount: Record<number, { count: number; reasons: string[] }> = {};
  for (const tx of achievementTransactions) {
    if (!byAmount[tx.amount]) {
      byAmount[tx.amount] = { count: 0, reasons: [] };
    }
    byAmount[tx.amount].count++;
    if (!byAmount[tx.amount].reasons.includes(tx.reason)) {
      byAmount[tx.amount].reasons.push(tx.reason);
    }
  }

  console.log('Distribuição de XP de conquistas:');
  for (const [amount, data] of Object.entries(byAmount).sort((a, b) => parseInt(b[0]) - parseInt(a[0]))) {
    console.log(`\n  ${amount} XP (${data.count}x):`);
    for (const reason of data.reasons.slice(0, 5)) {
      console.log(`    - ${reason}`);
    }
    if (data.reasons.length > 5) {
      console.log(`    ... e mais ${data.reasons.length - 5}`);
    }
  }

  // Total de XP por conquistas
  const totalAchievementXP = achievementTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  console.log(`\n📊 TOTAL DE XP DE CONQUISTAS: ${totalAchievementXP} XP`);
  console.log(`   Quantidade de transações: ${achievementTransactions.length}`);
  console.log(`   Média por conquista: ${achievementTransactions.length > 0 ? (totalAchievementXP / achievementTransactions.length).toFixed(1) : 0} XP`);

  // Verificar se há conquistas com valores muito altos
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('⚠️ CONQUISTAS COM XP ALTO (>200):');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const highXPAchievements = achievementTransactions.filter(tx => tx.amount > 200);
  if (highXPAchievements.length > 0) {
    for (const tx of highXPAchievements) {
      console.log(`  • ${tx.username.padEnd(12)} | ${tx.amount.toString().padStart(4)} XP | ${tx.reason}`);
    }
  } else {
    console.log('  ✅ Nenhuma conquista com XP acima de 200');
  }

  await prisma.$disconnect();
}

investigateAchievementXP().catch(console.error);
