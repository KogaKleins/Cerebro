/**
 * 🔍 ANÁLISE COMPLETA DO FLUXO DE XP
 * Verifica se todas as ações estão creditando XP corretamente
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
  console.log('\n🔍 ═══════════════════════════════════════════════════');
  console.log('   ANÁLISE COMPLETA DO FLUXO DE XP');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. HISTÓRICO DE AVALIAÇÕES
  console.log('⭐ HISTÓRICO DE AVALIAÇÕES:');
  console.log('─────────────────────────────────────────────────────');
  const ratings = await prisma.rating.findMany({
    include: {
      user: { select: { username: true } },
      coffee: { 
        select: { 
          timestamp: true,
          maker: { select: { username: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Agrupar por quem RECEBEU a avaliação
  const ratingsByMaker: Record<string, { ratings: number[], count: number }> = {};
  
  ratings.forEach(r => {
    const maker = r.coffee.maker.username;
    if (!ratingsByMaker[maker]) {
      ratingsByMaker[maker] = { ratings: [], count: 0 };
    }
    ratingsByMaker[maker].ratings.push(r.rating);
    ratingsByMaker[maker].count++;
    console.log(`   ${r.user.username} → ${maker}: ${r.rating}⭐ (${r.createdAt.toISOString().split('T')[0]})`);
  });
  
  console.log('\n📊 RESUMO DE MÉDIAS:');
  for (const [maker, data] of Object.entries(ratingsByMaker)) {
    const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    const fiveStars = data.ratings.filter(r => r === 5).length;
    const merecerTopRated = avg >= 4.5 && data.count >= 3;
    console.log(`   ${maker}: média ${avg.toFixed(2)} (${data.count} avaliações, ${fiveStars}x 5⭐) ${merecerTopRated ? '✅ MERECE top-rated' : '❌ NÃO merece top-rated'}`);
  }

  // 2. AUDIT LOG DE XP
  console.log('\n\n📜 AUDIT LOG DE XP (últimas 50 transações):');
  console.log('─────────────────────────────────────────────────────');
  const logs = await prisma.xPAuditLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50
  });
  
  if (logs.length === 0) {
    console.log('   ⚠️ NENHUM LOG DE XP ENCONTRADO!');
    console.log('   PROBLEMA: O sistema de auditoria NÃO está registrando transações!');
  } else {
    logs.forEach(l => {
      console.log(`   ${l.timestamp.toISOString().split('T')[0]} | ${l.username.padEnd(10)} | +${String(l.amount).padStart(4)} XP | ${l.source.padEnd(12)} | ${l.reason}`);
    });
  }

  // 3. VERIFICAR SE MENSAGENS ESTÃO SENDO RASTREADAS
  console.log('\n\n💬 MENSAGENS NO CHAT:');
  console.log('─────────────────────────────────────────────────────');
  const messages = await prisma.message.groupBy({
    by: ['authorId'],
    _count: { id: true }
  });
  
  const userMap = await prisma.user.findMany();
  const userById = new Map(userMap.map(u => [u.id, u.username]));
  
  for (const m of messages) {
    const username = userById.get(m.authorId) || m.authorId;
    const expectedXP = m._count.id * 1; // 1 XP por mensagem
    console.log(`   ${username}: ${m._count.id} mensagens (deveria ter +${expectedXP} XP de mensagens)`);
  }

  // 4. VERIFICAR NÍVEIS ATUAIS vs ESPERADOS
  console.log('\n\n📈 NÍVEIS ATUAIS:');
  console.log('─────────────────────────────────────────────────────');
  const levels = await prisma.userLevel.findMany({
    include: { user: { select: { username: true, name: true } } }
  });
  
  for (const l of levels) {
    console.log(`   ${l.user.name} (${l.user.username}): Nível ${l.level}, ${l.totalXP} XP total`);
  }

  // 5. VERIFICAR TRACKEDACTIONS
  console.log('\n\n🎯 TRACKED ACTIONS (ações rastreadas por usuário):');
  console.log('─────────────────────────────────────────────────────');
  for (const l of levels) {
    console.log(`   ${l.user.username}:`);
    const tracked = l.trackedActions as Record<string, any>;
    if (Object.keys(tracked).length === 0) {
      console.log(`      ⚠️ NENHUMA AÇÃO RASTREADA!`);
    } else {
      for (const [action, count] of Object.entries(tracked)) {
        console.log(`      ${action}: ${count}`);
      }
    }
  }

  // 6. VERIFICAR SE HÁ REAÇÕES NO BANCO
  console.log('\n\n👍 REAÇÕES DE MENSAGENS:');
  console.log('─────────────────────────────────────────────────────');
  try {
    // Verificar se tabela de reações existe
    const reactionCount = await prisma.$queryRaw`SELECT COUNT(*) as count FROM message_reactions` as any[];
    console.log(`   Total de reações no banco: ${reactionCount[0]?.count || 0}`);
  } catch (e) {
    console.log('   ⚠️ Tabela message_reactions não existe ou erro ao consultar');
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
