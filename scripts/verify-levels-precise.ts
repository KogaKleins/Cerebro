/**
 * 🔍 VERIFICAÇÃO PRECISA DE NÍVEIS
 * Comparar nível atual vs nível correto para cada usuário
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

async function verifyLevels() {
  console.log('🔍 VERIFICAÇÃO PRECISA DE NÍVEIS');
  console.log('════════════════════════════════════════════════════════════\n');

  // Tabela de referência
  console.log('📊 TABELA DE REFERÊNCIA - XP necessário por nível:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Nível │ XP para subir │ XP Total Acumulado');
  console.log('─────────────────────────────────────────────────────────────');
  
  for (let level = 1; level <= 15; level++) {
    const xpToNext = getXPForLevel(level + 1);
    const totalXP = getTotalXPForLevel(level);
    const totalXPNext = getTotalXPForLevel(level + 1);
    console.log(`    ${level.toString().padStart(2)} │    ${xpToNext.toString().padStart(5)} XP │ ${totalXP.toString().padStart(6)} - ${totalXPNext.toString().padStart(6)} XP`);
  }
  console.log('─────────────────────────────────────────────────────────────\n');

  // Verificar cada usuário
  const users = await prisma.user.findMany({
    include: { levelData: true },
    orderBy: { username: 'asc' }
  });

  console.log('👥 VERIFICAÇÃO POR USUÁRIO:');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  Usuário     │ XP Total │ Nível Atual │ Nível Correto │ Status');
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  const corrections: { userId: string; username: string; currentLevel: number; correctLevel: number; totalXP: number }[] = [];

  for (const user of users) {
    if (!user.levelData) continue;
    
    const totalXP = user.levelData.totalXP;
    const currentLevel = user.levelData.level;
    const correctLevel = calculateLevel(totalXP);
    
    const status = currentLevel === correctLevel ? '✅ OK' : `❌ ERRADO (+${currentLevel - correctLevel})`;
    
    console.log(`  ${user.username.padEnd(11)} │ ${totalXP.toString().padStart(8)} │      ${currentLevel.toString().padStart(2)}      │       ${correctLevel.toString().padStart(2)}      │ ${status}`);
    
    if (currentLevel !== correctLevel) {
      corrections.push({
        userId: user.id,
        username: user.username,
        currentLevel,
        correctLevel,
        totalXP
      });
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  // Explicação detalhada para Chris
  console.log('\n📝 EXPLICAÇÃO DETALHADA - CHRIS:');
  console.log('─────────────────────────────────────────────────────────────');
  const chris = users.find(u => u.username.toLowerCase() === 'chris');
  if (chris?.levelData) {
    const xp = chris.levelData.totalXP;
    console.log(`  XP Total: ${xp}`);
    console.log(`  Nível 9 requer: ${getTotalXPForLevel(9)} XP (mínimo) a ${getTotalXPForLevel(10) - 1} XP (máximo)`);
    console.log(`  Nível 10 requer: ${getTotalXPForLevel(10)} XP (mínimo)`);
    console.log(`  ${xp} XP está no intervalo do nível ${calculateLevel(xp)}`);
    console.log(`  Nível atual no banco: ${chris.levelData.level}`);
  }

  // Resumo de correções necessárias
  if (corrections.length > 0) {
    console.log('\n\n🔧 CORREÇÕES NECESSÁRIAS:');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    for (const c of corrections) {
      console.log(`  • ${c.username}: Nível ${c.currentLevel} → ${c.correctLevel} (tem ${c.totalXP} XP)`);
    }
    console.log('\n⚠️  Execute o script fix-user-levels.ts para corrigir automaticamente.');
  } else {
    console.log('\n✅ Todos os níveis estão corretos!');
  }

  await prisma.$disconnect();
  
  return corrections;
}

verifyLevels().catch(console.error);
