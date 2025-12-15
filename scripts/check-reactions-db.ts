/**
 * Script de verificação de reações/emojis no banco de dados
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function checkReactions() {
  console.log('========================================');
  console.log('VERIFICACAO DE REACOES NO BANCO');
  console.log('========================================\n');

  // Ver amostra de reações
  const reactions = await prisma.messageReaction.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('Amostra de reacoes (ultimas 5):');
  console.log(JSON.stringify(reactions, null, 2));
  
  // Verificar se userId é username ou UUID
  const users = await prisma.user.findMany({ take: 5 });
  console.log('\nUsuarios no sistema:');
  users.forEach(u => {
    console.log(`  - ID: ${u.id}`);
    console.log(`    Username: ${u.username}`);
  });
  
  // Total de reações
  const totalReactions = await prisma.messageReaction.count();
  console.log(`\nTotal de reacoes no banco: ${totalReactions}`);
  
  // Contar reações por usuário
  console.log('\nReacoes por usuario:');
  const reactionsByUser = await prisma.messageReaction.groupBy({
    by: ['userId'],
    _count: { emoji: true }
  });
  
  for (const r of reactionsByUser) {
    // Contar emojis únicos
    const uniqueEmojis = await prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { userId: r.userId }
    });
    
    console.log(`  - ${r.userId}: ${uniqueEmojis.length} emojis unicos, ${r._count.emoji} reacoes totais`);
  }
  
  // Listar todos os emojis usados no sistema
  console.log('\nEmojis unicos no sistema:');
  const allEmojis = await prisma.messageReaction.groupBy({
    by: ['emoji'],
    _count: { emoji: true }
  });
  
  for (const e of allEmojis) {
    console.log(`  ${e.emoji}: ${e._count.emoji} vezes`);
  }

  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n========================================');
  console.log('VERIFICACAO CONCLUIDA');
  console.log('========================================');
}

checkReactions().catch(console.error);
