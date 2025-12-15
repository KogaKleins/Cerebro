/**
 * Diagnóstico de duplicatas de XP de mensagens
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

  console.log('='.repeat(60));
  console.log('DIAGNOSTICO DE DUPLICATAS - MENSAGENS XP');
  console.log('='.repeat(60));

  // Buscar Wilmar
  const wilmar = await prisma.user.findUnique({ where: { username: 'wilmar' } });
  if (!wilmar) {
    console.log('Usuario wilmar nao encontrado!');
    return;
  }

  // Contar mensagens reais
  const totalMsgs = await prisma.message.count({ where: { authorId: wilmar.id } });
  console.log('\n📨 Mensagens REAIS no banco:', totalMsgs);

  // Buscar todos os logs de XP de mensagem
  const xpLogs = await prisma.xPAuditLog.findMany({
    where: { userId: wilmar.id, source: 'message', status: 'confirmed' },
    orderBy: { timestamp: 'asc' }
  });
  console.log('📊 Logs de XP por mensagem:', xpLogs.length);

  // Verificar sourceIdentifier duplicados
  const sourceIds: Record<string, number> = {};
  const duplicates: string[] = [];

  for (const log of xpLogs) {
    const key = log.sourceIdentifier || log.sourceId || 'unknown';
    sourceIds[key] = (sourceIds[key] || 0) + 1;
    if (sourceIds[key] > 1) {
      duplicates.push(key);
    }
  }

  console.log('\n== ANALISE DE DUPLICATAS ==');
  const uniqueSources = Object.keys(sourceIds).length;
  console.log('   Sources únicos:', uniqueSources);
  console.log('   Duplicatas encontradas:', duplicates.length);

  if (duplicates.length > 0) {
    console.log('\n   ⚠️ DUPLICATAS:');
    const uniqueDuplicates = [...new Set(duplicates)];
    for (const dup of uniqueDuplicates.slice(0, 10)) {
      console.log(`      ${dup}: ${sourceIds[dup]}x`);
    }
    if (uniqueDuplicates.length > 10) {
      console.log(`      ... e mais ${uniqueDuplicates.length - 10} duplicatas`);
    }
  }

  // Verificar se há logs sem sourceId
  const logsWithoutSource = xpLogs.filter(l => !l.sourceId && !l.sourceIdentifier);
  console.log('\n   Logs sem sourceId/sourceIdentifier:', logsWithoutSource.length);

  // Verificar se há sourceIds que não existem mais (mensagens deletadas permanentemente)
  const messageIds = xpLogs
    .map(l => l.sourceId)
    .filter(Boolean) as string[];
  
  const existingMessages = await prisma.message.findMany({
    where: { id: { in: messageIds } },
    select: { id: true }
  });
  const existingIds = new Set(existingMessages.map(m => m.id));
  const orphanLogs = messageIds.filter(id => !existingIds.has(id));
  
  console.log('\n   Logs com mensagem existente:', existingIds.size);
  console.log('   Logs órfãos (mensagem não existe):', orphanLogs.length);

  // Mostrar exemplos de duplicatas
  if (duplicates.length > 0) {
    console.log('\n== EXEMPLOS DE DUPLICATAS ==');
    const dupKey = [...new Set(duplicates)][0];
    const dupLogs = xpLogs.filter(l => (l.sourceIdentifier || l.sourceId) === dupKey);
    dupLogs.forEach((l, i) => {
      console.log(`   [${i + 1}] ID: ${l.id}`);
      console.log(`       Timestamp: ${l.timestamp.toISOString()}`);
      console.log(`       Amount: ${l.amount} XP`);
      console.log(`       Reason: ${l.reason}`);
      console.log(`       SourceId: ${l.sourceId}`);
      console.log(`       SourceIdentifier: ${l.sourceIdentifier}`);
      console.log('');
    });
  }

  // Resumo
  console.log('\n== RESUMO ==');
  const expectedLogs = totalMsgs; // 1 log por mensagem
  const extraLogs = xpLogs.length - expectedLogs;
  console.log(`   Esperado: ${expectedLogs} logs (1 por mensagem)`);
  console.log(`   Atual: ${xpLogs.length} logs`);
  console.log(`   Excesso: ${extraLogs} logs`);
  
  if (extraLogs > 0) {
    console.log(`\n   🔧 SOLUÇÃO: Remover ${extraLogs} logs duplicados`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
