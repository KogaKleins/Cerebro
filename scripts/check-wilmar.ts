import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkWilmar() {
  console.log('\n=== VERIFICAÇÃO DE TRANSAÇÕES DE WILMAR ===\n');
  
  // Verificar TODAS as transações de Wilmar de message/reaction
  const wilmarLogs = await prisma.xPAuditLog.findMany({
    where: {
      username: 'wilmar',
      source: { in: ['message', 'reaction'] }
    },
    orderBy: { timestamp: 'desc' },
    take: 50
  });
  
  console.log('Transações de Wilmar (message/reaction):', wilmarLogs.length);
  console.log('\nÚltimas 10 transações:');
  wilmarLogs.slice(0, 10).forEach((l, i) => {
    console.log(`  ${i+1}. ${l.timestamp.toISOString()} | ${l.source} | +${l.amount} XP | ${l.sourceId?.substring(0, 35)}`);
  });
  
  // Verificar se o userId de Wilmar existe
  const wilmar = await prisma.user.findFirst({ where: { username: 'wilmar' } });
  console.log('\nWilmar user:', wilmar?.id, wilmar?.username);
  
  // Verificar userLevel
  if (wilmar) {
    const level = await prisma.userLevel.findUnique({ where: { userId: wilmar.id } });
    console.log('UserLevel:', JSON.stringify(level, null, 2));
  }
  
  // Contar mensagens enviadas por Wilmar
  if (wilmar) {
    const msgCount = await prisma.message.count({ where: { authorId: wilmar.id } });
    console.log('\nMensagens enviadas (Message):', msgCount);
    
    const reactionCount = await prisma.messageReaction.count({ where: { userId: wilmar.id } });
    console.log('Reações dadas (MessageReaction):', reactionCount);
  }
  
  await prisma.$disconnect();
}

checkWilmar().catch(console.error);
