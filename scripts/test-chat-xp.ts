/**
 * Script para testar XP de mensagem no chat
 * Executa: npx ts-node scripts/test-chat-xp.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Teste de XP para mensagem de chat\n');
  
  // 1. Verificar configuração de XP
  console.log('1️⃣ Verificando configuração de XP...');
  const xpConfig = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });
  
  if (xpConfig) {
    const config = xpConfig.value as Record<string, { xp: number, name?: string }>;
    console.log('   XP Config encontrada:');
    console.log(`   - message-sent: ${config['message-sent']?.xp || 'NÃO DEFINIDO'} XP`);
    console.log(`   - coffee-made: ${config['coffee-made']?.xp || 'NÃO DEFINIDO'} XP`);
    console.log(`   - reaction-added: ${config['reaction-added']?.xp || 'NÃO DEFINIDO'} XP`);
  } else {
    console.log('   ⚠️ XP Config NÃO ENCONTRADA!');
  }
  
  console.log('\n2️⃣ Buscando último usuário ativo...');
  // Buscar um usuário para teste
  const user = await prisma.user.findFirst({
    orderBy: {
      updatedAt: 'desc'
    }
  });
  
  if (!user) {
    console.log('   ❌ Nenhum usuário encontrado!');
    return;
  }
  
  const userLevel = await prisma.userLevel.findUnique({
    where: { userId: user.id }
  });
  
  console.log(`   Usuário: ${user.name} (${user.username})`);
  console.log(`   XP Total: ${userLevel?.totalXP || 0}`);
  console.log(`   Nível: ${userLevel?.level || 1}`);
  
  // 3. Verificar últimas transações de XP
  console.log('\n3️⃣ Últimas transações de XP deste usuário:');
  const recentLogs = await prisma.xPAuditLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  if (recentLogs.length === 0) {
    console.log('   ⚠️ Nenhuma transação encontrada!');
  } else {
    for (const log of recentLogs) {
      const date = new Date(log.createdAt).toLocaleString('pt-BR');
      console.log(`   [${date}] ${log.source}: +${log.amount} XP - ${log.reason}`);
    }
  }
  
  // 4. Verificar transações especificamente de 'message'
  console.log('\n4️⃣ Transações de XP por MENSAGEM (todos os usuários):');
  const messageLogs = await prisma.xPAuditLog.findMany({
    where: { source: 'message' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  if (messageLogs.length === 0) {
    console.log('   ⚠️ NENHUMA transação de mensagem encontrada!');
    console.log('   🔍 Isso indica que o XP por mensagem NUNCA foi creditado!');
  } else {
    for (const log of messageLogs) {
      const date = new Date(log.createdAt).toLocaleString('pt-BR');
      console.log(`   [${date}] ${log.username}: +${log.amount} XP`);
    }
  }
  
  // 5. Verificar todas as sources únicas
  console.log('\n5️⃣ Todas as fontes de XP no sistema:');
  const sources = await prisma.xPAuditLog.groupBy({
    by: ['source'],
    _count: { id: true },
    _sum: { amount: true }
  });
  
  for (const s of sources) {
    console.log(`   - ${s.source}: ${s._count.id} transações, total: ${s._sum.amount} XP`);
  }
  
  // 6. Verificar mensagens recentes do usuário
  console.log('\n6️⃣ Últimas mensagens do usuário:');
  const messages = await prisma.message.findMany({
    where: { authorId: user.id },
    orderBy: { timestamp: 'desc' },
    take: 5
  });
  
  for (const msg of messages) {
    const date = new Date(msg.timestamp).toLocaleString('pt-BR');
    console.log(`   [${date}] ${msg.text.substring(0, 50)}...`);
  }
  
  console.log('\n✅ Teste concluído!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
