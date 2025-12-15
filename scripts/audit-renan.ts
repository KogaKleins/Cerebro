/**
 * Script para auditar os pontos do Renan em detalhes
 * Verifica se todos os pontos dele foram alocados corretamente
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:wilmarsoller21052025@localhost:5432/cerebro?schema=public';

// Map de raridade para XP
const RARITY_XP: Record<string, number> = {
  'common': 50,
  'rare': 500,
  'epic': 1500,
  'legendary': 3000,
  'platinum': 5000
};

// Map de achievements para raridade
const ACHIEVEMENT_RARITY: Record<string, string> = {
  // Coffee
  'first-coffee': 'common',
  'coffee-apprentice': 'common',
  'coffee-enthusiast': 'rare',
  'coffee-master': 'epic',
  'coffee-legend': 'legendary',
  'coffee-god': 'platinum',
  // Supply (trazendo café)
  'first-supply': 'common',
  'supplier': 'common',
  'supply-hero': 'rare',
  'supply-master': 'epic',
  'supply-legend': 'legendary',
  // Rating received
  'quality-seal': 'common',
  'top-rated': 'rare',
  'five-stars': 'epic',
  'perfect-score': 'legendary',
  // Rating given
  'first-rating': 'common',
  'critic': 'common',
  'connoisseur': 'rare',
  'master-critic': 'epic',
  // Message
  'first-message': 'common',
  'chatty': 'common',
  'social-butterfly': 'rare',
  'chat-master': 'epic',
  // Special
  'early-bird': 'rare',
  'night-owl': 'rare',
  'weekend-warrior': 'epic',
  // Streak
  'streak-3': 'common',
  'streak-7': 'rare',
  'streak-30': 'epic',
  // Veteran
  'veteran-1m': 'common',
  'veteran-6m': 'rare',
  'veteran-1y': 'epic',
  // Milestone
  'xp-1000': 'common',
  'xp-5000': 'rare',
  'xp-10000': 'epic',
  'xp-50000': 'legendary'
};

async function auditRenan() {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              🔍 AUDITORIA COMPLETA DO RENAN                                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar Renan com relacionamentos
    const renan = await prisma.user.findFirst({
      where: { username: { contains: 'Renan', mode: 'insensitive' } },
      include: {
        achievements: true,
        levelData: true
      }
    });

    if (!renan) {
      console.log('❌ Renan não encontrado no sistema!');
      return;
    }

    // Buscar definição do nível
    const levelSetting = await prisma.setting.findUnique({
      where: { key: 'levels-config' }
    });
    const levels = levelSetting?.value as any[] || [];
    const currentLevel = levels.find((l: any) => l.level === (renan.levelData?.level || 1));

    console.log('📋 DADOS DO USUÁRIO:');
    console.log('═'.repeat(80));
    console.log(`   ID: ${renan.id}`);
    console.log(`   Nome: ${renan.username}`);
    console.log(`   XP Total: ${renan.levelData?.totalXP || 0}`);
    console.log(`   Nível: ${currentLevel?.name || 'Estagiário do Café'} (Lv ${renan.levelData?.level || 1})`);
    console.log(`   Conquistas: ${renan.achievements.length}`);
    console.log();

    // 1. Cafés FEITOS pelo Renan
    const coffeesMade = await prisma.coffee.findMany({
      where: { makerId: renan.id },
      include: {
        ratings: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('☕ CAFÉS FEITOS PELO RENAN:');
    console.log('═'.repeat(80));
    console.log(`   Total: ${coffeesMade.length} cafés`);
    
    let totalRatingsReceived = 0;
    let total5StarReceived = 0;
    let totalStarsReceived = 0;
    
    for (const coffee of coffeesMade) {
      const ratings = coffee.ratings || [];
      const avgRating = ratings.length > 0 
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2) 
        : 'N/A';
      const fiveStars = ratings.filter(r => r.rating === 5).length;
      
      totalRatingsReceived += ratings.length;
      total5StarReceived += fiveStars;
      totalStarsReceived += ratings.reduce((sum, r) => sum + r.rating, 0);
      
      console.log(`   📅 ${coffee.createdAt.toLocaleDateString('pt-BR')} - ${coffee.type || 'coffee'} - ${ratings.length} avaliações - Média: ${avgRating} - 5⭐: ${fiveStars}`);
    }
    console.log(`   📊 Total avaliações recebidas: ${totalRatingsReceived}`);
    console.log(`   ⭐ Total 5 estrelas recebidas: ${total5StarReceived}`);
    console.log(`   📈 Média geral: ${totalRatingsReceived > 0 ? (totalStarsReceived / totalRatingsReceived).toFixed(2) : 'N/A'}`);
    console.log();

    // 2. Cafés do tipo BROUGHT (trazidos)
    const coffeesBrought = await prisma.coffee.findMany({
      where: { 
        type: 'BROUGHT',
        createdBy: renan.username
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('🛒 CAFÉS TRAZIDOS PELO RENAN (BROUGHT):');
    console.log('═'.repeat(80));
    console.log(`   Total: ${coffeesBrought.length} cafés`);
    for (const coffee of coffeesBrought) {
      console.log(`   📅 ${coffee.createdAt.toLocaleDateString('pt-BR')} - ${coffee.type}`);
    }
    console.log();

    // 3. Avaliações DADAS pelo Renan
    const ratingsGiven = await prisma.rating.findMany({
      where: { userId: renan.id },
      include: {
        coffee: {
          include: {
            maker: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('⭐ AVALIAÇÕES DADAS PELO RENAN:');
    console.log('═'.repeat(80));
    console.log(`   Total: ${ratingsGiven.length} avaliações`);
    
    for (const rating of ratingsGiven) {
      const makerName = rating.coffee?.maker?.username || 'Desconhecido';
      console.log(`   📅 ${rating.createdAt.toLocaleDateString('pt-BR')} - ${rating.rating}⭐ para ${makerName}`);
    }
    console.log();

    // 4. Mensagens do Renan
    const messages = await prisma.message.findMany({
      where: { authorId: renan.id },
      orderBy: { timestamp: 'asc' }
    });

    console.log('💬 MENSAGENS DO RENAN:');
    console.log('═'.repeat(80));
    console.log(`   Total: ${messages.length} mensagens`);
    
    // Agrupar por data
    const messagesByDate: Record<string, number> = {};
    for (const msg of messages) {
      const date = msg.timestamp.toLocaleDateString('pt-BR');
      messagesByDate[date] = (messagesByDate[date] || 0) + 1;
    }
    
    for (const [date, count] of Object.entries(messagesByDate)) {
      console.log(`   📅 ${date}: ${count} mensagens`);
    }
    console.log();

    // 5. Conquistas do Renan
    console.log('🏆 CONQUISTAS DO RENAN:');
    console.log('═'.repeat(80));
    
    if (renan.achievements.length === 0) {
      console.log('   ❌ Nenhuma conquista registrada!');
    } else {
      for (const achievement of renan.achievements) {
        const rarity = ACHIEVEMENT_RARITY[achievement.type] || 'common';
        const xp = RARITY_XP[rarity] || 50;
        console.log(`   🎖️ ${achievement.type} - ${achievement.title} (${rarity}) = ${xp} XP`);
      }
    }
    console.log();

    // 6. CÁLCULO ESPERADO DE XP
    console.log('🧮 CÁLCULO ESPERADO DE XP:');
    console.log('═'.repeat(80));

    // Buscar config de XP
    const xpConfigSetting = await prisma.setting.findUnique({
      where: { key: 'xp-config' }
    });
    const xpConfig = xpConfigSetting?.value as Record<string, { xp: number }> || {};

    const coffeeXp = xpConfig['coffee-made']?.xp || 100;
    const supplyXp = xpConfig['coffee-brought']?.xp || 150;
    const ratingGivenXp = xpConfig['rating-given']?.xp || 3;
    const messageXp = xpConfig['message-sent']?.xp || 2;

    const xpFromCoffeesMade = coffeesMade.length * coffeeXp;
    const xpFromCoffeesBrought = coffeesBrought.length * supplyXp;
    const xpFromRatingsGiven = ratingsGiven.length * ratingGivenXp;
    const xpFromMessages = messages.length * messageXp;

    console.log(`   ☕ ${coffeesMade.length} cafés feitos × ${coffeeXp} XP = ${xpFromCoffeesMade} XP`);
    console.log(`   🛒 ${coffeesBrought.length} cafés trazidos × ${supplyXp} XP = ${xpFromCoffeesBrought} XP`);
    console.log(`   ⭐ ${ratingsGiven.length} avaliações dadas × ${ratingGivenXp} XP = ${xpFromRatingsGiven} XP`);
    console.log(`   💬 ${messages.length} mensagens × ${messageXp} XP = ${xpFromMessages} XP`);

    // XP de conquistas
    let xpFromAchievements = 0;
    for (const achievement of renan.achievements) {
      const rarity = ACHIEVEMENT_RARITY[achievement.type] || 'common';
      const xp = RARITY_XP[rarity] || 50;
      xpFromAchievements += xp;
    }
    console.log(`   🏆 ${renan.achievements.length} conquistas = ${xpFromAchievements} XP`);

    const totalExpected = xpFromCoffeesMade + xpFromCoffeesBrought + xpFromRatingsGiven + xpFromMessages + xpFromAchievements;
    
    console.log('   ─'.repeat(40));
    console.log(`   📊 TOTAL ESPERADO: ${totalExpected} XP`);
    console.log(`   📊 TOTAL ATUAL:    ${renan.levelData?.totalXP || 0} XP`);
    
    const diff = totalExpected - (renan.levelData?.totalXP || 0);
    if (diff !== 0) {
      console.log(`   ⚠️  DIFERENÇA: ${diff > 0 ? '+' : ''}${diff} XP`);
    } else {
      console.log(`   ✅ XP ESTÁ CORRETO!`);
    }
    console.log();

    // 7. Verificar conquistas que deveria ter
    console.log('🔍 CONQUISTAS QUE RENAN DEVERIA TER:');
    console.log('═'.repeat(80));

    const achievementIds = renan.achievements.map(a => a.type);
    const shouldHave: string[] = [];

    // Coffee achievements
    if (coffeesMade.length >= 1 && !achievementIds.includes('first-coffee')) {
      shouldHave.push('first-coffee (Primeiro Café - fez 1 café)');
    }
    if (coffeesMade.length >= 5 && !achievementIds.includes('coffee-apprentice')) {
      shouldHave.push('coffee-apprentice (Aprendiz - fez 5 cafés)');
    }
    if (coffeesMade.length >= 10 && !achievementIds.includes('coffee-enthusiast')) {
      shouldHave.push('coffee-enthusiast (Entusiasta - fez 10 cafés)');
    }
    if (coffeesMade.length >= 25 && !achievementIds.includes('coffee-master')) {
      shouldHave.push('coffee-master (Mestre - fez 25 cafés)');
    }

    // Supply achievements
    if (coffeesBrought.length >= 1 && !achievementIds.includes('first-supply')) {
      shouldHave.push('first-supply (Primeira Compra - trouxe 1 café)');
    }
    if (coffeesBrought.length >= 3 && !achievementIds.includes('supplier')) {
      shouldHave.push('supplier (Fornecedor - trouxe 3 cafés)');
    }
    if (coffeesBrought.length >= 5 && !achievementIds.includes('supply-hero')) {
      shouldHave.push('supply-hero (Herói - trouxe 5 cafés)');
    }

    // Rating achievements (received)
    if (total5StarReceived >= 1 && !achievementIds.includes('quality-seal')) {
      shouldHave.push('quality-seal (Selo de Qualidade - 1x 5 estrelas)');
    }
    if (total5StarReceived >= 2 && !achievementIds.includes('top-rated')) {
      shouldHave.push('top-rated (Top Rated - 2x 5 estrelas)');
    }
    if (total5StarReceived >= 5 && !achievementIds.includes('five-stars')) {
      shouldHave.push('five-stars (Cinco Estrelas - 5x 5 estrelas)');
    }

    // Rating given achievements
    if (ratingsGiven.length >= 1 && !achievementIds.includes('first-rating')) {
      shouldHave.push('first-rating (Primeira Avaliação - avaliou 1 café)');
    }
    if (ratingsGiven.length >= 5 && !achievementIds.includes('critic')) {
      shouldHave.push('critic (Crítico - avaliou 5 cafés)');
    }
    if (ratingsGiven.length >= 10 && !achievementIds.includes('connoisseur')) {
      shouldHave.push('connoisseur (Conhecedor - avaliou 10 cafés)');
    }

    // Message achievements
    if (messages.length >= 1 && !achievementIds.includes('first-message')) {
      shouldHave.push('first-message (Primeira Mensagem - enviou 1)');
    }
    if (messages.length >= 10 && !achievementIds.includes('chatty')) {
      shouldHave.push('chatty (Tagarela - enviou 10 mensagens)');
    }
    if (messages.length >= 50 && !achievementIds.includes('social-butterfly')) {
      shouldHave.push('social-butterfly (Borboleta Social - enviou 50 mensagens)');
    }

    if (shouldHave.length > 0) {
      console.log('   ❌ FALTANDO:');
      for (const a of shouldHave) {
        console.log(`      → ${a}`);
      }
    } else {
      console.log('   ✅ Renan tem todas as conquistas que deveria ter!');
    }
    console.log();

    // 8. Comparar com outros usuários
    console.log('📊 COMPARAÇÃO COM OUTROS USUÁRIOS:');
    console.log('═'.repeat(80));

    const allUsers = await prisma.user.findMany({
      include: { levelData: true }
    });

    // Ordenar por XP
    allUsers.sort((a, b) => (b.levelData?.totalXP || 0) - (a.levelData?.totalXP || 0));

    for (const user of allUsers) {
      const coffees = await prisma.coffee.count({ where: { makerId: user.id } });
      const msgs = await prisma.message.count({ where: { authorId: user.id } });
      const ratingCount = await prisma.rating.count({ where: { userId: user.id } });
      
      // Supplies via prisma
      const supplies = await prisma.coffee.count({ 
        where: { 
          type: 'BROUGHT',
          createdBy: user.username
        }
      });
      
      const marker = user.id === renan.id ? ' 👈 RENAN' : '';
      console.log(`   ${user.username}: ${user.levelData?.totalXP || 0} XP (Lv${user.levelData?.level || 1}) - ☕${coffees} 🛒${supplies} ⭐${ratingCount} 💬${msgs}${marker}`);
    }

    // 9. Log de auditoria XP
    console.log('\n📜 HISTÓRICO DE XP DO RENAN (últimos 20):');
    console.log('═'.repeat(80));
    
    const auditLogs = await prisma.xPAuditLog.findMany({
      where: { userId: renan.id },
      orderBy: { timestamp: 'desc' },
      take: 20
    });

    if (auditLogs.length === 0) {
      console.log('   ⚠️ Nenhum log de auditoria encontrado!');
    } else {
      for (const log of auditLogs) {
        const date = log.timestamp.toLocaleDateString('pt-BR');
        const time = log.timestamp.toLocaleTimeString('pt-BR');
        console.log(`   📅 ${date} ${time} | ${log.source} | +${log.amount} XP | ${log.reason}`);
      }
    }

  } catch (error) {
    console.error('❌ Erro na auditoria:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

auditRenan().catch(console.error);
