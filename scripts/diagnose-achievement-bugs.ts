/**
 * Diagnóstico de bugs de conquistas
 * Execução: npx ts-node scripts/diagnose-achievement-bugs.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma 7 requer adapter
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function diagnose() {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔍 DIAGNÓSTICO DE BUGS DE CONQUISTAS');
    console.log('═══════════════════════════════════════════════════════════\n');

    // 1. Buscar conquistas recentes do Chris
    const chris = await prisma.user.findFirst({ where: { username: 'chris' }});
    if (!chris) {
      console.log('❌ Chris não encontrado');
      return;
    }
    
    console.log('=== CHRIS ACHIEVEMENTS (últimas 10) ===');
    const achievements = await prisma.achievement.findMany({
      where: { userId: chris.id },
      orderBy: { unlockedAt: 'desc' },
      take: 10
    });
    
    console.log('Conquistas recentes:');
    achievements.forEach(a => {
      console.log(`  - ${a.type}: ${a.title} - Desbloqueada em: ${a.unlockedAt.toLocaleString('pt-BR')}`);
    });
    
    // 2. Verificar cafés do Chris (para weekend-warrior e monday-hero)
    console.log('\n=== CAFÉS DO CHRIS (FEITOS) ===');
    const coffees = await prisma.coffee.findMany({
      where: { makerId: chris.id },
      orderBy: { timestamp: 'desc' },
      take: 20
    });
    
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    
    console.log('Cafés feitos recentemente:');
    let hasWeekendCoffee = false;
    let hasMondayMorningCoffee = false;
    
    coffees.forEach(c => {
      const date = new Date(c.timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      
      if (dayOfWeek === 0 || dayOfWeek === 6) hasWeekendCoffee = true;
      if (dayOfWeek === 1 && hour < 10) hasMondayMorningCoffee = true;
      
      console.log(`  - ${date.toLocaleString('pt-BR')} (${dayNames[dayOfWeek]}, ${hour}h)`);
    });
    
    console.log(`\n📊 Análise de elegibilidade:`);
    console.log(`  - Café no fim de semana: ${hasWeekendCoffee ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`  - Café segunda de manhã: ${hasMondayMorningCoffee ? '✅ SIM' : '❌ NÃO'}`);
    
    // 3. Verificar avaliações 5 estrelas recebidas (para double-rainbow)
    console.log('\n=== AVALIAÇÕES 5 ESTRELAS DO CHRIS ===');
    const ratings = await prisma.rating.findMany({
      where: {
        rating: 5,
        coffee: { makerId: chris.id }
      },
      include: { coffee: true },
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    
    // Agrupar por café
    const coffeeRatings: Record<string, any[]> = {};
    ratings.forEach(r => {
      if (!coffeeRatings[r.coffeeId]) coffeeRatings[r.coffeeId] = [];
      coffeeRatings[r.coffeeId].push(r);
    });
    
    console.log('5 estrelas agrupadas por café:');
    let hasDoubleRainbow = false;
    
    for (const [coffeeId, rts] of Object.entries(coffeeRatings)) {
      if (rts.length >= 2) {
        hasDoubleRainbow = true;
        console.log(`  ⭐⭐ Café ${coffeeId.slice(0,8)}... : ${rts.length} avaliações 5 estrelas (DOUBLE-RAINBOW ELEGÍVEL!)`);
      } else {
        console.log(`  ⭐ Café ${coffeeId.slice(0,8)}... : ${rts.length} avaliação 5 estrelas`);
      }
      rts.forEach(r => console.log(`    - ${r.createdAt.toLocaleString('pt-BR')}`));
    }
    
    console.log(`\n📊 Double-rainbow elegível: ${hasDoubleRainbow ? '✅ SIM (2+ avaliações 5 estrelas no mesmo café)' : '❌ NÃO'}`);
    
    // 4. Verificar usuários sem chatterbox que deveriam ter
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('=== VERIFICANDO CHATTERBOX (50 msgs) ===');
    const users = await prisma.user.findMany();
    
    let bugCount = 0;
    for (const user of users) {
      const msgCount = await prisma.message.count({
        where: { authorId: user.id, deletedAt: null }
      });
      
      const hasChatterbox = await prisma.achievement.findUnique({
        where: { userId_type: { userId: user.id, type: 'chatterbox' } }
      });
      
      if (msgCount >= 50 && !hasChatterbox) {
        console.log(`  ⚠️ BUG: ${user.username} tem ${msgCount} msgs mas NÃO tem chatterbox!`);
        bugCount++;
      } else if (msgCount >= 50 && hasChatterbox) {
        console.log(`  ✅ ${user.username}: ${msgCount} msgs - TEM chatterbox`);
      } else if (msgCount >= 40) {
        console.log(`  🔸 ${user.username}: ${msgCount} msgs (precisa de 50)`);
      }
    }
    
    if (bugCount === 0) {
      console.log('  ✅ Nenhum bug encontrado em chatterbox');
    }
    
    // 5. Verificar conquistas first-message
    console.log('\n=== VERIFICANDO FIRST-MESSAGE (1 msg) ===');
    let firstMsgBugCount = 0;
    for (const user of users) {
      const msgCount = await prisma.message.count({
        where: { authorId: user.id, deletedAt: null }
      });
      
      const hasFirstMessage = await prisma.achievement.findUnique({
        where: { userId_type: { userId: user.id, type: 'first-message' } }
      });
      
      if (msgCount >= 1 && !hasFirstMessage) {
        console.log(`  ⚠️ BUG: ${user.username} tem ${msgCount} msgs mas NÃO tem first-message!`);
        firstMsgBugCount++;
      }
    }
    
    if (firstMsgBugCount === 0) {
      console.log('  ✅ Nenhum bug encontrado em first-message');
    }
    
    // 6. Buscar conquistas concedidas HOJE
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('=== CONQUISTAS DESBLOQUEADAS HOJE ===');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayAchievements = await prisma.achievement.findMany({
      where: {
        unlockedAt: { gte: today }
      },
      include: {
        user: { select: { username: true } }
      },
      orderBy: { unlockedAt: 'desc' }
    });
    
    if (todayAchievements.length === 0) {
      console.log('  Nenhuma conquista desbloqueada hoje');
    } else {
      todayAchievements.forEach(a => {
        console.log(`  - ${a.user.username}: ${a.type} (${a.title}) - ${a.unlockedAt.toLocaleString('pt-BR')}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Diagnóstico concluído');
    console.log('═══════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('Erro no diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
