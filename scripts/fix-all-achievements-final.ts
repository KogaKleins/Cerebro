/**
 * 🔍 AUDITORIA FINAL E CORREÇÃO DE CONQUISTAS
 * 
 * Script robusto para:
 * 1. Encontrar TODAS as conquistas que deveriam estar desbloqueadas
 * 2. Corrigir automaticamente
 * 
 * ⚠️ EXCEÇÕES (conquistas manuais - NÃO são bugs):
 * - early-bird (Chris) - adicionada manualmente por erro no servidor
 * - monday-hero (Renan) - adicionada manualmente por erro no servidor
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ═══════════════════════════════════════════════════════════════
// ⚠️ EXCEÇÕES - Conquistas manuais que NÃO devem ser removidas
// ═══════════════════════════════════════════════════════════════
const MANUAL_EXCEPTIONS: Record<string, string[]> = {
  'chris': ['early-bird'],      // Adicionada manualmente - erro no servidor
  'renan': ['monday-hero'],     // Adicionada manualmente - erro no servidor
};

// ═══════════════════════════════════════════════════════════════
// 📋 DEFINIÇÕES OFICIAIS DE CONQUISTAS (baseado em definitions.js)
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENTS = {
  // ☕ Café feito
  'first-coffee': { type: 'coffee-made', requirement: 1, title: 'Primeiro Café' },
  'coffee-lover': { type: 'coffee-made', requirement: 10, title: 'Amante do Café' },
  'barista-junior': { type: 'coffee-made', requirement: 25, title: 'Barista Jr.' },
  'barista-senior': { type: 'coffee-made', requirement: 50, title: 'Barista Sênior' },
  'coffee-master': { type: 'coffee-made', requirement: 100, title: 'Mestre do Café' },
  'coffee-legend': { type: 'coffee-made', requirement: 250, title: 'Lenda do Café' },
  'coffee-god': { type: 'coffee-made', requirement: 500, title: 'Deus do Café' },
  
  // 🛒 Café trazido
  'first-supply': { type: 'coffee-brought', requirement: 1, title: 'Primeiro Suprimento' },
  'supplier': { type: 'coffee-brought', requirement: 5, title: 'Fornecedor' },
  'generous': { type: 'coffee-brought', requirement: 15, title: 'Generoso' },
  'benefactor': { type: 'coffee-brought', requirement: 30, title: 'Benfeitor' },
  'philanthropist': { type: 'coffee-brought', requirement: 50, title: 'Filantropo do Café' },
  
  // ⭐ Avaliações DADAS
  'first-rate': { type: 'ratings-given', requirement: 1, title: 'Crítico' },
  'taste-expert': { type: 'ratings-given', requirement: 20, title: 'Especialista' },
  'sommelier': { type: 'ratings-given', requirement: 50, title: 'Sommelier de Café' },
  'critic-master': { type: 'ratings-given', requirement: 100, title: 'Mestre Crítico' },
  
  // 🌟 5 estrelas RECEBIDAS
  'five-stars': { type: 'five-star-received', requirement: 1, title: '5 Estrelas' },
  'five-stars-master': { type: 'five-star-received', requirement: 10, title: 'Colecionador de Estrelas' },
  'five-stars-legend': { type: 'five-star-received', requirement: 25, title: 'Constelação' },
  'galaxy-of-stars': { type: 'five-star-received', requirement: 50, title: 'Galáxia de Estrelas' },
  
  // 💬 Mensagens enviadas
  'first-message': { type: 'messages-sent', requirement: 1, title: 'Primeira Mensagem' },
  'chatterbox': { type: 'messages-sent', requirement: 50, title: 'Tagarela' },
  'social-butterfly': { type: 'messages-sent', requirement: 200, title: 'Borboleta Social' },
  'chat-master': { type: 'messages-sent', requirement: 500, title: 'Mestre do Chat' },
  'legendary-talker': { type: 'messages-sent', requirement: 1000, title: 'Lendário Falador' },
  
  // 💥 Reações dadas
  'reactor': { type: 'reactions-given', requirement: 100, title: 'Reator Nuclear' },
  'reaction-god': { type: 'reactions-given', requirement: 500, title: 'Deus das Reações' },
  
  // 🔥 Reações recebidas
  'viral': { type: 'reactions-received', requirement: 50, title: 'Viral' },
  'popular': { type: 'reactions-received', requirement: 200, title: 'Popular' },
  
  // 🎨 Emojis únicos
  'emoji-master': { type: 'unique-emojis', requirement: 20, title: 'Mestre dos Emojis' },
  'emoji-legend': { type: 'unique-emojis', requirement: 50, title: 'Lenda dos Emojis' },
  
  // 🎖️ Veterano (dias desde criação)
  'veteran': { type: 'days-active', requirement: 30, title: 'Veterano' },
  'ancient': { type: 'days-active', requirement: 90, title: 'Ancião' },
  'founding-member': { type: 'days-active', requirement: 180, title: 'Membro Fundador' },
  
  // 🔥 Streak (verificado separadamente - depende de cálculo complexo)
  // 'streak-3': { type: 'streak', requirement: 3, title: 'Consistente' },
  // 'streak-7': { type: 'streak', requirement: 7, title: 'Dedicado' },
  // etc.
};

interface Bug {
  username: string;
  achievement: string;
  title: string;
  type: 'FALTANDO' | 'INDEVIDA';
  current: number;
  requirement: number;
}

async function getUserStats(user: any) {
  // Café feito
  const coffeeMade = await prisma.coffee.count({
    where: { makerId: user.id, type: 'MADE' }
  });
  
  // Café trazido
  const coffeeBrought = await prisma.coffee.count({
    where: { makerId: user.id, type: 'BROUGHT' }
  });
  
  // Avaliações DADAS
  const ratingsGiven = await prisma.rating.count({
    where: { userId: user.id }
  });
  
  // 5 estrelas RECEBIDAS (cafés deste usuário que receberam 5 estrelas)
  const fiveStarsReceived = await prisma.rating.count({
    where: {
      coffee: { makerId: user.id },
      rating: 5
    }
  });
  
  // Mensagens enviadas
  const messagesSent = await prisma.message.count({
    where: { authorId: user.id }
  });
  
  // Reações DADAS (userId na tabela é username, não UUID!)
  const reactionsGiven = await prisma.messageReaction.count({
    where: { userId: user.username }
  });
  
  // Reações RECEBIDAS (mensagens do usuário que receberam reação)
  const reactionsReceived = await prisma.messageReaction.count({
    where: {
      message: { authorId: user.id }
    }
  });
  
  // Emojis únicos usados
  const uniqueEmojisResult = await prisma.messageReaction.groupBy({
    by: ['emoji'],
    where: { userId: user.username }
  });
  const uniqueEmojis = uniqueEmojisResult.length;
  
  // Dias ativos
  const daysActive = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return {
    'coffee-made': coffeeMade,
    'coffee-brought': coffeeBrought,
    'ratings-given': ratingsGiven,
    'five-star-received': fiveStarsReceived,
    'messages-sent': messagesSent,
    'reactions-given': reactionsGiven,
    'reactions-received': reactionsReceived,
    'unique-emojis': uniqueEmojis,
    'days-active': daysActive,
  };
}

async function auditAndFix(dryRun: boolean = true) {
  console.log('🔍 AUDITORIA FINAL DE CONQUISTAS');
  console.log('═'.repeat(70));
  console.log(`Modo: ${dryRun ? 'DRY RUN (apenas relatório)' : 'EXECUÇÃO (corrigindo bugs)'}`);
  console.log('═'.repeat(70));
  
  const users = await prisma.user.findMany({
    include: { achievements: true }
  });
  
  const bugs: Bug[] = [];
  let totalFixed = 0;
  
  for (const user of users) {
    const stats = await getUserStats(user);
    const achievementTypes = user.achievements.map(a => a.type);
    const manualExceptions = MANUAL_EXCEPTIONS[user.username.toLowerCase()] || [];
    
    console.log(`\n👤 ${user.username} (${user.name})`);
    
    // Verificar cada conquista
    for (const [achievementId, def] of Object.entries(ACHIEVEMENTS)) {
      const current = stats[def.type as keyof typeof stats] || 0;
      const hasAchievement = achievementTypes.includes(achievementId);
      const shouldHave = current >= def.requirement;
      const isManualException = manualExceptions.includes(achievementId);
      
      // Bug: Deveria ter mas não tem
      if (shouldHave && !hasAchievement) {
        bugs.push({
          username: user.username,
          achievement: achievementId,
          title: def.title,
          type: 'FALTANDO',
          current,
          requirement: def.requirement
        });
        
        console.log(`   🐛 FALTANDO: ${achievementId} (${def.title}) - ${current}/${def.requirement}`);
        
        if (!dryRun) {
          await prisma.achievement.upsert({
            where: {
              userId_type: { userId: user.id, type: achievementId }
            },
            create: {
              userId: user.id,
              type: achievementId,
              title: def.title,
              description: `Conquista corrigida automaticamente`
            },
            update: {}
          });
          console.log(`      ✅ CORRIGIDO!`);
          totalFixed++;
        }
      }
      
      // Bug: Não deveria ter mas tem (exceto exceções manuais)
      if (!shouldHave && hasAchievement && !isManualException) {
        bugs.push({
          username: user.username,
          achievement: achievementId,
          title: def.title,
          type: 'INDEVIDA',
          current,
          requirement: def.requirement
        });
        
        console.log(`   ⚠️  INDEVIDA: ${achievementId} (${def.title}) - ${current}/${def.requirement}`);
        
        // NÃO remover automaticamente - apenas reportar
        // if (!dryRun) { ... }
      }
      
      // Exceção manual (apenas informativo)
      if (isManualException && hasAchievement) {
        console.log(`   ℹ️  MANUAL: ${achievementId} (${def.title}) - exceção conhecida`);
      }
    }
  }
  
  // Relatório final
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RELATÓRIO FINAL');
  console.log('═'.repeat(70));
  
  const faltando = bugs.filter(b => b.type === 'FALTANDO');
  const indevidas = bugs.filter(b => b.type === 'INDEVIDA');
  
  console.log(`\n🐛 Total de bugs: ${bugs.length}`);
  console.log(`   📥 Conquistas FALTANDO: ${faltando.length}`);
  console.log(`   📤 Conquistas INDEVIDAS: ${indevidas.length}`);
  
  if (!dryRun) {
    console.log(`\n✅ Conquistas corrigidas: ${totalFixed}`);
  }
  
  if (faltando.length > 0) {
    console.log('\n📥 DETALHES - Conquistas FALTANDO:');
    for (const bug of faltando) {
      console.log(`   ${bug.username}: ${bug.achievement} (${bug.title}) - ${bug.current}/${bug.requirement}`);
    }
  }
  
  if (indevidas.length > 0) {
    console.log('\n📤 DETALHES - Conquistas INDEVIDAS:');
    for (const bug of indevidas) {
      console.log(`   ${bug.username}: ${bug.achievement} (${bug.title}) - ${bug.current}/${bug.requirement}`);
    }
  }
  
  return bugs;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  
  try {
    await auditAndFix(!shouldFix);
    
    if (!shouldFix) {
      console.log('\n💡 Para corrigir bugs, execute com: --fix');
      console.log('   npx ts-node scripts/fix-all-achievements-final.ts --fix');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
