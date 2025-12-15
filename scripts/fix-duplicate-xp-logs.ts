/**
 * 🔧 SCRIPT DE REMOÇÃO DE LOGS DUPLICADOS
 * 
 * Remove logs de XP duplicados mantendo apenas 1 por sourceId (mensagem, café, etc.)
 * 
 * Execução: npx ts-node scripts/fix-duplicate-xp-logs.ts
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
  console.log('   REMOÇÃO DE LOGS DE XP DUPLICADOS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar todos os logs de mensagens
  const allLogs = await prisma.xPAuditLog.findMany({
    where: { source: 'message', status: 'confirmed' },
    orderBy: { timestamp: 'asc' }
  });

  console.log(`📊 Total de logs de mensagem: ${allLogs.length}`);

  // Agrupar por messageId (extraído de sourceId ou sourceIdentifier)
  const byMessageId: Record<string, any[]> = {};

  for (const log of allLogs) {
    let messageId = log.sourceId;
    
    // Se não tem sourceId, tentar extrair do sourceIdentifier
    if (!messageId && log.sourceIdentifier) {
      // Formato backfill: message-sent-{messageId}
      const backfillMatch = log.sourceIdentifier.match(/message-sent-(.+)/);
      if (backfillMatch) {
        messageId = backfillMatch[1];
      } else {
        // Formato sistema: {userId}:message:{messageId}
        const parts = log.sourceIdentifier.split(':');
        if (parts.length >= 3 && parts[1] === 'message') {
          messageId = parts[2];
        }
      }
    }

    if (messageId) {
      const key = `${log.userId}:${messageId}`;
      if (!byMessageId[key]) byMessageId[key] = [];
      byMessageId[key].push(log);
    }
  }

  // Encontrar duplicatas
  const duplicates = Object.entries(byMessageId).filter(([_, logs]) => logs.length > 1);
  
  console.log(`📊 Grupos únicos (usuário:mensagem): ${Object.keys(byMessageId).length}`);
  console.log(`⚠️ Grupos com duplicatas: ${duplicates.length}`);

  if (duplicates.length === 0) {
    console.log('\n✅ Nenhuma duplicata encontrada!');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // Remover duplicatas (manter o primeiro, remover os demais)
  let totalRemoved = 0;
  const idsToRemove: string[] = [];

  for (const [_key, logs] of duplicates) {
    // Ordenar por timestamp, manter o primeiro
    logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Marcar todos exceto o primeiro para remoção
    for (let i = 1; i < logs.length; i++) {
      idsToRemove.push(logs[i].id);
    }
  }

  console.log(`\n🗑️ Logs a remover: ${idsToRemove.length}`);

  // Remover em batches
  const batchSize = 50;
  for (let i = 0; i < idsToRemove.length; i += batchSize) {
    const batch = idsToRemove.slice(i, i + batchSize);
    await prisma.xPAuditLog.deleteMany({
      where: { id: { in: batch } }
    });
    totalRemoved += batch.length;
    console.log(`   Removidos: ${totalRemoved}/${idsToRemove.length}`);
  }

  // Verificar resultado
  const remainingLogs = await prisma.xPAuditLog.count({
    where: { source: 'message', status: 'confirmed' }
  });

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`✅ CONCLUÍDO`);
  console.log(`   Removidos: ${totalRemoved} logs duplicados`);
  console.log(`   Restantes: ${remainingLogs} logs de mensagem`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Agora recalcular os saldos
  console.log('🔄 Recalculando saldos após remoção...\n');

  // Para cada usuário afetado, recalcular
  const affectedUsers = [...new Set(duplicates.map(([key]) => key.split(':')[0]))];
  
  for (const userId of affectedUsers) {
    const userLogs = await prisma.xPAuditLog.findMany({
      where: { userId, status: 'confirmed' },
      orderBy: { timestamp: 'asc' }
    });

    let runningBalance = 0;
    for (const log of userLogs) {
      const correctBefore = runningBalance;
      const correctAfter = runningBalance + log.amount;

      if (log.balanceBefore !== correctBefore || log.balanceAfter !== correctAfter) {
        await prisma.xPAuditLog.update({
          where: { id: log.id },
          data: { balanceBefore: correctBefore, balanceAfter: correctAfter }
        });
      }
      runningBalance = correctAfter;
    }

    // Atualizar userLevel
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      console.log(`   ${user.username}: saldo recalculado = ${runningBalance} XP`);
      
      // Atualizar totalXP do usuário
      await prisma.userLevel.update({
        where: { userId },
        data: { totalXP: runningBalance }
      });
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
