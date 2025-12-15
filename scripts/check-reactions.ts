/**
 * Script para verificar reações no banco de dados
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('=== Verificando reações no banco de dados ===\n');
  
  // Buscar reações
  const reactions = await prisma.messageReaction.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Total de reações encontradas (últimas 20): ${reactions.length}`);
  
  if (reactions.length > 0) {
    console.log('\nReações:');
    reactions.forEach(r => {
      console.log(`  - ${r.emoji} por ${r.userId} na mensagem ${r.messageId.substring(0, 8)}... (${r.createdAt})`);
    });
  } else {
    console.log('\n⚠️ Nenhuma reação encontrada no banco de dados!');
  }
  
  // Buscar XP audit logs de reações
  const xpLogs = await prisma.xPAuditLog.findMany({
    where: {
      source: 'reaction'
    },
    take: 10,
    orderBy: { timestamp: 'desc' }
  });
  
  console.log(`\n=== Logs de XP para reações: ${xpLogs.length} ===`);
  xpLogs.forEach(log => {
    console.log(`  - ${log.username}: +${log.amount} XP (${log.reason})`);
  });
  
  // Verificar mensagens com replyTo
  const messagesWithReply = await prisma.message.findMany({
    where: {
      replyToId: { not: null }
    },
    take: 10,
    orderBy: { timestamp: 'desc' }
  });
  
  console.log(`\n=== Mensagens com replyTo: ${messagesWithReply.length} ===`);
  messagesWithReply.forEach(m => {
    console.log(`  - Mensagem ${m.id.substring(0, 8)}... respondendo a ${m.replyToId?.substring(0, 8)}...`);
  });
  
  // Contar total de reações
  const totalReactions = await prisma.messageReaction.count();
  console.log(`\n=== Total de reações no banco: ${totalReactions} ===`);
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
