/**
 * 🔧 SINCRONIZAR XP COM AUDIT LOG
 * 
 * Este script sincroniza o totalXP no UserLevel com a soma do XPAuditLog.
 * O audit log é a FONTE DA VERDADE - se houver discrepância, o UserLevel é corrigido.
 * 
 * POLÍTICA: Se UserLevel > AuditLog, MANTER UserLevel (não remover XP)
 *           Se UserLevel < AuditLog, AUMENTAR UserLevel
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
  console.log('🔧 SINCRONIZAÇÃO DE XP COM AUDIT LOG');
  console.log('═'.repeat(80));
  console.log('📝 Política: Nunca remover XP, apenas adicionar se faltar\n');

  const users = await prisma.user.findMany({
    include: { levelData: true }
  });

  let corrected = 0;
  let skipped = 0;

  for (const user of users) {
    // Soma de XP no audit log (apenas confirmados)
    const auditSum = await prisma.xPAuditLog.aggregate({
      where: {
        userId: user.id,
        status: 'confirmed'
      },
      _sum: { amount: true }
    });

    const xpFromAudit = auditSum._sum.amount || 0;
    const xpFromLevel = user.levelData?.totalXP || 0;
    const diff = xpFromAudit - xpFromLevel;

    if (diff > 0) {
      // UserLevel tem MENOS que o audit - ADICIONAR
      const newTotal = xpFromAudit;
      const newLevel = calculateLevel(newTotal);
      const newLevelXP = calculateCurrentLevelXP(newTotal, newLevel);

      if (user.levelData) {
        await prisma.userLevel.update({
          where: { userId: user.id },
          data: {
            totalXP: newTotal,
            level: newLevel,
            xp: newLevelXP
          }
        });
      } else {
        await prisma.userLevel.create({
          data: {
            userId: user.id,
            totalXP: newTotal,
            level: newLevel,
            xp: newLevelXP
          }
        });
      }

      console.log(`✅ ${user.username}: ${xpFromLevel} → ${newTotal} (+${diff} XP)`);
      corrected++;
    } else if (diff < 0) {
      // UserLevel tem MAIS que o audit - MANTER (política de não remover)
      console.log(`⚠️  ${user.username}: UserLevel tem ${xpFromLevel}, Audit tem ${xpFromAudit} (${diff} XP)`);
      console.log(`   → Mantendo ${xpFromLevel} XP (política: nunca remover)`);
      skipped++;
    } else {
      console.log(`✓  ${user.username}: ${xpFromLevel} XP (consistente)`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('📊 RESUMO');
  console.log('═'.repeat(80));
  console.log(`   Usuários corrigidos (XP adicionado): ${corrected}`);
  console.log(`   Usuários com excesso de XP (mantido): ${skipped}`);
  console.log(`   Total de usuários: ${users.length}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
