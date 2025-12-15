/**
 * Script para auditar os pontos do Renan usando as definições REAIS do sistema
 * Lê configurações do banco e do código achievement.service.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:wilmarsoller21052025@localhost:5432/cerebro?schema=public';

// ════════════════════════════════════════════════════════════════════════════
// DEFINIÇÕES OFICIAIS DO achievement.service.ts (extraídas do código)
// ════════════════════════════════════════════════════════════════════════════

// Map de conquistas para raridade (copiado do ACHIEVEMENT_RARITY_MAP no código)
const ACHIEVEMENT_RARITY: Record<string, string> = {
  // Coffee
  'first-coffee': 'common',
  'coffee-apprentice': 'common',
  'coffee-enthusiast': 'rare',
  'coffee-master': 'epic',
  'coffee-legend': 'legendary',
  'coffee-god': 'platinum',
  // Supply
  'first-supply': 'common',
  'supplier': 'common',       // 5 vezes
  'generous': 'rare',         // 15 vezes
  'benefactor': 'epic',       // 30 vezes
  'philanthropist': 'legendary', // 50 vezes
  // Rating received
  'five-stars': 'common',     // 1ª 5 estrelas
  'five-stars-master': 'epic', // 10x 5 estrelas
  'five-stars-legend': 'legendary', // 25x 5 estrelas
  'top-rated': 'epic',        // Média >= 4.5 com 2+ avaliações de 5 estrelas
  'perfect-score': 'legendary',
  // Rating given
  'first-rate': 'common',     // 1ª avaliação
  'taste-expert': 'rare',     // 20 avaliações
  'sommelier': 'epic',        // 50 avaliações
  // Messages
  'first-message': 'common',  // 1 msg
  'chatterbox': 'common',     // 50 msgs
  'social-butterfly': 'rare', // 200 msgs
  'communicator': 'epic',     // 500 msgs
  'influencer': 'legendary',  // 1000 msgs
  // Special
  'early-bird': 'rare',
  'night-owl': 'rare',
  'weekend-warrior': 'rare',
  'monday-hero': 'rare',
  // Streak
  'streak-3': 'common',
  'streak-7': 'rare',
  'streak-14': 'epic',
  'streak-30': 'legendary',
  // Veteran
  'veteran': 'rare',          // 30 dias
  'ancient': 'epic',          // 90 dias
  'founding-member': 'legendary', // 180 dias
};

async function auditRenanV2() {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    🔍 AUDITORIA COMPLETA DO RENAN (V2 - VALORES REAIS)                        ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar config de XP do banco
    const xpConfigSetting = await prisma.setting.findUnique({
      where: { key: 'xp-config' }
    });
    const xpConfig = xpConfigSetting?.value as Record<string, { xp: number }> || {};

    console.log('📊 CONFIGURAÇÃO DE XP DO BANCO:');
    console.log('═'.repeat(80));
    console.log(`   ☕ coffee-made: ${xpConfig['coffee-made']?.xp || 'N/A'} XP`);
    console.log(`   🛒 coffee-brought: ${xpConfig['coffee-brought']?.xp || 'N/A'} XP`);
    console.log(`   ⭐ rating-given: ${xpConfig['rating-given']?.xp || 'N/A'} XP`);
    console.log(`   💬 message-sent: ${xpConfig['message-sent']?.xp || 'N/A'} XP`);
    console.log(`   🌟 five-star-received: ${xpConfig['five-star-received']?.xp || 'N/A'} XP`);
    console.log(`   🎖️ achievement-common: ${xpConfig['achievement-common']?.xp || 'N/A'} XP`);
    console.log(`   💠 achievement-rare: ${xpConfig['achievement-rare']?.xp || 'N/A'} XP`);
    console.log(`   💎 achievement-epic: ${xpConfig['achievement-epic']?.xp || 'N/A'} XP`);
    console.log(`   👑 achievement-legendary: ${xpConfig['achievement-legendary']?.xp || 'N/A'} XP`);
    console.log(`   🏆 achievement-platinum: ${xpConfig['achievement-platinum']?.xp || 'N/A'} XP`);
    console.log();

    // Buscar Renan
    const renan = await prisma.user.findFirst({
      where: { username: { contains: 'Renan', mode: 'insensitive' } },
      include: {
        achievements: true,
        levelData: true
      }
    });

    if (!renan) {
      console.log('❌ Renan não encontrado!');
      return;
    }

    console.log('📋 DADOS DO RENAN:');
    console.log('═'.repeat(80));
    console.log(`   ID: ${renan.id}`);
    console.log(`   XP Total: ${renan.levelData?.totalXP || 0}`);
    console.log(`   Nível: ${renan.levelData?.level || 1}`);
    console.log();

    // Estatísticas do Renan
    const coffeesMade = await prisma.coffee.findMany({
      where: { makerId: renan.id, type: 'MADE' },
      include: { ratings: true }
    });

    const coffeesBrought = await prisma.coffee.findMany({
      where: { makerId: renan.id, type: 'BROUGHT' }
    });

    const ratingsGiven = await prisma.rating.count({
      where: { userId: renan.id }
    });

    const messages = await prisma.message.count({
      where: { authorId: renan.id }
    });

    // Calcular 5 estrelas recebidas
    let total5StarReceived = 0;
    for (const coffee of coffeesMade) {
      total5StarReceived += coffee.ratings.filter(r => r.rating === 5).length;
    }
    // Também contar nos BROUGHT
    const broughtWithRatings = await prisma.coffee.findMany({
      where: { makerId: renan.id, type: 'BROUGHT' },
      include: { ratings: true }
    });
    for (const coffee of broughtWithRatings) {
      total5StarReceived += coffee.ratings.filter(r => r.rating === 5).length;
    }

    console.log('📈 ESTATÍSTICAS DO RENAN:');
    console.log('═'.repeat(80));
    console.log(`   ☕ Cafés FEITOS (MADE): ${coffeesMade.length}`);
    console.log(`   🛒 Cafés TRAZIDOS (BROUGHT): ${coffeesBrought.length}`);
    console.log(`   ⭐ Avaliações DADAS: ${ratingsGiven}`);
    console.log(`   🌟 5 estrelas RECEBIDAS: ${total5StarReceived}`);
    console.log(`   💬 Mensagens enviadas: ${messages}`);
    console.log();

    // Conquistas atuais do Renan
    console.log('🏆 CONQUISTAS ATUAIS DO RENAN:');
    console.log('═'.repeat(80));
    for (const a of renan.achievements) {
      const rarity = ACHIEVEMENT_RARITY[a.type] || 'unknown';
      const xpKey = `achievement-${rarity}`;
      const xp = xpConfig[xpKey]?.xp || 0;
      console.log(`   ✅ ${a.type} - ${a.title} (${rarity}) = ${xp} XP`);
    }
    console.log();

    // Verificar conquistas que DEVERIA ter
    console.log('🔍 ANÁLISE DE CONQUISTAS:');
    console.log('═'.repeat(80));

    const achievementTypes = renan.achievements.map(a => a.type);
    const shouldHave: string[] = [];
    const shouldNotHave: string[] = [];

    // Verificar Coffee achievements
    const totalCoffees = coffeesMade.length + coffeesBrought.length;
    if (totalCoffees >= 1 && !achievementTypes.includes('first-coffee')) {
      shouldHave.push(`first-coffee (Primeiro Café) - tem ${totalCoffees} cafés`);
    }
    if (totalCoffees >= 5 && !achievementTypes.includes('coffee-apprentice')) {
      shouldHave.push(`coffee-apprentice (Aprendiz) - tem ${totalCoffees} cafés`);
    }

    // Verificar Supply achievements
    if (coffeesBrought.length >= 1 && !achievementTypes.includes('first-supply')) {
      shouldHave.push(`first-supply (Primeiro Suprimento) - tem ${coffeesBrought.length} trazidos`);
    } else if (coffeesBrought.length === 0 && achievementTypes.includes('first-supply')) {
      shouldNotHave.push(`first-supply - tem 0 cafés BROUGHT mas tem a conquista!`);
    }

    // Verificar Rating achievements
    if (total5StarReceived >= 1 && !achievementTypes.includes('five-stars')) {
      shouldHave.push(`five-stars (5 Estrelas) - tem ${total5StarReceived}x 5⭐`);
    }
    if (total5StarReceived >= 2 && !achievementTypes.includes('top-rated')) {
      shouldHave.push(`top-rated (Mais Bem Avaliado) - tem ${total5StarReceived}x 5⭐`);
    }

    // Verificar Rating given achievements  
    if (ratingsGiven >= 1 && !achievementTypes.includes('first-rate')) {
      shouldHave.push(`first-rate (Primeira Avaliação) - deu ${ratingsGiven} avaliações`);
    }
    if (ratingsGiven >= 20 && !achievementTypes.includes('taste-expert')) {
      shouldHave.push(`taste-expert (Expert) - deu ${ratingsGiven} avaliações`);
    }

    // Verificar Message achievements (IMPORTANTE: valores corretos!)
    if (messages >= 1 && !achievementTypes.includes('first-message')) {
      shouldHave.push(`first-message (Primeira Mensagem) - tem ${messages} msgs`);
    }
    if (messages >= 50 && !achievementTypes.includes('chatterbox')) {
      shouldHave.push(`chatterbox (Tagarela) - tem ${messages} msgs (precisa 50)`);
    } else if (messages < 50 && achievementTypes.includes('chatterbox')) {
      shouldNotHave.push(`chatterbox - tem ${messages} msgs mas precisa de 50!`);
    }
    if (messages >= 200 && !achievementTypes.includes('social-butterfly')) {
      shouldHave.push(`social-butterfly (Borboleta Social) - tem ${messages} msgs (precisa 200)`);
    }

    // Verificar conquistas que NÃO deveria ter
    if (total5StarReceived < 10 && achievementTypes.includes('five-stars-master')) {
      shouldNotHave.push(`five-stars-master - tem ${total5StarReceived}x 5⭐ mas precisa de 10!`);
    }

    if (shouldHave.length > 0) {
      console.log('\n   ❌ DEVERIA TER MAS NÃO TEM:');
      for (const a of shouldHave) {
        console.log(`      → ${a}`);
      }
    }

    if (shouldNotHave.length > 0) {
      console.log('\n   ⚠️  TEM MAS NÃO DEVERIA TER:');
      for (const a of shouldNotHave) {
        console.log(`      → ${a}`);
      }
    }

    if (shouldHave.length === 0 && shouldNotHave.length === 0) {
      console.log('   ✅ Todas as conquistas estão corretas!');
    }

    // Cálculo esperado de XP
    console.log('\n\n🧮 CÁLCULO ESPERADO DE XP:');
    console.log('═'.repeat(80));

    const coffeeXp = xpConfig['coffee-made']?.xp || 25;
    const supplyXp = xpConfig['coffee-brought']?.xp || 150;
    const ratingGivenXp = xpConfig['rating-given']?.xp || 3;
    const messageXp = xpConfig['message-sent']?.xp || 1;
    const fiveStarXp = xpConfig['five-star-received']?.xp || 30;

    const xpFromCoffees = coffeesMade.length * coffeeXp;
    const xpFromSupply = coffeesBrought.length * supplyXp;
    const xpFromRatings = ratingsGiven * ratingGivenXp;
    const xpFromMessages = messages * messageXp;
    const xpFromFiveStars = total5StarReceived * fiveStarXp;

    // XP de conquistas
    let xpFromAchievements = 0;
    for (const a of renan.achievements) {
      const rarity = ACHIEVEMENT_RARITY[a.type] || 'common';
      const xpKey = `achievement-${rarity}`;
      const xp = xpConfig[xpKey]?.xp || 50;
      xpFromAchievements += xp;
    }

    console.log(`   ☕ ${coffeesMade.length} cafés feitos × ${coffeeXp} XP = ${xpFromCoffees} XP`);
    console.log(`   🛒 ${coffeesBrought.length} cafés trazidos × ${supplyXp} XP = ${xpFromSupply} XP`);
    console.log(`   ⭐ ${ratingsGiven} avaliações × ${ratingGivenXp} XP = ${xpFromRatings} XP`);
    console.log(`   💬 ${messages} mensagens × ${messageXp} XP = ${xpFromMessages} XP`);
    console.log(`   🌟 ${total5StarReceived}x 5 estrelas × ${fiveStarXp} XP = ${xpFromFiveStars} XP`);
    console.log(`   🏆 ${renan.achievements.length} conquistas = ${xpFromAchievements} XP`);

    const totalExpected = xpFromCoffees + xpFromSupply + xpFromRatings + xpFromMessages + xpFromFiveStars + xpFromAchievements;
    
    console.log('   ─'.repeat(40));
    console.log(`   📊 TOTAL ESPERADO: ${totalExpected} XP`);
    console.log(`   📊 TOTAL ATUAL:    ${renan.levelData?.totalXP || 0} XP`);
    
    const diff = totalExpected - (renan.levelData?.totalXP || 0);
    if (Math.abs(diff) > 0) {
      console.log(`   ⚠️  DIFERENÇA: ${diff > 0 ? '+' : ''}${diff} XP`);
    } else {
      console.log(`   ✅ XP ESTÁ CORRETO!`);
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

auditRenanV2().catch(console.error);
