/**
 * 🔧 REMOVER CONQUISTAS DE EMOJI E AJUSTAR XP
 * 
 * Este script remove as conquistas emoji-master e emoji-legend que foram
 * desbloqueadas erroneamente (sistema só tem 8 emojis - muito fácil).
 * 
 * AÇÕES:
 * 1. Remove conquistas emoji-master e emoji-legend de todos os usuários
 * 2. Reverte o XP associado (via XPAuditLog se existir)
 * 3. Recalcula níveis
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

function calculateLevel(totalXP: number): number {
  const levels = [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 100 },
    { level: 3, xpRequired: 250 },
    { level: 4, xpRequired: 500 },
    { level: 5, xpRequired: 1000 },
    { level: 6, xpRequired: 2000 },
    { level: 7, xpRequired: 3500 },
    { level: 8, xpRequired: 5500 },
    { level: 9, xpRequired: 8000 },
    { level: 10, xpRequired: 11000 },
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (totalXP >= levels[i].xpRequired) {
      return levels[i].level;
    }
  }
  return 1;
}

function calculateCurrentLevelXP(totalXP: number, level: number): number {
  const xpRequired: Record<number, number> = {
    1: 0, 2: 100, 3: 250, 4: 500, 5: 1000, 
    6: 2000, 7: 3500, 8: 5500, 9: 8000, 10: 11000
  };
  return totalXP - (xpRequired[level] || 0);
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔧 REMOÇÃO DE CONQUISTAS DE EMOJI');
  console.log('═'.repeat(80));
  console.log('📝 Motivo: Sistema só tem 8 emojis de reação - conquistas muito fáceis');
  console.log('📝 Conquistas a remover: emoji-master, emoji-legend\n');

  const emojiAchievements = ['emoji-master', 'emoji-legend'];
  
  // 1. Buscar todas as conquistas de emoji
  const achievements = await prisma.achievement.findMany({
    where: {
      type: { in: emojiAchievements }
    },
    include: {
      user: { select: { username: true } }
    }
  });

  console.log(`📊 Encontradas ${achievements.length} conquistas de emoji para remover\n`);

  if (achievements.length === 0) {
    console.log('✅ Nenhuma conquista de emoji encontrada. Nada a fazer.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  // Agrupar por usuário
  const byUser: Record<string, { userId: string; username: string; achievements: any[] }> = {};
  for (const ach of achievements) {
    if (!byUser[ach.userId]) {
      byUser[ach.userId] = {
        userId: ach.userId,
        username: ach.user.username,
        achievements: []
      };
    }
    byUser[ach.userId].achievements.push(ach);
  }

  console.log('📋 CONQUISTAS POR USUÁRIO:');
  for (const data of Object.values(byUser)) {
    console.log(`   ${data.username}: ${data.achievements.map(a => a.type).join(', ')}`);
  }
  console.log('');

  // 2. Processar cada usuário
  for (const data of Object.values(byUser)) {
    console.log(`\n👤 Processando ${data.username}...`);
    
    let xpToRemove = 0;
    
    for (const ach of data.achievements) {
      // Buscar XP auditado para esta conquista
      const auditLog = await prisma.xPAuditLog.findFirst({
        where: {
          userId: data.userId,
          source: 'achievement',
          OR: [
            { sourceId: ach.type },
            { metadata: { path: ['achievementType'], equals: ach.type } }
          ],
          status: 'confirmed'
        }
      });

      if (auditLog) {
        console.log(`   📝 ${ach.type}: ${auditLog.amount} XP (via audit)`);
        xpToRemove += auditLog.amount;
        
        // Marcar como revertido no audit log
        await prisma.xPAuditLog.update({
          where: { id: auditLog.id },
          data: { 
            status: 'reversed',
            metadata: {
              ...(auditLog.metadata as object || {}),
              reversedAt: new Date().toISOString(),
              reversedReason: 'Conquista de emoji removida - sistema só tem 8 emojis'
            }
          }
        });
      } else {
        // Estimar XP baseado na raridade
        const rarityXP: Record<string, number> = {
          'emoji-master': 500,   // rare
          'emoji-legend': 1500   // epic
        };
        const estimatedXP = rarityXP[ach.type] || 0;
        console.log(`   📝 ${ach.type}: ~${estimatedXP} XP (estimado - sem audit)`);
        xpToRemove += estimatedXP;
      }
      
      // Remover a conquista
      await prisma.achievement.delete({
        where: { id: ach.id }
      });
      console.log(`   ✅ Conquista ${ach.type} removida`);
    }

    // 3. Ajustar XP do usuário
    if (xpToRemove > 0) {
      const userLevel = await prisma.userLevel.findUnique({
        where: { userId: data.userId }
      });
      
      if (userLevel) {
        const newTotal = Math.max(0, userLevel.totalXP - xpToRemove);
        const newLevel = calculateLevel(newTotal);
        const newLevelXP = calculateCurrentLevelXP(newTotal, newLevel);
        
        await prisma.userLevel.update({
          where: { userId: data.userId },
          data: {
            totalXP: newTotal,
            level: newLevel,
            xp: newLevelXP
          }
        });
        
        console.log(`   💰 XP ajustado: ${userLevel.totalXP} → ${newTotal} (-${xpToRemove})`);
        console.log(`   📊 Nível: ${userLevel.level} → ${newLevel}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ REMOÇÃO CONCLUÍDA');
  console.log('═'.repeat(80));
  console.log(`   Conquistas removidas: ${achievements.length}`);
  console.log(`   Usuários afetados: ${Object.keys(byUser).length}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
