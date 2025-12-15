/**
 * 🔍 AUDITORIA COMPLETA DE NÍVEIS E XP
 * Verifica se há bugs no sistema de níveis
 * 
 * Análises:
 * 1. Comparar XP registrado vs XP calculado do audit log
 * 2. Verificar se o nível está correto para o XP total
 * 3. Identificar ganhos de XP anormais (muito rápidos)
 * 4. Verificar duplicação de XP
 * 5. Analisar progressão de níveis por tempo
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

// Tabela de XP por nível para referência
function printLevelTable() {
  console.log('\n📊 TABELA DE NÍVEIS E XP NECESSÁRIO:');
  console.log('═══════════════════════════════════════════');
  let totalAccumulated = 0;
  for (let level = 2; level <= 15; level++) {
    const xpNeeded = getXPForLevel(level);
    totalAccumulated += xpNeeded;
    console.log(`  Nível ${level.toString().padStart(2)}: ${xpNeeded.toString().padStart(5)} XP (Total acumulado: ${totalAccumulated})`);
  }
  console.log('  ...');
  console.log(`  Nível 20: ${getXPForLevel(20)} XP (Total: ${getTotalXPForLevel(20)})`);
  console.log(`  Nível 50: ${getXPForLevel(50)} XP (Total: ${getTotalXPForLevel(50)})`);
  console.log('═══════════════════════════════════════════\n');
}

async function auditAllUsers() {
  console.log('🔍 AUDITORIA COMPLETA DE NÍVEIS E XP');
  console.log('════════════════════════════════════════════════════════════\n');
  
  printLevelTable();

  // 1. Buscar todos os usuários com seus níveis
  const users = await prisma.user.findMany({
    include: {
      levelData: true
    },
    orderBy: { username: 'asc' }
  });

  console.log(`📊 Total de usuários: ${users.length}\n`);

  const issues: { user: string; issue: string; severity: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];

  for (const user of users) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`👤 ${user.username.toUpperCase()} (${user.name})`);
    console.log(`${'═'.repeat(60)}`);

    if (!user.levelData) {
      console.log('  ⚠️ Sem dados de nível');
      issues.push({ user: user.username, issue: 'Sem dados de nível', severity: 'MEDIUM' });
      continue;
    }

    const levelData = user.levelData;
    
    // Dados atuais
    console.log(`\n📈 DADOS ATUAIS:`);
    console.log(`  • Nível: ${levelData.level}`);
    console.log(`  • XP Total: ${levelData.totalXP}`);
    console.log(`  • XP no nível atual: ${levelData.xp}`);
    console.log(`  • Streak: ${levelData.streak} (Melhor: ${levelData.bestStreak})`);
    console.log(`  • Atualizado: ${levelData.updatedAt.toISOString()}`);

    // Verificar se o nível está correto para o XP
    const expectedLevel = calculateLevel(levelData.totalXP);
    if (levelData.level !== expectedLevel) {
      console.log(`\n  ❌ BUG DETECTADO: Nível incorreto!`);
      console.log(`     → Nível registrado: ${levelData.level}`);
      console.log(`     → Nível esperado para ${levelData.totalXP} XP: ${expectedLevel}`);
      issues.push({ 
        user: user.username, 
        issue: `Nível ${levelData.level} mas deveria ser ${expectedLevel} para ${levelData.totalXP} XP`, 
        severity: 'HIGH' 
      });
    } else {
      console.log(`  ✅ Nível correto para o XP total`);
    }

    // Buscar logs de auditoria
    const auditLogs = await prisma.xPAuditLog.findMany({
      where: { 
        userId: user.id,
        status: 'confirmed'
      },
      orderBy: { timestamp: 'asc' }
    });

    console.log(`\n📜 HISTÓRICO DE AUDITORIA:`);
    console.log(`  • Total de transações: ${auditLogs.length}`);

    if (auditLogs.length > 0) {
      // Soma total do audit log
      const auditTotal = auditLogs.reduce((sum, log) => sum + log.amount, 0);
      console.log(`  • Soma do audit log: ${auditTotal} XP`);
      
      // Verificar discrepância
      const discrepancy = levelData.totalXP - auditTotal;
      if (Math.abs(discrepancy) > 1) {
        console.log(`\n  ⚠️ DISCREPÂNCIA DETECTADA:`);
        console.log(`     → XP no UserLevel: ${levelData.totalXP}`);
        console.log(`     → Soma do Audit: ${auditTotal}`);
        console.log(`     → Diferença: ${discrepancy}`);
        issues.push({ 
          user: user.username, 
          issue: `Discrepância de ${discrepancy} XP entre UserLevel (${levelData.totalXP}) e Audit (${auditTotal})`, 
          severity: Math.abs(discrepancy) > 100 ? 'HIGH' : 'MEDIUM' 
        });
      }

      // Analisar ganhos por fonte
      const bySource: Record<string, { count: number; total: number }> = {};
      for (const log of auditLogs) {
        if (!bySource[log.source]) {
          bySource[log.source] = { count: 0, total: 0 };
        }
        bySource[log.source].count++;
        bySource[log.source].total += log.amount;
      }

      console.log(`\n📊 XP POR FONTE:`);
      for (const [source, data] of Object.entries(bySource).sort((a, b) => b[1].total - a[1].total)) {
        console.log(`  • ${source}: ${data.total} XP (${data.count} ações)`);
      }

      // Verificar duplicações possíveis
      const duplicateCheck = new Map<string, { count: number; logs: typeof auditLogs }>();
      for (const log of auditLogs) {
        if (log.sourceIdentifier) {
          const existing = duplicateCheck.get(log.sourceIdentifier);
          if (existing) {
            existing.count++;
            existing.logs.push(log);
          } else {
            duplicateCheck.set(log.sourceIdentifier, { count: 1, logs: [log] });
          }
        }
      }

      const duplicates = Array.from(duplicateCheck.entries()).filter(([_, v]) => v.count > 1);
      if (duplicates.length > 0) {
        console.log(`\n  ❌ DUPLICAÇÕES ENCONTRADAS:`);
        for (const [key, { count, logs }] of duplicates) {
          console.log(`     → ${key}: ${count}x`);
          const xpDuplicado = logs.slice(1).reduce((sum, l) => sum + l.amount, 0);
          console.log(`       XP duplicado: ${xpDuplicado}`);
          issues.push({ 
            user: user.username, 
            issue: `Duplicação: ${key} (${count}x, ${xpDuplicado} XP extra)`, 
            severity: 'HIGH' 
          });
        }
      }

      // Analisar progressão temporal
      const firstLog = auditLogs[0];
      const lastLog = auditLogs[auditLogs.length - 1];
      const daysDiff = (lastLog.timestamp.getTime() - firstLog.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      
      console.log(`\n⏱️ PROGRESSÃO TEMPORAL:`);
      console.log(`  • Primeiro XP: ${firstLog.timestamp.toISOString().split('T')[0]}`);
      console.log(`  • Último XP: ${lastLog.timestamp.toISOString().split('T')[0]}`);
      console.log(`  • Período: ${daysDiff.toFixed(1)} dias`);
      
      if (daysDiff > 0) {
        const xpPerDay = auditTotal / daysDiff;
        console.log(`  • Média: ${xpPerDay.toFixed(1)} XP/dia`);
        
        if (xpPerDay > 500) {
          console.log(`\n  ⚠️ ALERTA: Ganho de XP muito rápido (${xpPerDay.toFixed(0)} XP/dia)`);
          issues.push({ 
            user: user.username, 
            issue: `Ganho de XP muito rápido: ${xpPerDay.toFixed(0)} XP/dia`, 
            severity: 'HIGH' 
          });
        }
      }

      // Verificar picos de XP em um único dia
      const xpByDay = new Map<string, number>();
      for (const log of auditLogs) {
        const day = log.timestamp.toISOString().split('T')[0];
        xpByDay.set(day, (xpByDay.get(day) || 0) + log.amount);
      }

      const highDays = Array.from(xpByDay.entries())
        .filter(([_, xp]) => xp > 300)
        .sort((a, b) => b[1] - a[1]);

      if (highDays.length > 0) {
        console.log(`\n📅 DIAS COM ALTO XP (>300):`);
        for (const [day, xp] of highDays.slice(0, 5)) {
          console.log(`  • ${day}: ${xp} XP`);
          
          // Detalhar o que aconteceu nesse dia
          const dayLogs = auditLogs.filter(l => l.timestamp.toISOString().split('T')[0] === day);
          const dayBySource: Record<string, number> = {};
          for (const log of dayLogs) {
            dayBySource[log.source] = (dayBySource[log.source] || 0) + log.amount;
          }
          for (const [source, amount] of Object.entries(dayBySource)) {
            console.log(`    - ${source}: ${amount}`);
          }
        }
      }

      // Verificar conquistas que dão muito XP
      const achievementLogs = auditLogs.filter(l => l.source === 'achievement');
      if (achievementLogs.length > 0) {
        console.log(`\n🏆 XP DE CONQUISTAS:`);
        const achievementTotal = achievementLogs.reduce((sum, l) => sum + l.amount, 0);
        console.log(`  • Total: ${achievementTotal} XP (${achievementLogs.length} conquistas)`);
        
        // Listar conquistas que deram muito XP
        const bigAchievements = achievementLogs.filter(l => l.amount >= 50);
        if (bigAchievements.length > 0) {
          console.log(`  • Conquistas de alto XP:`);
          for (const ach of bigAchievements.sort((a, b) => b.amount - a.amount).slice(0, 10)) {
            console.log(`    - ${ach.reason}: ${ach.amount} XP`);
          }
        }
      }

      // Verificar transações recentes (últimas 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentLogs = auditLogs.filter(l => l.timestamp > oneDayAgo);
      if (recentLogs.length > 0) {
        const recentXP = recentLogs.reduce((sum, l) => sum + l.amount, 0);
        console.log(`\n🕐 ÚLTIMAS 24 HORAS:`);
        console.log(`  • Transações: ${recentLogs.length}`);
        console.log(`  • XP ganho: ${recentXP}`);
        
        if (recentXP > 200) {
          console.log(`  ⚠️ Alto XP nas últimas 24h`);
          for (const log of recentLogs.slice(-10)) {
            console.log(`    - ${log.source}: ${log.amount} XP (${log.reason})`);
          }
        }
      }
    }
  }

  // Resumo de problemas
  console.log('\n\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 RESUMO DE PROBLEMAS ENCONTRADOS');
  console.log('═══════════════════════════════════════════════════════════════');

  if (issues.length === 0) {
    console.log('\n✅ Nenhum problema encontrado!\n');
  } else {
    const high = issues.filter(i => i.severity === 'HIGH');
    const medium = issues.filter(i => i.severity === 'MEDIUM');
    const low = issues.filter(i => i.severity === 'LOW');

    if (high.length > 0) {
      console.log('\n🔴 ALTA SEVERIDADE:');
      for (const issue of high) {
        console.log(`  • ${issue.user}: ${issue.issue}`);
      }
    }

    if (medium.length > 0) {
      console.log('\n🟡 MÉDIA SEVERIDADE:');
      for (const issue of medium) {
        console.log(`  • ${issue.user}: ${issue.issue}`);
      }
    }

    if (low.length > 0) {
      console.log('\n🟢 BAIXA SEVERIDADE:');
      for (const issue of low) {
        console.log(`  • ${issue.user}: ${issue.issue}`);
      }
    }

    console.log(`\nTotal de problemas: ${issues.length}`);
  }

  // Ranking de níveis
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏆 RANKING DE NÍVEIS');
  console.log('═══════════════════════════════════════════════════════════════');

  const usersWithLevels = users
    .filter(u => u.levelData)
    .sort((a, b) => (b.levelData?.totalXP || 0) - (a.levelData?.totalXP || 0));

  for (let i = 0; i < usersWithLevels.length; i++) {
    const u = usersWithLevels[i];
    const ld = u.levelData!;
    console.log(`  ${(i + 1).toString().padStart(2)}. ${u.username.padEnd(15)} - Nível ${ld.level.toString().padStart(2)} (${ld.totalXP.toString().padStart(5)} XP)`);
  }

  await prisma.$disconnect();
}

// Análise específica de um usuário
async function auditSpecificUser(username: string) {
  console.log(`\n🔍 AUDITORIA DETALHADA: ${username.toUpperCase()}`);
  console.log('═'.repeat(60));

  const user = await prisma.user.findFirst({
    where: { username: { contains: username, mode: 'insensitive' } },
    include: { levelData: true }
  });

  if (!user) {
    console.log('❌ Usuário não encontrado');
    return;
  }

  // Buscar TODAS as transações (incluindo pending/failed)
  const allLogs = await prisma.xPAuditLog.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: 'asc' }
  });

  console.log(`\n📜 TODAS AS TRANSAÇÕES (${allLogs.length} total):`);
  
  const byStatus: Record<string, number> = {};
  for (const log of allLogs) {
    byStatus[log.status] = (byStatus[log.status] || 0) + 1;
  }
  
  console.log('\nPor status:');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  • ${status}: ${count}`);
  }

  // Mostrar últimas 50 transações detalhadas
  console.log('\n📝 ÚLTIMAS 50 TRANSAÇÕES:');
  const recentLogs = allLogs.slice(-50);
  
  for (const log of recentLogs) {
    const statusIcon = log.status === 'confirmed' ? '✅' : log.status === 'pending' ? '⏳' : '❌';
    console.log(`  ${statusIcon} ${log.timestamp.toISOString().substring(0, 19)} | ${log.source.padEnd(15)} | ${log.amount.toString().padStart(4)} XP | ${log.reason.substring(0, 40)}`);
  }

  await prisma.$disconnect();
}

// Executar
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    await auditSpecificUser(args[0]);
  } else {
    await auditAllUsers();
  }
}

main().catch(console.error);
