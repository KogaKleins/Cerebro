import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDailyLimits() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('\n====================================');
  console.log('VERIFICAÇÃO DE LIMITES DIÁRIOS DE XP');
  console.log('====================================\n');
  
  // Verificar transações de mensagens e reações de hoje
  const logs = await prisma.xPAuditLog.findMany({
    where: {
      timestamp: { gte: today },
      source: { in: ['message', 'reaction'] },
      status: 'confirmed'
    },
    orderBy: { timestamp: 'desc' }
  });
  
  // Agrupar por usuário e tipo
  const byUser = new Map<string, { messages: number; reactions: number }>();
  
  logs.forEach(log => {
    const data = byUser.get(log.username) || { messages: 0, reactions: 0 };
    if (log.source === 'message') {
      data.messages++;
    } else if (log.source === 'reaction') {
      data.reactions++;
    }
    byUser.set(log.username, data);
  });
  
  console.log(`Total de transações (message/reaction) HOJE: ${logs.length}`);
  console.log('\n--- Por usuário ---');
  
  const DAILY_LIMIT = 10;
  
  byUser.forEach((data, username) => {
    const msgStatus = data.messages > DAILY_LIMIT ? '⚠️ EXCEDEU LIMITE!' : '✅';
    const reactStatus = data.reactions > DAILY_LIMIT ? '⚠️ EXCEDEU LIMITE!' : '✅';
    
    console.log(`\n${username}:`);
    console.log(`  📝 Mensagens: ${data.messages}/${DAILY_LIMIT} ${msgStatus}`);
    console.log(`  👍 Reações: ${data.reactions}/${DAILY_LIMIT} ${reactStatus}`);
    
    if (data.messages > DAILY_LIMIT || data.reactions > DAILY_LIMIT) {
      console.log(`  ❌ PROBLEMA: Usuário ganhou XP além do limite diário!`);
    }
  });
  
  // Verificar userLevel para dailyLimits
  console.log('\n\n--- dailyLimits no UserLevel ---');
  const userLevels = await prisma.userLevel.findMany({
    include: { user: true }
  });
  
  for (const ul of userLevels) {
    const limits = ul.dailyLimits as any || {};
    console.log(`\n${ul.user?.username || ul.userId}:`);
    console.log(`  dailyLimits: ${JSON.stringify(limits)}`);
    
    const userData = byUser.get(ul.user?.username || '');
    if (userData) {
      const storedMsg = limits.messages?.count || 0;
      const storedReact = limits.reactions?.count || 0;
      const actualMsg = userData.messages;
      const actualReact = userData.reactions;
      
      if (storedMsg !== actualMsg) {
        console.log(`  ⚠️ DESINCRONIZADO: dailyLimits.messages.count=${storedMsg}, mas XPAuditLog tem ${actualMsg}`);
      }
      if (storedReact !== actualReact) {
        console.log(`  ⚠️ DESINCRONIZADO: dailyLimits.reactions.count=${storedReact}, mas XPAuditLog tem ${actualReact}`);
      }
    }
  }
  
  await prisma.$disconnect();
}

checkDailyLimits().catch(console.error);
