/**
 * Script de teste WebSocket para debug de XP no chat
 */

import 'dotenv/config';
import { io } from 'socket.io-client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Conectar ao banco para pegar o token
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testChatXP() {
  console.log('🧪 Iniciando teste de XP para mensagem de chat\n');
  
  // 1. Fazer login para pegar token
  console.log('1️⃣ Obtendo token de autenticação...');
  const response = await fetch('http://localhost:3000/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'wilmar', password: 'admin123' })
  });
  
  const loginData = await response.json() as { success: boolean; token?: string };
  if (!loginData.success || !loginData.token) {
    console.log('❌ Falha no login');
    return;
  }
  
  const token = loginData.token;
  console.log('   ✅ Token obtido!\n');
  
  // 2. Verificar XP atual do usuário
  console.log('2️⃣ Verificando XP atual...');
  const user = await prisma.user.findUnique({ where: { username: 'wilmar' } });
  const userLevel = await prisma.userLevel.findUnique({ where: { userId: user!.id } });
  console.log(`   XP Total: ${userLevel?.totalXP || 0}`);
  console.log(`   Nível: ${userLevel?.level || 1}\n`);
  
  // 3. Conectar via WebSocket
  console.log('3️⃣ Conectando ao WebSocket...');
  const socket = io('http://localhost:3000', {
    auth: { token }
  });
  
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('   ✅ Conectado!\n');
      resolve();
    });
    
    socket.on('connect_error', (err) => {
      console.log('   ❌ Erro de conexão:', err.message);
      reject(err);
    });
    
    setTimeout(() => reject(new Error('Timeout de conexão')), 5000);
  });
  
  // 4. Enviar mensagem de teste
  console.log('4️⃣ Enviando mensagem de teste...');
  const testMessage = `Teste de XP - ${Date.now()}`;
  
  const sendResult = await new Promise<any>((resolve) => {
    socket.emit('chat:send', testMessage, (response: any) => {
      console.log('\n📥 Resposta do servidor:');
      console.log('   success:', response.success);
      console.log('   xpGained:', response.xpGained);
      console.log('   message:', response.message?.id);
      resolve(response);
    });
  });
  
  // Esperar um pouco para o banco atualizar
  await new Promise(r => setTimeout(r, 1000));
  
  // 5. Verificar XP após enviar
  console.log('\n5️⃣ Verificando XP após enviar mensagem...');
  const userLevelAfter = await prisma.userLevel.findUnique({ where: { userId: user!.id } });
  console.log(`   XP Total: ${userLevelAfter?.totalXP || 0}`);
  console.log(`   Nível: ${userLevelAfter?.level || 1}`);
  
  const xpDiff = (userLevelAfter?.totalXP || 0) - (userLevel?.totalXP || 0);
  if (xpDiff > 0) {
    console.log(`   ✅ XP ganho: +${xpDiff}`);
  } else {
    console.log(`   ⚠️ Nenhum XP ganho (provavelmente cooldown)`);
  }
  
  // 6. Verificar última transação
  console.log('\n6️⃣ Última transação de XP:');
  const lastTx = await prisma.xPAuditLog.findFirst({
    where: { userId: user!.id },
    orderBy: { createdAt: 'desc' }
  });
  
  if (lastTx) {
    console.log(`   Source: ${lastTx.source}`);
    console.log(`   Amount: ${lastTx.amount}`);
    console.log(`   Reason: ${lastTx.reason}`);
    console.log(`   Time: ${lastTx.createdAt.toLocaleString('pt-BR')}`);
  }
  
  // Desconectar
  socket.disconnect();
  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n✅ Teste concluído!');
}

testChatXP().catch(console.error);
