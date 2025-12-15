/**
 * Investigação COMPLETA de bugs de conquistas
 * Execução: npx ts-node scripts/investigate-bugs.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function investigate() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('INVESTIGACAO COMPLETA DE BUGS');
    console.log('='.repeat(70) + '\n');

    // 1. Verificar cafés do Chris com datas detalhadas
    const chris = await prisma.user.findFirst({ where: { username: 'chris' }});
    if (!chris) {
      console.log('Chris nao encontrado');
      return;
    }
    
    console.log('=== CAFES DO CHRIS (verificando dia da semana) ===');
    const coffees = await prisma.coffee.findMany({
      where: { makerId: chris.id },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    
    const dayNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
    let hasWeekendCoffee = false;
    
    coffees.forEach(c => {
      const date = new Date(c.timestamp);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (isWeekend) hasWeekendCoffee = true;
      
      const marker = isWeekend ? ' <<< FIM DE SEMANA' : '';
      console.log(`  ${date.toISOString()} => ${date.toLocaleString('pt-BR')} - ${dayNames[dayOfWeek]} (day=${dayOfWeek})${marker}`);
    });
    
    console.log(`\n  >>> Chris TEM cafe no fim de semana? ${hasWeekendCoffee ? 'SIM' : 'NAO!!!'}`);
    
    // Verificar conquista weekend-warrior do Chris
    const weekendWarrior = await prisma.achievement.findUnique({
      where: { userId_type: { userId: chris.id, type: 'weekend-warrior' } }
    });
    if (weekendWarrior) {
      console.log(`  >>> weekend-warrior desbloqueada em: ${weekendWarrior.unlockedAt.toLocaleString('pt-BR')}`);
      if (!hasWeekendCoffee) {
        console.log('  >>> BUG CONFIRMADO: Ganhou weekend-warrior sem ter cafe no fim de semana!');
      }
    }

    // 2. Verificar XP do Átila
    console.log('\n=== ATILA - XP E NIVEL ===');
    const atila = await prisma.user.findFirst({ where: { username: 'atila' }});
    if (atila) {
      const atilaLevel = await prisma.userLevel.findFirst({ where: { userId: atila.id }});
      console.log(`  XP Total: ${atilaLevel?.totalXP}`);
      console.log(`  Nivel: ${atilaLevel?.level}`);
      console.log(`  XP no nivel: ${atilaLevel?.xp}`);
      
      // Verificar histórico COMPLETO de XP do Átila (ordenado cronologicamente)
      console.log('\n=== HISTORICO COMPLETO XP DO ATILA ===');
      const atilaAudit = await prisma.xPAuditLog.findMany({
        where: { userId: atila.id },
        orderBy: { createdAt: 'asc' }  // Ordem cronológica
      });
      
      atilaAudit.forEach((a: any) => {
        const sign = a.amount > 0 ? '+' : '';
        console.log(`  ${a.createdAt.toLocaleString('pt-BR')} | ${sign}${a.amount} | ${a.reason.substring(0, 50)} | Saldo: ${a.balanceAfter}`);
      });
      
      // Verificar se há transações negativas (perda de XP)
      const negativeTransactions = atilaAudit.filter((a: any) => a.amount < 0);
      if (negativeTransactions.length > 0) {
        console.log('\n  >>> TRANSACOES NEGATIVAS ENCONTRADAS:');
        negativeTransactions.forEach((a: any) => {
          console.log(`    ${a.createdAt.toLocaleString('pt-BR')} | ${a.amount} | ${a.reason}`);
        });
      } else {
        console.log('\n  >>> Nenhuma transacao negativa encontrada');
      }
    }

    // 3. Verificar reações dadas por usuários
    console.log('\n=== REACOES POR USUARIO (verificando conquistas) ===');
    const users = await prisma.user.findMany();
    
    for (const user of users) {
      const reactionCount = await prisma.messageReaction.count({
        where: { userId: user.id }
      });
      
      // reactor = 100 reações dadas
      const hasReactor = await prisma.achievement.findUnique({
        where: { userId_type: { userId: user.id, type: 'reactor' } }
      });
      
      // reaction-god = 500 reações dadas
      const hasReactionGod = await prisma.achievement.findUnique({
        where: { userId_type: { userId: user.id, type: 'reaction-god' } }
      });
      
      if (reactionCount > 0) {
        let status = '';
        if (reactionCount >= 100 && !hasReactor) {
          status = ' <<< BUG: deveria ter reactor!';
        } else if (reactionCount >= 500 && !hasReactionGod) {
          status = ' <<< BUG: deveria ter reaction-god!';
        }
        console.log(`  ${user.username}: ${reactionCount} reacoes | reactor: ${hasReactor ? 'SIM' : 'NAO'} | reaction-god: ${hasReactionGod ? 'SIM' : 'NAO'}${status}`);
      }
    }

    // 4. Verificar reações RECEBIDAS (para viral e popular)
    console.log('\n=== REACOES RECEBIDAS POR USUARIO (viral/popular) ===');
    
    for (const user of users) {
      // Contar reações recebidas nas mensagens do usuário
      const reactionsReceived = await prisma.messageReaction.count({
        where: {
          message: { authorId: user.id }
        }
      });
      
      // viral = 50 reações recebidas
      const hasViral = await prisma.achievement.findUnique({
        where: { userId_type: { userId: user.id, type: 'viral' } }
      });
      
      // popular = 200 reações recebidas
      const hasPopular = await prisma.achievement.findUnique({
        where: { userId_type: { userId: user.id, type: 'popular' } }
      });
      
      if (reactionsReceived > 0) {
        let status = '';
        if (reactionsReceived >= 50 && !hasViral) {
          status = ' <<< BUG: deveria ter viral!';
        } else if (reactionsReceived >= 200 && !hasPopular) {
          status = ' <<< BUG: deveria ter popular!';
        }
        console.log(`  ${user.username}: ${reactionsReceived} reacoes recebidas | viral: ${hasViral ? 'SIM' : 'NAO'} | popular: ${hasPopular ? 'SIM' : 'NAO'}${status}`);
      }
    }

    // 5. Verificar quando conquistas foram desbloqueadas hoje
    console.log('\n=== CONQUISTAS DESBLOQUEADAS HOJE ===');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAchievements = await prisma.achievement.findMany({
      where: { unlockedAt: { gte: today } },
      include: { user: { select: { username: true } } },
      orderBy: { unlockedAt: 'asc' }
    });
    
    todayAchievements.forEach(a => {
      console.log(`  ${a.unlockedAt.toLocaleString('pt-BR')} | ${a.user.username} | ${a.type} (${a.title})`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('INVESTIGACAO CONCLUIDA');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

investigate();
