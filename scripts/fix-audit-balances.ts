/**
 * 🔧 SCRIPT DE CORREÇÃO DE SALDOS NO XP AUDIT LOG
 * 
 * Este script recalcula balanceBefore/balanceAfter de forma incremental
 * para cada usuário, baseado na ordem cronológica das transações.
 * 
 * PROBLEMA: O script de backfill original usava o saldo ATUAL para
 * todas as transações retroativas, resultando em saldos duplicados.
 * 
 * SOLUÇÃO: Ordenar transações por timestamp e recalcular saldos
 * incrementalmente: transação N usa o balanceAfter da transação N-1.
 * 
 * Execução: npx ts-node scripts/fix-audit-balances.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('');
  console.log('🔧 ═══════════════════════════════════════════════════════════════');
  console.log('   CORREÇÃO DE SALDOS NO XP AUDIT LOG');
  console.log('   Recalculando balanceBefore/balanceAfter cronologicamente');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar todos os usuários com logs
  const users = await prisma.user.findMany({
    select: { id: true, username: true }
  });

  let totalFixed = 0;
  let totalUsers = 0;

  for (const user of users) {
    // Buscar TODOS os logs do usuário em ordem cronológica
    const logs = await prisma.xPAuditLog.findMany({
      where: { userId: user.id, status: 'confirmed' },
      orderBy: { timestamp: 'asc' }
    });

    if (logs.length === 0) continue;

    totalUsers++;
    let runningBalance = 0;
    let fixedThisUser = 0;

    console.log(`\n👤 ${user.username}: ${logs.length} transações`);

    for (const log of logs) {
      const correctBalanceBefore = runningBalance;
      const correctBalanceAfter = runningBalance + log.amount;

      // Verificar se precisa corrigir
      if (log.balanceBefore !== correctBalanceBefore || log.balanceAfter !== correctBalanceAfter) {
        await prisma.xPAuditLog.update({
          where: { id: log.id },
          data: {
            balanceBefore: correctBalanceBefore,
            balanceAfter: correctBalanceAfter
          }
        });
        fixedThisUser++;
      }

      // Atualizar saldo corrente
      runningBalance = correctBalanceAfter;
    }

    if (fixedThisUser > 0) {
      console.log(`   ✅ Corrigidos: ${fixedThisUser} registros`);
      console.log(`   📊 Saldo final: ${runningBalance}`);
      totalFixed += fixedThisUser;
    } else {
      console.log(`   ✓ Todos os saldos já estavam corretos`);
    }

    // Verificar e atualizar userLevel se necessário
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: user.id }
    });

    if (userLevel && userLevel.totalXP !== runningBalance) {
      console.log(`   ⚠️  UserLevel.totalXP (${userLevel.totalXP}) != Saldo calculado (${runningBalance})`);
      console.log(`   ℹ️  O totalXP pode incluir XP de fontes não registradas no audit log`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`📊 RESUMO:`);
  console.log(`   Usuários processados: ${totalUsers}`);
  console.log(`   Registros corrigidos: ${totalFixed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
