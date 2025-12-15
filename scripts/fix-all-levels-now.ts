/**
 * 🔧 CORREÇÃO DE NÍVEIS - Recalcula todos os níveis baseado no XP total
 * 
 * Este script corrige o bug onde os níveis estavam sendo calculados
 * com uma fórmula incorreta (quadrática) ao invés da fórmula correta
 * (exponencial com base 100 e expoente 1.5).
 */

import 'dotenv/config';
import { getPrismaClient } from '../src/repositories';

const prisma = getPrismaClient();

// Configuração de níveis (igual ao sistema)
const LEVEL_CONFIG = {
  baseXP: 100,
  exponent: 1.5,
  maxLevel: 100
};

function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(LEVEL_CONFIG.baseXP * Math.pow(level - 1, LEVEL_CONFIG.exponent));
}

function getTotalXPForLevel(level: number): number {
  let total = 0;
  for (let i = 2; i <= level; i++) {
    total += getXPForLevel(i);
  }
  return total;
}

function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;

  while (level < LEVEL_CONFIG.maxLevel) {
    const nextLevelXP = getXPForLevel(level + 1);
    if (totalXP < xpNeeded + nextLevelXP) {
      break;
    }
    xpNeeded += nextLevelXP;
    level++;
  }

  return level;
}

function calculateCurrentLevelXP(totalXP: number, level: number): number {
  const xpForPreviousLevels = getTotalXPForLevel(level);
  return totalXP - xpForPreviousLevels;
}

async function fixAllLevels() {
  console.log('🔧 CORREÇÃO DE NÍVEIS');
  console.log('════════════════════════════════════════════════════════════\n');

  const users = await prisma.user.findMany({
    include: { levelData: true },
    orderBy: { username: 'asc' }
  });

  let corrected = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.levelData) {
      console.log(`⚠️ ${user.username}: Sem dados de nível`);
      skipped++;
      continue;
    }

    const totalXP = user.levelData.totalXP;
    const currentLevel = user.levelData.level;
    const correctLevel = calculateLevel(totalXP);
    const correctXP = calculateCurrentLevelXP(totalXP, correctLevel);

    if (currentLevel !== correctLevel) {
      console.log(`🔧 ${user.username}:`);
      console.log(`   • XP Total: ${totalXP}`);
      console.log(`   • Nível atual: ${currentLevel} → Correto: ${correctLevel}`);
      console.log(`   • XP no nível: ${user.levelData.xp} → Correto: ${correctXP}`);

      // Corrigir no banco
      await prisma.userLevel.update({
        where: { userId: user.id },
        data: {
          level: correctLevel,
          xp: correctXP
        }
      });

      console.log(`   ✅ Corrigido!\n`);
      corrected++;
    } else {
      console.log(`✅ ${user.username}: Nível ${currentLevel} correto para ${totalXP} XP`);
      skipped++;
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`📊 RESUMO:`);
  console.log(`   • Corrigidos: ${corrected}`);
  console.log(`   • Já corretos: ${skipped}`);
  console.log('════════════════════════════════════════════════════════════\n');

  // Verificação final
  console.log('🔍 VERIFICAÇÃO FINAL:');
  const usersAfter = await prisma.user.findMany({
    include: { levelData: true },
    orderBy: { username: 'asc' }
  });

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  Usuário     │ XP Total │ Nível │ XP no Nível │ Status');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  for (const user of usersAfter) {
    if (!user.levelData) continue;
    
    const totalXP = user.levelData.totalXP;
    const level = user.levelData.level;
    const correctLevel = calculateLevel(totalXP);
    const status = level === correctLevel ? '✅ OK' : '❌ ERRO';
    
    console.log(`  ${user.username.padEnd(11)} │ ${totalXP.toString().padStart(8)} │   ${level.toString().padStart(2)}  │    ${user.levelData.xp.toString().padStart(5)}    │ ${status}`);
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

fixAllLevels().catch(console.error);
