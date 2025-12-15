/**
 * 🔍 AUDITORIA COMPLETA DO SISTEMA DE CONQUISTAS
 * 
 * Este script verifica TODOS os usuários e identifica:
 * 1. Conquistas dadas indevidamente
 * 2. Conquistas que deveriam existir mas não existem
 * 3. Inconsistências nos dados
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface AchievementProblem {
  userId: string;
  username: string;
  achievementType: string;
  achievementTitle: string;
  problem: 'INDEVIDA' | 'FALTANDO';
  reason: string;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  
  console.log('═'.repeat(70));
  console.log('🔍 AUDITORIA COMPLETA DO SISTEMA DE CONQUISTAS');
  console.log('═'.repeat(70));
  
  const problems: AchievementProblem[] = [];
  
  // ═══════════════════════════════════════════════════════════════
  // 1. BUSCAR TODOS OS USUÁRIOS
  // ═══════════════════════════════════════════════════════════════
  const users = await prisma.user.findMany({});
  console.log(`\n👥 Total de usuários: ${users.length}`);
  
  for (const user of users) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`👤 Verificando: ${user.name} (@${user.username})`);
    
    // ═══════════════════════════════════════════════════════════════
    // 2. BUSCAR DADOS DO USUÁRIO
    // ═══════════════════════════════════════════════════════════════
    const cafesMade = await prisma.coffee.findMany({ 
      where: { makerId: user.id, type: 'MADE' }
    });
    
    const cafesBrought = await prisma.coffee.findMany({ 
      where: { makerId: user.id, type: 'BROUGHT' }
    });
    
    const achievements = await prisma.achievement.findMany({ 
      where: { userId: user.id }
    });
    
    const messages = await prisma.message.count({
      where: { authorId: user.id, deletedAt: null }
    });
    
    const ratingsGiven = await prisma.rating.count({
      where: { userId: user.id }
    });
    
    const fiveStarsReceived = await prisma.rating.count({
      where: { 
        coffee: { makerId: user.id },
        rating: 5
      }
    });
    
    console.log(`   ☕ Cafés feitos: ${cafesMade.length}`);
    console.log(`   🛒 Cafés trazidos: ${cafesBrought.length}`);
    console.log(`   💬 Mensagens: ${messages}`);
    console.log(`   ⭐ Avaliações dadas: ${ratingsGiven}`);
    console.log(`   🌟 5 estrelas recebidas: ${fiveStarsReceived}`);
    console.log(`   🏆 Conquistas: ${achievements.length}`);
    
    // ═══════════════════════════════════════════════════════════════
    // 3. VERIFICAR CONQUISTAS DE CAFÉ FEITO (MADE)
    // ═══════════════════════════════════════════════════════════════
    const coffeeAchievements = [
      { type: 'first-coffee', title: 'Primeiro Café', req: 1 },
      { type: 'coffee-lover', title: 'Amante do Café', req: 10 },
      { type: 'barista-junior', title: 'Barista Jr.', req: 25 },
      { type: 'barista-senior', title: 'Barista Sênior', req: 50 },
      { type: 'coffee-master', title: 'Mestre do Café', req: 100 },
      { type: 'coffee-legend', title: 'Lenda do Café', req: 250 },
      { type: 'coffee-god', title: 'Deus do Café', req: 500 },
    ];
    
    for (const ach of coffeeAchievements) {
      const has = achievements.some(a => a.type === ach.type);
      const should = cafesMade.length >= ach.req;
      
      if (has && !should) {
        problems.push({
          userId: user.id,
          username: user.username,
          achievementType: ach.type,
          achievementTitle: ach.title,
          problem: 'INDEVIDA',
          reason: `Tem ${cafesMade.length} cafés feitos, requisito é ${ach.req}`
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 4. VERIFICAR CONQUISTAS DE CAFÉ TRAZIDO (BROUGHT)
    // ═══════════════════════════════════════════════════════════════
    const supplyAchievements = [
      { type: 'first-supply', title: 'Primeiro Suprimento', req: 1 },
      { type: 'supplier', title: 'Fornecedor', req: 5 },
      { type: 'generous', title: 'Generoso', req: 15 },
      { type: 'benefactor', title: 'Benfeitor', req: 30 },
      { type: 'philanthropist', title: 'Filantropo do Café', req: 50 },
      { type: 'supply-king', title: 'Rei dos Suprimentos', req: 100 },
      { type: 'supply-legend', title: 'Lenda do Abastecimento', req: 200 },
    ];
    
    for (const ach of supplyAchievements) {
      const has = achievements.some(a => a.type === ach.type);
      const should = cafesBrought.length >= ach.req;
      
      if (has && !should) {
        problems.push({
          userId: user.id,
          username: user.username,
          achievementType: ach.type,
          achievementTitle: ach.title,
          problem: 'INDEVIDA',
          reason: `Tem ${cafesBrought.length} cafés trazidos, requisito é ${ach.req}`
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 5. VERIFICAR CONQUISTAS DE HORÁRIO ESPECIAL
    // (Só devem contar cafés FEITOS, não TRAZIDOS!)
    // ═══════════════════════════════════════════════════════════════
    const hasEarlyCoffee = cafesMade.some(c => c.timestamp.getHours() < 7);
    const hasLateCoffee = cafesMade.some(c => c.timestamp.getHours() >= 20);
    const hasWeekendCoffee = cafesMade.some(c => [0, 6].includes(c.timestamp.getDay()));
    const hasMondayCoffee = cafesMade.some(c => c.timestamp.getDay() === 1 && c.timestamp.getHours() < 10);
    const hasFridayCoffee = cafesMade.some(c => c.timestamp.getDay() === 5 && c.timestamp.getHours() >= 14);
    
    const timeAchievements = [
      { type: 'early-bird', title: 'Madrugador', has: hasEarlyCoffee },
      { type: 'night-owl', title: 'Coruja Noturna', has: hasLateCoffee },
      { type: 'weekend-warrior', title: 'Guerreiro de Fim de Semana', has: hasWeekendCoffee },
      { type: 'monday-hero', title: 'Herói de Segunda', has: hasMondayCoffee },
      { type: 'friday-finisher', title: 'Finalizador da Sexta', has: hasFridayCoffee },
    ];
    
    for (const ach of timeAchievements) {
      const hasAch = achievements.some(a => a.type === ach.type);
      
      if (hasAch && !ach.has) {
        problems.push({
          userId: user.id,
          username: user.username,
          achievementType: ach.type,
          achievementTitle: ach.title,
          problem: 'INDEVIDA',
          reason: `Não tem nenhum café FEITO nesse horário/dia (pode ter apenas TRAZIDO)`
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 6. VERIFICAR CONQUISTAS DE MENSAGENS
    // ═══════════════════════════════════════════════════════════════
    const messageAchievements = [
      { type: 'first-message', title: 'Primeira Mensagem', req: 1 },
      { type: 'chatterbox', title: 'Tagarela', req: 50 },
      { type: 'social-butterfly', title: 'Sociável', req: 200 },
      { type: 'communicator', title: 'Comunicador', req: 500 },
      { type: 'influencer', title: 'Influenciador', req: 1000 },
    ];
    
    for (const ach of messageAchievements) {
      const has = achievements.some(a => a.type === ach.type);
      const should = messages >= ach.req;
      
      if (has && !should) {
        problems.push({
          userId: user.id,
          username: user.username,
          achievementType: ach.type,
          achievementTitle: ach.title,
          problem: 'INDEVIDA',
          reason: `Tem ${messages} mensagens, requisito é ${ach.req}`
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 7. VERIFICAR CONQUISTAS DE AVALIAÇÕES DADAS
    // ═══════════════════════════════════════════════════════════════
    const ratingAchievements = [
      { type: 'first-rate', title: 'Primeira Avaliação', req: 1 },
      { type: 'taste-expert', title: 'Especialista', req: 20 },
      { type: 'sommelier', title: 'Sommelier de Café', req: 50 },
      { type: 'critic-master', title: 'Mestre Crítico', req: 100 },
    ];
    
    for (const ach of ratingAchievements) {
      const has = achievements.some(a => a.type === ach.type);
      const should = ratingsGiven >= ach.req;
      
      if (has && !should) {
        problems.push({
          userId: user.id,
          username: user.username,
          achievementType: ach.type,
          achievementTitle: ach.title,
          problem: 'INDEVIDA',
          reason: `Tem ${ratingsGiven} avaliações dadas, requisito é ${ach.req}`
        });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 8. VERIFICAR CONQUISTAS DE 5 ESTRELAS RECEBIDAS
    // ═══════════════════════════════════════════════════════════════
    const fiveStarAchievements = [
      { type: 'five-stars', title: '5 Estrelas', req: 1 },
      { type: 'five-stars-master', title: 'Colecionador de Estrelas', req: 10 },
      { type: 'five-stars-legend', title: 'Constelação', req: 25 },
      { type: 'galaxy-of-stars', title: 'Galáxia de Estrelas', req: 50 },
    ];
    
    for (const ach of fiveStarAchievements) {
      const has = achievements.some(a => a.type === ach.type);
      const should = fiveStarsReceived >= ach.req;
      
      if (has && !should) {
        problems.push({
          userId: user.id,
          username: user.username,
          achievementType: ach.type,
          achievementTitle: ach.title,
          problem: 'INDEVIDA',
          reason: `Tem ${fiveStarsReceived} avaliações 5 estrelas, requisito é ${ach.req}`
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // RELATÓRIO FINAL
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(70));
  console.log('📋 RELATÓRIO FINAL - PROBLEMAS ENCONTRADOS');
  console.log('═'.repeat(70));
  
  if (problems.length === 0) {
    console.log('\n✅ Nenhum problema encontrado!');
  } else {
    console.log(`\n❌ ${problems.length} problema(s) encontrado(s):\n`);
    
    // Agrupar por usuário
    const byUser = problems.reduce((acc, p) => {
      if (!acc[p.username]) acc[p.username] = [];
      acc[p.username].push(p);
      return acc;
    }, {} as Record<string, AchievementProblem[]>);
    
    for (const [username, userProblems] of Object.entries(byUser)) {
      console.log(`\n👤 ${username}:`);
      for (const p of userProblems) {
        const icon = p.problem === 'INDEVIDA' ? '❌' : '⚠️';
        console.log(`   ${icon} [${p.achievementType}] ${p.achievementTitle}`);
        console.log(`      ${p.reason}`);
      }
    }
  }
  
  // Gerar lista de IDs para remoção
  const toRemove = problems.filter(p => p.problem === 'INDEVIDA');
  if (toRemove.length > 0) {
    console.log('\n' + '═'.repeat(70));
    console.log('🗑️  CONQUISTAS A SEREM REMOVIDAS:');
    console.log('═'.repeat(70));
    
    for (const p of toRemove) {
      console.log(`DELETE FROM achievements WHERE "userId" = '${p.userId}' AND "type" = '${p.achievementType}';`);
    }
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
