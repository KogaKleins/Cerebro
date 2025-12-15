/**
 * Script para verificar dados de auditoria
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('=== Verificando dados de auditoria ===\n');
  
  // Verificar UserLevels
  const levels = await prisma.userLevel.findMany({
    include: {
      user: {
        select: { name: true, username: true }
      }
    },
    orderBy: { totalXP: 'desc' }
  });
  
  console.log('📊 User Levels encontrados:', levels.length);
  levels.forEach(l => {
    console.log(`  - ${l.user.name} (@${l.user.username}): ${l.totalXP} XP, Nível ${l.level}`);
  });
  
  // Verificar XP Audit Logs
  const logsCount = await prisma.xPAuditLog.count();
  console.log('\n📝 Total de logs de auditoria:', logsCount);
  
  if (logsCount > 0) {
    const recentLogs = await prisma.xPAuditLog.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' }
    });
    console.log('\nÚltimos 5 logs:');
    recentLogs.forEach(l => {
      console.log(`  - ${l.username}: +${l.amount} XP (${l.source}) - ${l.reason}`);
    });
    
    // Agrupar por fonte
    const bySource = await prisma.xPAuditLog.groupBy({
      by: ['source'],
      _count: true,
      _sum: { amount: true }
    });
    console.log('\nLogs por fonte:');
    bySource.forEach(s => {
      console.log(`  - ${s.source}: ${s._count} transações, ${s._sum.amount} XP total`);
    });
  } else {
    console.log('\n⚠️  NENHUM LOG DE AUDITORIA ENCONTRADO!');
    console.log('Isso significa que as transações de XP não estão sendo registradas no audit log.');
    console.log('Os dados de UserLevel existem, mas não há histórico detalhado.');
  }
  
  // Verificar conquistas
  const achievements = await prisma.achievement.count();
  console.log('\n🏆 Total de conquistas:', achievements);
  
  // Verificar cafés
  const coffees = await prisma.coffee.count();
  console.log('☕ Total de cafés:', coffees);
  
  // Verificar mensagens
  const messages = await prisma.message.count();
  console.log('💬 Total de mensagens:', messages);
  
  await prisma.$disconnect();
}

main().catch(console.error);
