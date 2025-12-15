/**
 * 🔧 FIX USER LEVELS
 * 
 * Recalcula o nível de todos os usuários baseado no totalXP
 * Corrige inconsistências entre totalXP e level
 * 
 * USO:
 * npx ts-node scripts/fix-user-levels.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// Configuração do sistema de níveis (deve ser igual ao frontend e backend)
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

async function main() {
  console.log('\n🔧 FIX USER LEVELS\n');
  console.log('='.repeat(60));

  // Buscar todos os user levels
  const userLevels = await prisma.userLevel.findMany({
    include: {
      user: {
        select: { username: true, name: true }
      }
    }
  });

  console.log(`\n📊 Encontrados ${userLevels.length} registros de nível\n`);

  // Mostrar tabela de referência de níveis
  console.log('📋 Tabela de referência:');
  console.log(''.padStart(50, '-'));
  for (let lvl = 1; lvl <= 10; lvl++) {
    const xpForNext = getXPForLevel(lvl + 1);
    const totalToReach = getTotalXPForLevel(lvl);
    console.log(`  Nível ${lvl.toString().padStart(2)}: XP total >= ${totalToReach.toString().padStart(5)} (próximo: +${xpForNext})`);
  }
  console.log(''.padStart(50, '-'));

  // Processar cada usuário
  let fixed = 0;
  let correct = 0;
  
  for (const ul of userLevels) {
    const calculatedLevel = calculateLevel(ul.totalXP);
    const calculatedXP = calculateCurrentLevelXP(ul.totalXP, calculatedLevel);
    
    const isLevelCorrect = ul.level === calculatedLevel;
    const isXPCorrect = ul.xp === calculatedXP;
    
    if (!isLevelCorrect || !isXPCorrect) {
      console.log(`\n⚠️  ${ul.user?.name || ul.userId}`);
      console.log(`   Total XP: ${ul.totalXP}`);
      console.log(`   Nível atual: ${ul.level} → Correto: ${calculatedLevel}`);
      console.log(`   XP no nível: ${ul.xp} → Correto: ${calculatedXP}`);
      
      // Corrigir
      await prisma.userLevel.update({
        where: { id: ul.id },
        data: {
          level: calculatedLevel,
          xp: calculatedXP
        }
      });
      
      console.log(`   ✅ Corrigido!`);
      fixed++;
    } else {
      console.log(`✓ ${ul.user?.name || ul.userId}: Nível ${ul.level} com ${ul.totalXP} XP total - OK`);
      correct++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 RESUMO:`);
  console.log(`   ✅ Corretos: ${correct}`);
  console.log(`   🔧 Corrigidos: ${fixed}`);
  console.log(`   📊 Total: ${userLevels.length}\n`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((error) => {
  console.error('Erro:', error);
  process.exit(1);
});
