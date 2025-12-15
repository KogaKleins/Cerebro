/**
 * Verificar estrutura de reações e corrigir conquistas
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter, log: ['error'] });

async function checkReactions() {
  try {
    console.log('\n=== VERIFICANDO ESTRUTURA DE REACOES ===\n');
    
    // Buscar algumas reações para ver o formato do userId
    const reactions = await prisma.messageReaction.findMany({
      take: 10,
      include: { message: { select: { authorId: true } } }
    });
    
    console.log('Exemplo de reacoes no banco:');
    reactions.forEach(r => {
      console.log(`  userId: "${r.userId}" | emoji: ${r.emoji} | author da msg: ${r.message.authorId}`);
    });
    
    // Verificar se userId é username ou UUID
    const users = await prisma.user.findMany();
    const userIds = users.map(u => u.id);
    const usernames = users.map(u => u.username);
    
    console.log('\n=== VERIFICANDO SE userId EH USERNAME OU UUID ===');
    const sampleReaction = reactions[0];
    if (sampleReaction) {
      const isUUID = userIds.includes(sampleReaction.userId);
      const isUsername = usernames.includes(sampleReaction.userId);
      console.log(`  userId "${sampleReaction.userId}"`);
      console.log(`  Eh UUID? ${isUUID}`);
      console.log(`  Eh username? ${isUsername}`);
    }
    
    // Contar reações por tipo de userId
    console.log('\n=== CONTAGEM DE REACOES POR USUARIO ===');
    
    for (const user of users) {
      // Tentar por UUID
      const byId = await prisma.messageReaction.count({
        where: { userId: user.id }
      });
      
      // Tentar por username
      const byUsername = await prisma.messageReaction.count({
        where: { userId: user.username }
      });
      
      // Reações recebidas (pelo authorId das mensagens)
      const received = await prisma.messageReaction.count({
        where: { message: { authorId: user.id } }
      });
      
      console.log(`  ${user.username}: byId=${byId}, byUsername=${byUsername}, recebidas=${received}`);
    }
    
    console.log('\n');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkReactions();
