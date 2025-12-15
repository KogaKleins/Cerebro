/**
 * Análise detalhada dos logs de mensagem
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

  const wilmar = await prisma.user.findUnique({ where: { username: 'wilmar' } });
  if (!wilmar) return;

  // Buscar todos os logs de XP de mensagem
  const xpLogs = await prisma.xPAuditLog.findMany({
    where: { userId: wilmar.id, source: 'message', status: 'confirmed' },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      sourceId: true,
      sourceIdentifier: true,
      reason: true,
      timestamp: true,
      amount: true
    }
  });

  // Buscar mensagens reais
  const messages = await prisma.message.findMany({
    where: { authorId: wilmar.id },
    select: { id: true }
  });
  const messageIds = new Set(messages.map(m => m.id));

  console.log('Mensagens no banco:', messages.length);
  console.log('Logs de XP:', xpLogs.length);
  console.log('\n== LOGS DE XP ==\n');

  // Agrupar por sourceId
  const bySourceId: Record<string, any[]> = {};
  
  for (const log of xpLogs) {
    // Extrair messageId do sourceIdentifier (formato: message-sent-{messageId})
    let msgId = log.sourceId;
    if (!msgId && log.sourceIdentifier) {
      const match = log.sourceIdentifier.match(/message-sent-(.+)/);
      if (match) msgId = match[1];
    }
    
    const key = msgId || 'unknown';
    if (!bySourceId[key]) bySourceId[key] = [];
    bySourceId[key].push(log);
  }

  // Verificar duplicatas reais (mesmo messageId, múltiplos logs)
  const duplicates = Object.entries(bySourceId).filter(([_, logs]) => logs.length > 1);
  
  console.log('MessageIds únicos com logs:', Object.keys(bySourceId).length);
  console.log('MessageIds com múltiplos logs:', duplicates.length);

  if (duplicates.length > 0) {
    console.log('\n⚠️ DUPLICATAS ENCONTRADAS:');
    for (const [msgId, logs] of duplicates.slice(0, 5)) {
      console.log(`\n  MessageId: ${msgId}`);
      console.log(`  Existe no banco? ${messageIds.has(msgId) ? 'SIM' : 'NAO'}`);
      for (const log of logs) {
        console.log(`    - ${log.id.slice(0, 8)}... | ${log.timestamp.toISOString().slice(0, 19)} | ${log.reason}`);
      }
    }
  }

  // Verificar logs que apontam para mensagens que não existem
  const orphanLogs: any[] = [];
  for (const [msgId, logs] of Object.entries(bySourceId)) {
    if (msgId !== 'unknown' && !messageIds.has(msgId)) {
      orphanLogs.push(...logs);
    }
  }

  console.log('\n== LOGS ÓRFÃOS (mensagem não existe) ==');
  console.log('Total:', orphanLogs.length);
  
  if (orphanLogs.length > 0) {
    console.log('\nExemplos:');
    for (const log of orphanLogs.slice(0, 5)) {
      console.log(`  - ${log.sourceIdentifier || log.sourceId} | ${log.reason}`);
    }
  }

  // Verificar patterns diferentes de sourceIdentifier
  const patterns: Record<string, number> = {};
  for (const log of xpLogs) {
    const si = log.sourceIdentifier || '';
    let pattern = 'unknown';
    if (si.startsWith('message-sent-')) pattern = 'message-sent-{id}';
    else if (si.startsWith('message-')) pattern = 'message-{id}';
    else if (si) pattern = si.split('-').slice(0, 2).join('-') + '-...';
    
    patterns[pattern] = (patterns[pattern] || 0) + 1;
  }

  console.log('\n== PATTERNS DE SOURCE IDENTIFIER ==');
  for (const [pattern, count] of Object.entries(patterns)) {
    console.log(`  ${pattern}: ${count}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
