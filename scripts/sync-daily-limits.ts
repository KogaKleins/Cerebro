/**
 * Script para sincronizar dailyLimits com XPAuditLog
 * 
 * Problema: O frontend incrementa dailyLimits, mas o backend
 * não estava verificando esses limites, resultando em XP excedente.
 * 
 * Este script:
 * 1. Conta transações de message/reaction de HOJE no XPAuditLog
 * 2. Atualiza dailyLimits para refletir o número real
 * 3. Exibe resumo das correções
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function syncDailyLimits() {
  console.log('\n=============================================');
  console.log('SINCRONIZAÇÃO DE LIMITES DIÁRIOS (dailyLimits)');
  console.log('=============================================\n');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayString = new Date().toDateString();

  // 1. Buscar todos os usuários com userLevel
  const userLevels = await prisma.userLevel.findMany({
    include: { user: true }
  });

  console.log(`Encontrados ${userLevels.length} usuários com níveis.\n`);

  for (const ul of userLevels) {
    const username = ul.user?.username;
    if (!username) continue;

    // 2. Contar transações de HOJE no XPAuditLog
    const messagesCount = await prisma.xPAuditLog.count({
      where: {
        userId: ul.userId,
        source: 'message',
        timestamp: { gte: today },
        status: 'confirmed'
      }
    });

    const reactionsCount = await prisma.xPAuditLog.count({
      where: {
        userId: ul.userId,
        source: 'reaction',
        timestamp: { gte: today },
        status: 'confirmed'
      }
    });

    // 3. Comparar com dailyLimits
    const currentLimits = (ul.dailyLimits as any) || {
      messages: { count: 0, date: null },
      reactions: { count: 0, date: null }
    };

    const currentMsgCount = currentLimits.messages?.date === todayString 
      ? currentLimits.messages.count 
      : 0;
    const currentReactCount = currentLimits.reactions?.date === todayString 
      ? currentLimits.reactions.count 
      : 0;

    // Só mostrar se houver diferença
    const msgDiff = messagesCount !== currentMsgCount;
    const reactDiff = reactionsCount !== currentReactCount;

    if (msgDiff || reactDiff || messagesCount > 0 || reactionsCount > 0) {
      console.log(`\n📊 ${username}:`);
      
      if (msgDiff) {
        console.log(`  📝 Mensagens: dailyLimits=${currentMsgCount}, XPAuditLog=${messagesCount} ${msgDiff ? '⚠️ DIFERENTE' : '✅'}`);
      }
      if (reactDiff) {
        console.log(`  👍 Reações: dailyLimits=${currentReactCount}, XPAuditLog=${reactionsCount} ${reactDiff ? '⚠️ DIFERENTE' : '✅'}`);
      }

      // 4. SINCRONIZAR - usar o valor do XPAuditLog como fonte de verdade
      // O limite máximo ainda é 10, mas o count deve refletir quantos XP foram REALMENTE dados
      const newLimits = {
        messages: {
          count: Math.min(messagesCount, 10), // Capped no limite
          date: todayString
        },
        reactions: {
          count: Math.min(reactionsCount, 10), // Capped no limite
          date: todayString
        }
      };

      if (msgDiff || reactDiff) {
        await prisma.userLevel.update({
          where: { id: ul.id },
          data: { dailyLimits: newLimits }
        });
        console.log(`  ✅ dailyLimits SINCRONIZADO: messages=${newLimits.messages.count}, reactions=${newLimits.reactions.count}`);
      }
    }
  }

  console.log('\n=============================================');
  console.log('SINCRONIZAÇÃO CONCLUÍDA!');
  console.log('=============================================\n');

  await prisma.$disconnect();
}

syncDailyLimits().catch(console.error);
