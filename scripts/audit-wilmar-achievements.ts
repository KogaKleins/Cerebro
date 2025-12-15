/**
 * 🔍 AUDITORIA COMPLETA DE CONQUISTAS - WILMAR
 * 
 * Verifica todas as conquistas do Wilmar e compara com dados reais
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
  
  console.log('═'.repeat(70));
  console.log('🔍 AUDITORIA DE CONQUISTAS - WILMAR');
  console.log('═'.repeat(70));
  
  // ═══════════════════════════════════════════════════════════════
  // 1. BUSCAR USUÁRIO WILMAR
  // ═══════════════════════════════════════════════════════════════
  const wilmar = await prisma.user.findUnique({ where: { username: 'wilmar' } });
  if (!wilmar) {
    console.log('❌ Usuario wilmar nao encontrado!');
    return;
  }
  
  console.log('\n👤 USUÁRIO:', wilmar.name, '(@' + wilmar.username + ')');
  console.log('   ID:', wilmar.id);
  
  // ═══════════════════════════════════════════════════════════════
  // 2. VERIFICAR CAFÉS FEITOS (type = MADE)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n☕ CAFÉS FEITOS (type=MADE):');
  const cafesMade = await prisma.coffee.findMany({ 
    where: { makerId: wilmar.id, type: 'MADE' },
    orderBy: { timestamp: 'asc' }
  });
  console.log('   Total:', cafesMade.length);
  if (cafesMade.length > 0) {
    cafesMade.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.timestamp.toISOString().slice(0,16)} | ID: ${c.id.slice(0,8)}`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 3. VERIFICAR CAFÉS TRAZIDOS (type = BROUGHT)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🛒 CAFÉS TRAZIDOS (type=BROUGHT):');
  const cafesBrought = await prisma.coffee.findMany({ 
    where: { makerId: wilmar.id, type: 'BROUGHT' },
    orderBy: { timestamp: 'asc' }
  });
  console.log('   Total:', cafesBrought.length);
  if (cafesBrought.length > 0) {
    cafesBrought.forEach((c, i) => {
      console.log(`   ${i+1}. ${c.timestamp.toISOString().slice(0,16)} | ID: ${c.id.slice(0,8)}`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 4. TODAS AS CONQUISTAS DO WILMAR
  // ═══════════════════════════════════════════════════════════════
  console.log('\n🏆 CONQUISTAS DESBLOQUEADAS:');
  const achievements = await prisma.achievement.findMany({ 
    where: { userId: wilmar.id },
    orderBy: { unlockedAt: 'asc' }
  });
  
  if (achievements.length === 0) {
    console.log('   (nenhuma conquista)');
  } else {
    achievements.forEach((a, i) => {
      console.log(`   ${i+1}. [${a.type}] ${a.title}`);
      console.log(`      Descrição: ${a.description || 'N/A'}`);
      console.log(`      Desbloqueada: ${a.unlockedAt.toISOString().slice(0,16)}`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 5. ANÁLISE DE CONQUISTAS INCORRETAS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📊 ANÁLISE DE INCONSISTÊNCIAS');
  console.log('═'.repeat(70));
  
  // Lista de conquistas relacionadas a café
  const coffeeAchievements = [
    // Cafés FEITOS
    { type: 'first-coffee', name: 'Primeiro Café', req: 1, field: 'MADE' },
    { type: 'coffee-lover', name: 'Amante do Café', req: 10, field: 'MADE' },
    { type: 'barista-junior', name: 'Barista Jr.', req: 25, field: 'MADE' },
    { type: 'barista-senior', name: 'Barista Sênior', req: 50, field: 'MADE' },
    { type: 'coffee-master', name: 'Mestre do Café', req: 100, field: 'MADE' },
    // Cafés TRAZIDOS
    { type: 'first-supply', name: 'Primeiro Suprimento', req: 1, field: 'BROUGHT' },
    { type: 'supplier', name: 'Fornecedor', req: 5, field: 'BROUGHT' },
    { type: 'generous', name: 'Generoso', req: 15, field: 'BROUGHT' },
  ];
  
  // Conquistas de tempo/dia especial
  const timeAchievements = [
    { type: 'friday-finisher', name: 'Finalizador da Sexta', desc: 'Café na sexta após 14h' },
    { type: 'early-bird', name: 'Madrugador', desc: 'Café antes das 7h' },
    { type: 'night-owl', name: 'Coruja', desc: 'Café após 20h' },
    { type: 'monday-hero', name: 'Herói de Segunda', desc: 'Café segunda antes das 10h' },
    { type: 'weekend-warrior', name: 'Guerreiro do Fim de Semana', desc: 'Café no fim de semana' },
  ];
  
  console.log('\n📋 CONQUISTAS DE QUANTIDADE DE CAFÉ:');
  for (const ach of coffeeAchievements) {
    const count = ach.field === 'MADE' ? cafesMade.length : cafesBrought.length;
    const hasAch = achievements.some(a => a.type === ach.type);
    const shouldHave = count >= ach.req;
    
    let status = '';
    if (hasAch && !shouldHave) {
      status = '❌ INDEVIDA (tem conquista mas não deveria)';
    } else if (!hasAch && shouldHave) {
      status = '⚠️ FALTANDO (deveria ter mas não tem)';
    } else if (hasAch && shouldHave) {
      status = '✅ OK';
    } else {
      status = '➖ N/A (ainda não atingiu)';
    }
    
    console.log(`   ${ach.type}: ${status}`);
    console.log(`      Requisito: ${ach.req} ${ach.field} | Atual: ${count}`);
  }
  
  console.log('\n📋 CONQUISTAS DE HORÁRIO ESPECIAL:');
  for (const ach of timeAchievements) {
    const hasAch = achievements.some(a => a.type === ach.type);
    
    // Verificar se algum café FEITO atende ao requisito
    let qualifies = false;
    for (const cafe of cafesMade) {
      const d = cafe.timestamp;
      const day = d.getDay();
      const hour = d.getHours();
      
      if (ach.type === 'friday-finisher' && day === 5 && hour >= 14) qualifies = true;
      if (ach.type === 'early-bird' && hour < 7) qualifies = true;
      if (ach.type === 'night-owl' && hour >= 20) qualifies = true;
      if (ach.type === 'monday-hero' && day === 1 && hour < 10) qualifies = true;
      if (ach.type === 'weekend-warrior' && (day === 0 || day === 6)) qualifies = true;
    }
    
    let status = '';
    if (hasAch && !qualifies) {
      status = '❌ INDEVIDA (tem conquista mas não deveria)';
    } else if (!hasAch && qualifies) {
      status = '⚠️ FALTANDO (deveria ter mas não tem)';
    } else if (hasAch && qualifies) {
      status = '✅ OK';
    } else {
      status = '➖ N/A (nenhum café nesse horário)';
    }
    
    console.log(`   ${ach.type}: ${status}`);
    console.log(`      Requisito: ${ach.desc}`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 6. VERIFICAR LOGS DE XP RELACIONADOS A CONQUISTAS DE CAFÉ
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📜 LOGS DE XP DE CONQUISTAS:');
  const xpAchLogs = await prisma.xPAuditLog.findMany({
    where: { 
      userId: wilmar.id, 
      source: 'achievement'
    },
    orderBy: { timestamp: 'desc' }
  });
  
  if (xpAchLogs.length === 0) {
    console.log('   (nenhum log de XP de conquista)');
  } else {
    xpAchLogs.forEach((l, i) => {
      console.log(`   ${i+1}. ${l.timestamp.toISOString().slice(0,16)} | +${l.amount} XP | ${l.reason}`);
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // 7. RESUMO FINAL
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📝 RESUMO FINAL');
  console.log('═'.repeat(70));
  console.log(`   Cafés FEITOS (MADE): ${cafesMade.length}`);
  console.log(`   Cafés TRAZIDOS (BROUGHT): ${cafesBrought.length}`);
  console.log(`   Total de conquistas: ${achievements.length}`);
  
  // Contar problemas
  let problemas = 0;
  
  // Verificar first-supply
  if (achievements.some(a => a.type === 'first-supply') && cafesBrought.length < 1) {
    console.log('\n   ❌ PROBLEMA: Tem "Primeiro Suprimento" mas TROUXE 0 cafés');
    problemas++;
  }
  
  // Verificar first-coffee
  if (achievements.some(a => a.type === 'first-coffee') && cafesMade.length < 1) {
    console.log('\n   ❌ PROBLEMA: Tem "Primeiro Café" mas FEZ 0 cafés');
    problemas++;
  }
  
  // Verificar friday-finisher sem café na sexta
  const hasFridayAch = achievements.some(a => a.type === 'friday-finisher');
  const hasFridayCoffee = cafesMade.some(c => c.timestamp.getDay() === 5 && c.timestamp.getHours() >= 14);
  if (hasFridayAch && !hasFridayCoffee) {
    console.log('\n   ❌ PROBLEMA: Tem "Finalizador da Sexta" mas NUNCA fez café na sexta à tarde');
    problemas++;
  }
  
  if (problemas === 0) {
    console.log('\n   ✅ Nenhum problema encontrado');
  } else {
    console.log(`\n   ⚠️ ${problemas} problema(s) encontrado(s)`);
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
