/**
 * 🔍 AUDITORIA COMPLETA DE TODAS AS CONQUISTAS
 * 
 * Verifica TODOS os tipos de conquistas e identifica bugs:
 * 1. Conquistas de café feito
 * 2. Conquistas de café trazido
 * 3. Conquistas de avaliações
 * 4. Conquistas de reações
 * 5. Conquistas de mensagens
 * 6. Conquistas de streak
 * 7. Conquistas de tempo (veterano, ancião)
 * 8. Conquistas de horário especial
 * 9. Conquistas de emojis
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
// 📋 DEFINIÇÕES DE TODAS AS CONQUISTAS
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
  
  // ⭐ Avaliações recebidas (5 estrelas)
  'five-stars': { type: 'five-stars-received', requirement: 1, title: '5 Estrelas' },
  'five-stars-master': { type: 'five-stars-received', requirement: 10, title: 'Colecionador de Estrelas' },
  'five-stars-legend': { type: 'five-stars-received', requirement: 25, title: 'Constelação' },
  
  // 📝 Avaliações dadas
  'first-rate': { type: 'ratings-given', requirement: 1, title: 'Primeiro Voto' },
  'taste-expert': { type: 'ratings-given', requirement: 20, title: 'Expert de Sabor' },
  'sommelier': { type: 'ratings-given', requirement: 50, title: 'Sommelier' },
  
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
  
  // 🔥 Streak
  'streak-3': { type: 'streak', requirement: 3, title: 'Consistente' },
  'streak-7': { type: 'streak', requirement: 7, title: 'Dedicado' },
  'streak-14': { type: 'streak', requirement: 14, title: 'Duas Semanas' },
  'streak-30': { type: 'streak', requirement: 30, title: 'Imbatível' },
  'streak-60': { type: 'streak', requirement: 60, title: 'Máquina de Café' },
  
  // 🎖️ Veterano
  'veteran': { type: 'days-active', requirement: 30, title: 'Veterano' },
  'ancient': { type: 'days-active', requirement: 90, title: 'Ancião' },
  'founding-member': { type: 'days-active', requirement: 180, title: 'Membro Fundador' },
  
  // 🎨 Emojis únicos (sistema tem 8 emojis disponíveis)
  'emoji-master': { type: 'unique-emojis', requirement: 5, title: 'Mestre dos Emojis' },
  'emoji-legend': { type: 'unique-emojis', requirement: 8, title: 'Lenda dos Emojis' },
  
  // ⏰ Horário especial
  'early-bird': { type: 'early-coffee', requirement: 1, title: 'Madrugador' },
  'night-owl': { type: 'late-coffee', requirement: 1, title: 'Coruja' },
  'weekend-warrior': { type: 'weekend-coffee', requirement: 1, title: 'Guerreiro de Fim de Semana' },
  'monday-hero': { type: 'monday-coffee', requirement: 1, title: 'Herói da Segunda' },
  'friday-finisher': { type: 'friday-coffee', requirement: 1, title: 'Finalizador da Sexta' },
};

interface Bug {
  username: string;
  achievement: string;
  title: string;
  type: 'FALTANDO' | 'INDEVIDA';
  current: number;
  requirement: number;
  reason: string;
}

async function auditAllAchievements() {
  console.log('🔍 AUDITORIA COMPLETA DE CONQUISTAS');
  console.log('═'.repeat(70));
  
  const users = await prisma.user.findMany({
    include: { achievements: true }
  });
  
  const bugs: Bug[] = [];
  
  for (const user of users) {
    const achievementTypes = user.achievements.map(a => a.type);
    
    // ═══════════════════════════════════════════════════════════════
    // 1. CAFÉ FEITO
    // ═══════════════════════════════════════════════════════════════
    const coffeeMade = await prisma.coffee.count({
      where: { makerId: user.id, type: 'MADE' }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 2. CAFÉ TRAZIDO
    // ═══════════════════════════════════════════════════════════════
    const coffeeBrought = await prisma.coffee.count({
      where: { makerId: user.id, type: 'BROUGHT' }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 3. AVALIAÇÕES 5 ESTRELAS RECEBIDAS
    // ═══════════════════════════════════════════════════════════════
    const fiveStarsReceived = await prisma.rating.count({
      where: {
        coffee: { makerId: user.id },
        rating: 5
      }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 4. AVALIAÇÕES DADAS
    // ═══════════════════════════════════════════════════════════════
    const ratingsGiven = await prisma.rating.count({
      where: { userId: user.id }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 5. MENSAGENS ENVIADAS
    // ═══════════════════════════════════════════════════════════════
    const messagesSent = await prisma.message.count({
      where: { authorId: user.id }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 6. REAÇÕES DADAS
    // ═══════════════════════════════════════════════════════════════
    const reactionsGiven = await prisma.messageReaction.count({
      where: { userId: user.username }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 7. REAÇÕES RECEBIDAS
    // ═══════════════════════════════════════════════════════════════
    const reactionsReceived = await prisma.messageReaction.count({
      where: {
        message: { authorId: user.id }
      }
    });
    
    // ═══════════════════════════════════════════════════════════════
    // 8. EMOJIS ÚNICOS
    // ═══════════════════════════════════════════════════════════════
    const uniqueEmojisResult = await prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { userId: user.username }
    });
    const uniqueEmojis = uniqueEmojisResult.length;
    
    // ═══════════════════════════════════════════════════════════════
    // 9. DIAS ATIVOS (tempo desde criação)
    // ═══════════════════════════════════════════════════════════════
    const daysActive = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // ═══════════════════════════════════════════════════════════════
    // 10. STREAK (dias consecutivos com café)
    // ═══════════════════════════════════════════════════════════════
    const coffees = await prisma.coffee.findMany({
      where: { makerId: user.id, type: 'MADE' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    
    let currentStreak = 0;
    if (coffees.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const coffeeDays = new Set<string>();
      for (const coffee of coffees) {
        const date = new Date(coffee.createdAt);
        coffeeDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      }
      
      const sortedDays = Array.from(coffeeDays).sort().reverse();
      
      // Contar streak a partir do dia mais recente
      for (let i = 0; i < sortedDays.length; i++) {
        const parts = sortedDays[i].split('-');
        const checkDate = new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
        
        if (i === 0) {
          // Verificar se o primeiro dia é hoje ou ontem
          const diffDays = Math.floor((today.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays > 1) break; // Streak quebrado
          currentStreak = 1;
        } else {
          const prevParts = sortedDays[i - 1].split('-');
          const prevDate = new Date(parseInt(prevParts[0]), parseInt(prevParts[1]), parseInt(prevParts[2]));
          const dayDiff = Math.floor((prevDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (dayDiff === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // 11. CAFÉ EM HORÁRIOS ESPECIAIS
    // ═══════════════════════════════════════════════════════════════
    const userCoffees = await prisma.coffee.findMany({
      where: { makerId: user.id, type: 'MADE' },
      select: { createdAt: true }
    });
    
    let hasEarlyCoffee = false;
    let hasLateCoffee = false;
    let hasWeekendCoffee = false;
    let hasMondayCoffee = false;
    let hasFridayCoffee = false;
    
    for (const coffee of userCoffees) {
      const date = new Date(coffee.createdAt);
      const hour = date.getHours();
      const day = date.getDay(); // 0 = domingo, 6 = sábado
      
      if (hour < 7) hasEarlyCoffee = true;
      if (hour >= 20) hasLateCoffee = true;
      if (day === 0 || day === 6) hasWeekendCoffee = true;
      if (day === 1 && hour < 10) hasMondayCoffee = true;
      if (day === 5 && hour >= 14) hasFridayCoffee = true;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // MAPEAR VALORES PARA VERIFICAÇÃO
    // ═══════════════════════════════════════════════════════════════
    const stats: Record<string, number | boolean> = {
      'coffee-made': coffeeMade,
      'coffee-brought': coffeeBrought,
      'five-stars-received': fiveStarsReceived,
      'ratings-given': ratingsGiven,
      'messages-sent': messagesSent,
      'reactions-given': reactionsGiven,
      'reactions-received': reactionsReceived,
      'unique-emojis': uniqueEmojis,
      'days-active': daysActive,
      'streak': currentStreak,
      'early-coffee': hasEarlyCoffee,
      'late-coffee': hasLateCoffee,
      'weekend-coffee': hasWeekendCoffee,
      'monday-coffee': hasMondayCoffee,
      'friday-coffee': hasFridayCoffee,
    };
    
    // ═══════════════════════════════════════════════════════════════
    // VERIFICAR CADA CONQUISTA
    // ═══════════════════════════════════════════════════════════════
    for (const [achievementId, def] of Object.entries(ACHIEVEMENTS)) {
      const current = stats[def.type];
      const hasAchievement = achievementTypes.includes(achievementId);
      
      let shouldHave = false;
      if (typeof current === 'boolean') {
        shouldHave = current === true;
      } else if (typeof current === 'number') {
        shouldHave = current >= def.requirement;
      }
      
      // Bug: Deveria ter mas não tem
      if (shouldHave && !hasAchievement) {
        bugs.push({
          username: user.username,
          achievement: achievementId,
          title: def.title,
          type: 'FALTANDO',
          current: typeof current === 'boolean' ? (current ? 1 : 0) : (current || 0),
          requirement: def.requirement,
          reason: `Tem ${current}/${def.requirement} mas conquista não foi desbloqueada`
        });
      }
      
      // Bug: Não deveria ter mas tem
      if (!shouldHave && hasAchievement) {
        bugs.push({
          username: user.username,
          achievement: achievementId,
          title: def.title,
          type: 'INDEVIDA',
          current: typeof current === 'boolean' ? (current ? 1 : 0) : (current || 0),
          requirement: def.requirement,
          reason: `Tem apenas ${current}/${def.requirement} mas conquistaFOI desbloqueada`
        });
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // RELATÓRIO
  // ═══════════════════════════════════════════════════════════════
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RELATÓRIO DE BUGS');
  console.log('═'.repeat(70));
  
  if (bugs.length === 0) {
    console.log('\n✅ Nenhum bug encontrado! Todas as conquistas estão corretas.');
    return [];
  }
  
  const faltando = bugs.filter(b => b.type === 'FALTANDO');
  const indevidas = bugs.filter(b => b.type === 'INDEVIDA');
  
  console.log(`\n🐛 TOTAL DE BUGS: ${bugs.length}`);
  console.log(`   📥 Conquistas FALTANDO: ${faltando.length}`);
  console.log(`   📤 Conquistas INDEVIDAS: ${indevidas.length}`);
  
  if (faltando.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('📥 CONQUISTAS FALTANDO (usuário deveria ter mas não tem):');
    console.log('─'.repeat(70));
    
    // Agrupar por tipo de conquista
    const byType: Record<string, Bug[]> = {};
    for (const bug of faltando) {
      if (!byType[bug.achievement]) byType[bug.achievement] = [];
      byType[bug.achievement].push(bug);
    }
    
    for (const [achievement, bugs] of Object.entries(byType)) {
      const def = ACHIEVEMENTS[achievement as keyof typeof ACHIEVEMENTS];
      console.log(`\n   🏆 ${achievement} (${def?.title || '?'})`);
      for (const bug of bugs) {
        console.log(`      👤 ${bug.username}: ${bug.current}/${bug.requirement}`);
      }
    }
  }
  
  if (indevidas.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('📤 CONQUISTAS INDEVIDAS (usuário tem mas não deveria):');
    console.log('─'.repeat(70));
    
    for (const bug of indevidas) {
      console.log(`   👤 ${bug.username}: ${bug.achievement} (${bug.title})`);
      console.log(`      ${bug.reason}`);
    }
  }
  
  return bugs;
}

async function fixAllBugs(dryRun: boolean = true) {
  console.log('\n' + '═'.repeat(70));
  console.log(`🔧 ${dryRun ? '[DRY RUN]' : '[EXECUTANDO]'} CORREÇÃO DE CONQUISTAS`);
  console.log('═'.repeat(70));
  
  const bugs = await auditAllAchievements();
  
  if (bugs.length === 0) {
    console.log('\n✅ Nada para corrigir!');
    return;
  }
  
  const faltando = bugs.filter(b => b.type === 'FALTANDO');
  const indevidas = bugs.filter(b => b.type === 'INDEVIDA');
  
  // Corrigir conquistas faltando
  if (faltando.length > 0) {
    console.log(`\n📥 Corrigindo ${faltando.length} conquistas faltando...`);
    
    for (const bug of faltando) {
      const user = await prisma.user.findUnique({ where: { username: bug.username } });
      if (!user) continue;
      
      const def = ACHIEVEMENTS[bug.achievement as keyof typeof ACHIEVEMENTS];
      
      if (!dryRun) {
        await prisma.achievement.upsert({
          where: {
            userId_type: {
              userId: user.id,
              type: bug.achievement
            }
          },
          create: {
            userId: user.id,
            type: bug.achievement,
            title: def?.title || bug.achievement,
            description: `Conquista desbloqueada automaticamente (correção de bug)`
          },
          update: {}
        });
        console.log(`   ✅ ${bug.username}: ${bug.achievement}`);
      } else {
        console.log(`   ℹ️  ${bug.username}: ${bug.achievement} (seria desbloqueada)`);
      }
    }
  }
  
  // Remover conquistas indevidas
  if (indevidas.length > 0) {
    console.log(`\n📤 Removendo ${indevidas.length} conquistas indevidas...`);
    
    for (const bug of indevidas) {
      const user = await prisma.user.findUnique({ where: { username: bug.username } });
      if (!user) continue;
      
      if (!dryRun) {
        await prisma.achievement.deleteMany({
          where: {
            userId: user.id,
            type: bug.achievement
          }
        });
        console.log(`   🗑️ ${bug.username}: ${bug.achievement}`);
      } else {
        console.log(`   ℹ️  ${bug.username}: ${bug.achievement} (seria removida)`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log(`📊 RESULTADO: ${bugs.length} bugs ${dryRun ? 'seriam' : 'foram'} corrigidos`);
  console.log('═'.repeat(70));
}

async function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  
  try {
    if (shouldFix) {
      await fixAllBugs(false);
    } else {
      await auditAllAchievements();
      console.log('\n💡 Para corrigir bugs, execute com: --fix');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
