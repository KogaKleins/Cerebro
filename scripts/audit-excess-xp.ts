/**
 * Script para auditar e REVERTER XP excedente de mensagens/reações
 * 
 * Problema encontrado: Backend dava XP sem limite diário
 * Esse script encontra transações excedentes e as REVERTE.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DAILY_LIMIT = 10;

async function auditExcessXP() {
  console.log('\n=============================================');
  console.log('AUDITORIA DE XP EXCEDENTE (messages/reactions)');
  console.log('=============================================\n');

  // Buscar todas as transações de message e reaction
  const allLogs = await prisma.xPAuditLog.findMany({
    where: {
      source: { in: ['message', 'reaction'] },
      status: 'confirmed'
    },
    orderBy: { timestamp: 'asc' }
  });

  console.log(`Total de transações de message/reaction: ${allLogs.length}\n`);

  // Agrupar por usuário e por dia
  const byUserDay = new Map<string, {
    messages: Array<{ id: string; amount: number; timestamp: Date }>;
    reactions: Array<{ id: string; amount: number; timestamp: Date }>;
  }>();

  for (const log of allLogs) {
    const date = log.timestamp.toDateString();
    const key = `${log.userId}:${date}`;
    
    if (!byUserDay.has(key)) {
      byUserDay.set(key, { messages: [], reactions: [] });
    }
    
    const data = byUserDay.get(key)!;
    if (log.source === 'message') {
      data.messages.push({ id: log.id, amount: log.amount, timestamp: log.timestamp });
    } else {
      data.reactions.push({ id: log.id, amount: log.amount, timestamp: log.timestamp });
    }
  }

  // Encontrar excedentes
  const excessTransactions: { id: string; userId: string; source: string; amount: number; date: string }[] = [];
  let totalExcessXP = 0;

  for (const [key, data] of byUserDay) {
    const [userId, date] = key.split(':');
    
    // Verificar mensagens excedentes
    if (data.messages.length > DAILY_LIMIT) {
      const excess = data.messages.slice(DAILY_LIMIT);
      for (const tx of excess) {
        excessTransactions.push({
          id: tx.id,
          userId,
          source: 'message',
          amount: tx.amount,
          date
        });
        totalExcessXP += tx.amount;
      }
    }
    
    // Verificar reações excedentes
    if (data.reactions.length > DAILY_LIMIT) {
      const excess = data.reactions.slice(DAILY_LIMIT);
      for (const tx of excess) {
        excessTransactions.push({
          id: tx.id,
          userId,
          source: 'reaction',
          amount: tx.amount,
          date
        });
        totalExcessXP += tx.amount;
      }
    }
  }

  console.log(`\n📊 RESUMO:`);
  console.log(`  Transações excedentes encontradas: ${excessTransactions.length}`);
  console.log(`  XP total excedente: ${totalExcessXP}\n`);

  if (excessTransactions.length === 0) {
    console.log('✅ Nenhuma transação excedente encontrada!');
    await prisma.$disconnect();
    return;
  }

  // Agrupar por usuário para mostrar detalhes
  const byUser = new Map<string, { count: number; xp: number }>();
  for (const tx of excessTransactions) {
    const data = byUser.get(tx.userId) || { count: 0, xp: 0 };
    data.count++;
    data.xp += tx.amount;
    byUser.set(tx.userId, data);
  }

  console.log('📋 DETALHES POR USUÁRIO:');
  for (const [userId, data] of byUser) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log(`  ${user?.username || userId}: ${data.count} transações, ${data.xp} XP excedente`);
  }

  // Reverter transações excedentes
  console.log('\n🔄 REVERTENDO TRANSAÇÕES EXCEDENTES...\n');

  for (const tx of excessTransactions) {
    try {
      // Marcar como reversed
      await prisma.xPAuditLog.update({
        where: { id: tx.id },
        data: {
          status: 'reversed',
          reversedAt: new Date(),
          reversedReason: 'Excedeu limite diário de 10 transações'
        }
      });

      // Subtrair XP do userLevel
      const userLevel = await prisma.userLevel.findUnique({
        where: { userId: tx.userId }
      });

      if (userLevel) {
        const newTotal = Math.max(0, userLevel.totalXP - tx.amount);
        await prisma.userLevel.update({
          where: { userId: tx.userId },
          data: { totalXP: newTotal }
        });
      }

      console.log(`  ✅ Revertido: ${tx.id} (-${tx.amount} XP)`);
    } catch (error) {
      console.log(`  ❌ Erro ao reverter ${tx.id}: ${error}`);
    }
  }

  console.log('\n=============================================');
  console.log('AUDITORIA CONCLUÍDA!');
  console.log(`${excessTransactions.length} transações revertidas`);
  console.log(`${totalExcessXP} XP removido`);
  console.log('=============================================\n');

  await prisma.$disconnect();
}

auditExcessXP().catch(console.error);
