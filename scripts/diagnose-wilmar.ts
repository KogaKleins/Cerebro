/**
 * Diagnóstico de inconsistências - Wilmar
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
  
  console.log('='.repeat(60));
  console.log('DIAGNOSTICO DE INCONSISTENCIAS - WILMAR');
  console.log('='.repeat(60));
  
  // Buscar Wilmar
  const wilmar = await prisma.user.findUnique({ where: { username: 'wilmar' } });
  if (!wilmar) {
    console.log('Usuario wilmar nao encontrado!');
    return;
  }
  
  console.log('\nUsuario:', wilmar.name, '(@' + wilmar.username + ')');
  
  // UserLevel
  const level = await prisma.userLevel.findUnique({ where: { userId: wilmar.id } });
  console.log('Level:', level?.level || 'N/A', '| XP Total:', level?.totalXP || 0);
  
  // Mensagens
  const totalMsgs = await prisma.message.count({ where: { authorId: wilmar.id } });
  const activeMsgs = await prisma.message.count({ where: { authorId: wilmar.id, deletedAt: null } });
  const deletedMsgs = await prisma.message.count({ where: { authorId: wilmar.id, NOT: { deletedAt: null } } });
  
  console.log('\n== MENSAGENS ==');
  console.log('   Total no banco:', totalMsgs);
  console.log('   Ativas (nao deletadas):', activeMsgs);
  console.log('   Deletadas (soft delete):', deletedMsgs);
  
  // Logs de XP de mensagens
  const xpMsgLogs = await prisma.xPAuditLog.count({
    where: { userId: wilmar.id, source: 'message', status: 'confirmed' }
  });
  console.log('   Logs de XP por mensagem:', xpMsgLogs);
  
  // Verificar conquistas
  console.log('\n== CONQUISTAS ==');
  const achievements = await prisma.achievement.findMany({ where: { userId: wilmar.id } });
  console.log('   Total de conquistas:', achievements.length);
  
  const hasChatterbox = achievements.some(a => a.type === 'chatterbox');
  console.log('   Tem Tagarela (chatterbox)?', hasChatterbox ? 'SIM' : 'NAO');
  
  // Listar conquistas
  achievements.forEach(a => {
    console.log('   - ' + a.type + ': ' + a.title);
  });
  
  // Verificar saldos duplicados
  console.log('\n== VERIFICACAO DE SALDOS DUPLICADOS ==');
  const logs = await prisma.xPAuditLog.findMany({
    where: { userId: wilmar.id, source: 'message', status: 'confirmed' },
    orderBy: { timestamp: 'desc' },
    take: 20
  });
  
  const balanceMap: Record<number, number> = {};
  logs.forEach(l => {
    balanceMap[l.balanceAfter] = (balanceMap[l.balanceAfter] || 0) + 1;
  });
  
  const duplicates = Object.entries(balanceMap).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('   ALERTA: Saldos repetidos encontrados:');
    duplicates.forEach(([balance, count]) => {
      console.log('      Balance ' + balance + ': aparece ' + count + ' vezes');
    });
  } else {
    console.log('   OK: Nenhum saldo duplicado');
  }
  
  // Resumo
  console.log('\n== DIAGNOSTICO ==');
  if (xpMsgLogs > activeMsgs) {
    console.log('   PROBLEMA: Mais logs de XP (' + xpMsgLogs + ') do que mensagens ativas (' + activeMsgs + ')');
    console.log('   CAUSA: Mensagens foram deletadas apos dar XP (soft delete)');
  }
  if (!hasChatterbox && activeMsgs >= 50) {
    console.log('   PROBLEMA: Tem ' + activeMsgs + ' mensagens mas sem conquista Tagarela');
    console.log('   CAUSA: Conquista nao foi processada');
  }
  if (!hasChatterbox && activeMsgs < 50) {
    console.log('   INFO: Tem apenas ' + activeMsgs + ' mensagens ATIVAS (precisa 50 para Tagarela)');
  }
  
  // Mostrar ultimos logs
  console.log('\n== ULTIMOS 10 LOGS DE XP (MENSAGEM) ==');
  logs.slice(0, 10).forEach(l => {
    console.log(`   ${l.timestamp.toISOString().slice(0, 16)} | +${l.amount} XP | Saldo: ${l.balanceAfter}`);
  });
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
