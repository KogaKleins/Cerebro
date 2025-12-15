/**
 * 🔧 Script de Correção Completa de Conquistas
 * 
 * Este script:
 * 1. Analisa TODOS os usuários
 * 2. Recalcula TODAS as conquistas que eles deveriam ter
 * 3. Desbloqueia conquistas faltando
 * 4. Credita XP correto para cada conquista
 * 
 * USO:
 * npx ts-node scripts/fix-all-achievements.ts
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

// ═══════════════════════════════════════════════════════════════
// 🎮 DEFINIÇÕES COMPLETAS DE CONQUISTAS (ATUALIZADO 12/2025)
// ═══════════════════════════════════════════════════════════════

const ACHIEVEMENT_DEFINITIONS = {
  // ☕ CAFÉ FEITO
  'first-coffee': { requirement: 1, rarity: 'common', title: 'Primeiro Café', description: 'Fez seu primeiro café' },
  'coffee-lover': { requirement: 10, rarity: 'common', title: 'Amante do Café', description: 'Fez 10 cafés' },
  'barista-junior': { requirement: 25, rarity: 'rare', title: 'Barista Jr.', description: 'Fez 25 cafés' },
  'barista-senior': { requirement: 50, rarity: 'epic', title: 'Barista Sênior', description: 'Fez 50 cafés' },
  'coffee-master': { requirement: 100, rarity: 'legendary', title: 'Mestre do Café', description: 'Fez 100 cafés' },
  'coffee-legend': { requirement: 250, rarity: 'platinum', title: 'Lenda do Café', description: 'Fez 250 cafés' },
  'coffee-god': { requirement: 500, rarity: 'platinum', title: 'Deus do Café', description: 'Fez 500 cafés' },
  
  // 🛒 CAFÉ TRAZIDO (SUPRIMENTOS)
  'first-supply': { requirement: 1, rarity: 'common', title: 'Primeiro Suprimento', description: 'Trouxe café pela primeira vez' },
  'supplier': { requirement: 5, rarity: 'common', title: 'Fornecedor', description: 'Trouxe café 5 vezes' },
  'generous': { requirement: 15, rarity: 'rare', title: 'Generoso', description: 'Trouxe café 15 vezes' },
  'benefactor': { requirement: 30, rarity: 'epic', title: 'Benfeitor', description: 'Trouxe café 30 vezes' },
  'philanthropist': { requirement: 50, rarity: 'legendary', title: 'Filantropo do Café', description: 'Trouxe café 50 vezes' },
  'supply-king': { requirement: 100, rarity: 'platinum', title: 'Rei dos Suprimentos', description: 'Trouxe café 100 vezes' },
  'supply-legend': { requirement: 200, rarity: 'platinum', title: 'Lenda do Abastecimento', description: 'Trouxe café 200 vezes' },
  
  // ✨ CONQUISTAS ESPECIAIS DE HORÁRIO
  'early-bird': { requirement: 0, rarity: 'rare', title: 'Madrugador', description: 'Fez café antes das 7h' },
  'night-owl': { requirement: 0, rarity: 'rare', title: 'Coruja', description: 'Fez café após as 20h' },
  'weekend-warrior': { requirement: 0, rarity: 'rare', title: 'Guerreiro de Fim de Semana', description: 'Fez café no fim de semana' },
  'monday-hero': { requirement: 0, rarity: 'rare', title: 'Herói da Segunda', description: 'Fez café logo na segunda-feira de manhã' },
  'friday-finisher': { requirement: 0, rarity: 'rare', title: 'Finalizador da Sexta', description: 'Fez o último café da semana na sexta' },
  'night-shift': { requirement: 0, rarity: 'epic', title: 'Turno da Noite', description: 'Fez café após meia-noite', secret: true },
  'early-legend': { requirement: 5, rarity: 'legendary', title: 'Lenda Matinal', description: '5x café antes das 6h' },
  'first-of-the-day': { requirement: 10, rarity: 'epic', title: 'Primeiro do Dia', description: '10x primeiro café do dia' },
  'last-of-the-day': { requirement: 10, rarity: 'epic', title: 'Último do Dia', description: '10x último café do dia' },
  
  // ⭐ AVALIAÇÕES RECEBIDAS (5 ESTRELAS)
  'five-stars': { requirement: 1, rarity: 'common', title: '5 Estrelas', description: 'Recebeu uma avaliação 5 estrelas' },
  'five-stars-master': { requirement: 10, rarity: 'epic', title: 'Colecionador de Estrelas', description: 'Recebeu 10 avaliações 5 estrelas' },
  'five-stars-legend': { requirement: 25, rarity: 'legendary', title: 'Constelação', description: 'Recebeu 25 avaliações 5 estrelas' },
  'galaxy-of-stars': { requirement: 50, rarity: 'platinum', title: 'Galáxia de Estrelas', description: 'Recebeu 50 avaliações 5 estrelas' },
  'double-rainbow': { requirement: 0, rarity: 'epic', title: 'Arco-Íris Duplo', description: '2x 5 estrelas no mesmo café', secret: true },
  'unanimous': { requirement: 0, rarity: 'platinum', title: 'Unanimidade', description: '5x 5 estrelas no mesmo café', secret: true },
  
  // ⭐ AVALIAÇÕES DADAS
  'first-rate': { requirement: 1, rarity: 'common', title: 'Crítico', description: 'Avaliou seu primeiro café' },
  'taste-expert': { requirement: 20, rarity: 'rare', title: 'Especialista', description: 'Avaliou 20 cafés' },
  'sommelier': { requirement: 50, rarity: 'epic', title: 'Sommelier de Café', description: 'Avaliou 50 cafés' },
  'critic-master': { requirement: 100, rarity: 'legendary', title: 'Mestre Crítico', description: 'Avaliou 100 cafés' },
  'diversity-champion': { requirement: 10, rarity: 'rare', title: 'Campeão da Diversidade', description: 'Avaliou 10 pessoas diferentes' },
  
  // 💬 MENSAGENS
  'first-message': { requirement: 1, rarity: 'common', title: 'Primeiro Contato', description: 'Enviou sua primeira mensagem' },
  'chatterbox': { requirement: 50, rarity: 'common', title: 'Tagarela', description: 'Enviou 50 mensagens' },
  'social-butterfly': { requirement: 200, rarity: 'rare', title: 'Sociável', description: 'Enviou 200 mensagens' },
  'communicator': { requirement: 500, rarity: 'epic', title: 'Comunicador', description: 'Enviou 500 mensagens' },
  'influencer': { requirement: 1000, rarity: 'legendary', title: 'Influenciador', description: 'Enviou 1000 mensagens' },
  
  // 🎮 DIVERSÃO
  'emoji-master': { requirement: 20, rarity: 'rare', title: 'Mestre dos Emojis', description: '20 emojis diferentes' },
  'emoji-legend': { requirement: 50, rarity: 'epic', title: 'Lenda dos Emojis', description: '50 emojis diferentes' },
  'reactor': { requirement: 100, rarity: 'rare', title: 'Reator Nuclear', description: '100 reações dadas' },
  'reaction-god': { requirement: 500, rarity: 'legendary', title: 'Deus das Reações', description: '500 reações dadas' },
  'speed-typer': { requirement: 5, rarity: 'rare', title: 'Digitador Veloz', description: '5 msgs em 1 minuto', secret: true },
  'coffee-duo': { requirement: 0, rarity: 'rare', title: 'Dupla do Café', description: 'Café no mesmo dia que outro', secret: true },
  'triple-threat': { requirement: 0, rarity: 'legendary', title: 'Ameaça Tripla', description: 'Fez, trouxe e avaliou no mesmo dia', secret: true },
  'silent-hero': { requirement: 10, rarity: 'epic', title: 'Herói Silencioso', description: '10x trouxe café', secret: true },
  
  // 🔥 STREAKS
  'streak-3': { requirement: 3, rarity: 'common', title: 'Consistente', description: 'Fez café 3 dias seguidos' },
  'streak-7': { requirement: 7, rarity: 'rare', title: 'Dedicado', description: 'Fez café 7 dias seguidos' },
  'streak-14': { requirement: 14, rarity: 'epic', title: 'Duas Semanas', description: 'Fez café 14 dias seguidos' },
  'streak-30': { requirement: 30, rarity: 'legendary', title: 'Imbatível', description: 'Fez café 30 dias seguidos' },
  'streak-60': { requirement: 60, rarity: 'platinum', title: 'Máquina de Café', description: 'Fez café 60 dias seguidos' },
  'coffee-streak-master': { requirement: 100, rarity: 'platinum', title: 'Senhor das Sequências', description: '100 dias seguidos' },
  'perfect-month': { requirement: 0, rarity: 'legendary', title: 'Mês Perfeito', description: 'Todos os dias úteis do mês', secret: true },
  
  // 📅 TEMPO DE SERVIÇO
  'veteran': { requirement: 30, rarity: 'rare', title: 'Veterano', description: 'Está no sistema há mais de 30 dias' },
  'ancient': { requirement: 90, rarity: 'epic', title: 'Ancião', description: 'Está no sistema há mais de 90 dias' },
  'founding-member': { requirement: 180, rarity: 'legendary', title: 'Membro Fundador', description: 'Está no sistema há mais de 180 dias' },
  'community-pillar': { requirement: 365, rarity: 'platinum', title: 'Pilar da Comunidade', description: 'Um ano no sistema' },
  'eternal-legend': { requirement: 730, rarity: 'platinum', title: 'Lenda Eterna', description: 'Dois anos no sistema' },
  'comeback-king': { requirement: 0, rarity: 'rare', title: 'Rei do Retorno', description: 'Voltou após 30+ dias', secret: true },
};

// XP por raridade
const RARITY_XP: Record<string, number> = {
  common: 10,
  rare: 25,
  epic: 50,
  legendary: 100,
  platinum: 250
};

interface UserStats {
  coffeesMade: number;
  coffeesBrought: number;
  fiveStarsReceived: number;
  ratingsGiven: number;
  messagesSent: number;
  daysActive: number;
  maxStreak: number;
  // Conquistas especiais de horário
  hasEarlyCoffee: boolean;
  hasLateCoffee: boolean;
  hasWeekendCoffee: boolean;
  hasMondayCoffee: boolean;
  hasFridayCoffee: boolean;
}

async function getUserStats(userId: string): Promise<UserStats> {
  // Cafés feitos (tipo MADE)
  const coffeesMade = await prisma.coffee.count({
    where: { makerId: userId, type: 'MADE' }
  });
  
  // Cafés trazidos (tipo BROUGHT)
  const coffeesBrought = await prisma.coffee.count({
    where: { makerId: userId, type: 'BROUGHT' }
  });
  
  // 5 estrelas recebidas
  const fiveStarsReceived = await prisma.rating.count({
    where: {
      rating: 5,
      coffee: { makerId: userId }
    }
  });
  
  // Avaliações dadas
  const ratingsGiven = await prisma.rating.count({
    where: { userId }
  });
  
  // Mensagens enviadas
  const messagesSent = await prisma.message.count({
    where: { authorId: userId }
  });
  
  // Dias desde o cadastro
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const daysActive = user ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Buscar todos os cafés para análise de streak e horários
  const coffees = await prisma.coffee.findMany({
    where: { makerId: userId, type: 'MADE' },
    select: { timestamp: true },
    orderBy: { timestamp: 'asc' }
  });
  
  // Calcular streak máxima e conquistas de horário
  let maxStreak = 0;
  let currentStreak = 0;
  let lastDate: string | null = null;
  
  let hasEarlyCoffee = false;
  let hasLateCoffee = false;
  let hasWeekendCoffee = false;
  let hasMondayCoffee = false;
  let hasFridayCoffee = false;
  
  for (const coffee of coffees) {
    const date = coffee.timestamp;
    const dateStr = date.toISOString().split('T')[0];
    const hour = date.getHours();
    const dayOfWeek = date.getDay(); // 0 = domingo, 6 = sábado
    
    // Verificar conquistas especiais de horário
    if (hour < 7) hasEarlyCoffee = true;
    if (hour >= 20) hasLateCoffee = true;
    if (dayOfWeek === 0 || dayOfWeek === 6) hasWeekendCoffee = true;
    if (dayOfWeek === 1 && hour < 10) hasMondayCoffee = true;
    if (dayOfWeek === 5 && hour >= 14) hasFridayCoffee = true;
    
    // Calcular streak
    if (lastDate === null) {
      currentStreak = 1;
    } else {
      const lastDateObj = new Date(lastDate);
      const currDateObj = new Date(dateStr);
      const diffDays = Math.floor((currDateObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentStreak++;
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
      // Se diffDays === 0, é o mesmo dia, não conta
    }
    lastDate = dateStr;
    maxStreak = Math.max(maxStreak, currentStreak);
  }
  
  return {
    coffeesMade,
    coffeesBrought,
    fiveStarsReceived,
    ratingsGiven,
    messagesSent,
    daysActive,
    maxStreak,
    hasEarlyCoffee,
    hasLateCoffee,
    hasWeekendCoffee,
    hasMondayCoffee,
    hasFridayCoffee
  };
}

function getExpectedAchievements(stats: UserStats): string[] {
  const expected: string[] = [];
  
  // Café feito
  if (stats.coffeesMade >= 1) expected.push('first-coffee');
  if (stats.coffeesMade >= 10) expected.push('coffee-lover');
  if (stats.coffeesMade >= 25) expected.push('barista-junior');
  if (stats.coffeesMade >= 50) expected.push('barista-senior');
  if (stats.coffeesMade >= 100) expected.push('coffee-master');
  if (stats.coffeesMade >= 250) expected.push('coffee-legend');
  if (stats.coffeesMade >= 500) expected.push('coffee-god');
  
  // Café trazido
  if (stats.coffeesBrought >= 1) expected.push('first-supply');
  if (stats.coffeesBrought >= 5) expected.push('supplier');
  if (stats.coffeesBrought >= 15) expected.push('generous');
  if (stats.coffeesBrought >= 30) expected.push('benefactor');
  if (stats.coffeesBrought >= 50) expected.push('philanthropist');
  
  // 5 estrelas recebidas
  if (stats.fiveStarsReceived >= 1) expected.push('five-stars');
  if (stats.fiveStarsReceived >= 10) expected.push('five-stars-master');
  if (stats.fiveStarsReceived >= 25) expected.push('five-stars-legend');
  
  // Avaliações dadas
  if (stats.ratingsGiven >= 1) expected.push('first-rate');
  if (stats.ratingsGiven >= 20) expected.push('taste-expert');
  if (stats.ratingsGiven >= 50) expected.push('sommelier');
  
  // Mensagens
  if (stats.messagesSent >= 1) expected.push('first-message');
  if (stats.messagesSent >= 50) expected.push('chatterbox');
  if (stats.messagesSent >= 200) expected.push('social-butterfly');
  if (stats.messagesSent >= 500) expected.push('communicator');
  if (stats.messagesSent >= 1000) expected.push('influencer');
  
  // Streaks
  if (stats.maxStreak >= 3) expected.push('streak-3');
  if (stats.maxStreak >= 7) expected.push('streak-7');
  if (stats.maxStreak >= 14) expected.push('streak-14');
  if (stats.maxStreak >= 30) expected.push('streak-30');
  if (stats.maxStreak >= 60) expected.push('streak-60');
  
  // Tempo de serviço
  if (stats.daysActive >= 30) expected.push('veteran');
  if (stats.daysActive >= 90) expected.push('ancient');
  if (stats.daysActive >= 180) expected.push('founding-member');
  
  // Conquistas especiais de horário
  if (stats.hasEarlyCoffee) expected.push('early-bird');
  if (stats.hasLateCoffee) expected.push('night-owl');
  if (stats.hasWeekendCoffee) expected.push('weekend-warrior');
  if (stats.hasMondayCoffee) expected.push('monday-hero');
  if (stats.hasFridayCoffee) expected.push('friday-finisher');
  
  return expected;
}

async function fixUserAchievements(userId: string, username: string): Promise<{
  fixed: number;
  xpAdded: number;
  details: string[];
}> {
  const result = { fixed: 0, xpAdded: 0, details: [] as string[] };
  
  try {
    // 1. Obter estatísticas do usuário
    const stats = await getUserStats(userId);
    
    // 2. Calcular conquistas esperadas
    const expectedAchievements = getExpectedAchievements(stats);
    
    // 3. Obter conquistas atuais
    const currentAchievements = await prisma.achievement.findMany({
      where: { userId },
      select: { type: true }
    });
    const currentTypes = new Set(currentAchievements.map(a => a.type));
    
    // 4. Encontrar conquistas faltando
    const missingAchievements = expectedAchievements.filter(type => !currentTypes.has(type));
    
    if (missingAchievements.length === 0) {
      return result;
    }
    
    console.log(`  📋 ${username}: ${missingAchievements.length} conquistas faltando`);
    
    // 5. Desbloquear conquistas faltando
    for (const achievementType of missingAchievements) {
      const definition = ACHIEVEMENT_DEFINITIONS[achievementType as keyof typeof ACHIEVEMENT_DEFINITIONS];
      if (!definition) {
        console.log(`    ⚠️ Definição não encontrada: ${achievementType}`);
        continue;
      }
      
      try {
        // Criar conquista
        await prisma.achievement.create({
          data: {
            userId,
            type: achievementType,
            title: definition.title,
            description: definition.description
          }
        });
        
        // Calcular XP
        const xp = RARITY_XP[definition.rarity] || 10;
        
        // Atualizar XP do usuário
        const currentLevel = await prisma.userLevel.findUnique({ where: { userId } });
        if (currentLevel) {
          await prisma.userLevel.update({
            where: { userId },
            data: {
              totalXP: { increment: xp },
              history: {
                push: {
                  type: 'achievement-fix',
                  xp: xp,
                  timestamp: new Date().toISOString(),
                  reason: `Correção: ${definition.title} (${definition.rarity})`
                }
              }
            }
          });
        } else {
          // Criar userLevel se não existir
          await prisma.userLevel.create({
            data: {
              userId,
              totalXP: xp,
              level: 1,
              history: [{
                type: 'achievement-fix',
                xp: xp,
                timestamp: new Date().toISOString(),
                reason: `Correção: ${definition.title} (${definition.rarity})`
              }]
            }
          });
        }
        
        result.fixed++;
        result.xpAdded += xp;
        result.details.push(`✅ ${definition.title} (+${xp} XP)`);
        
      } catch (err: any) {
        // Ignorar erro de duplicata (já existe)
        if (err.code !== 'P2002') {
          console.log(`    ❌ Erro ao criar ${achievementType}:`, err.message);
        }
      }
    }
    
    return result;
    
  } catch (error) {
    console.error(`  ❌ Erro ao processar ${username}:`, error);
    return result;
  }
}

async function main() {
  console.log('\n🔧 ═══════════════════════════════════════════════════');
  console.log('   CORREÇÃO COMPLETA DE CONQUISTAS');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // 1. Buscar todos os usuários
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true }
    });
    
    console.log(`📊 Total de usuários: ${users.length}\n`);
    
    let totalFixed = 0;
    let totalXP = 0;
    const userResults: { username: string; fixed: number; xp: number }[] = [];
    
    // 2. Processar cada usuário
    for (const user of users) {
      console.log(`\n👤 Processando: ${user.name} (${user.username})`);
      
      const result = await fixUserAchievements(user.id, user.username);
      
      if (result.fixed > 0) {
        totalFixed += result.fixed;
        totalXP += result.xpAdded;
        userResults.push({
          username: user.username,
          fixed: result.fixed,
          xp: result.xpAdded
        });
        
        for (const detail of result.details) {
          console.log(`    ${detail}`);
        }
      } else {
        console.log('    ✓ Todas as conquistas estão corretas');
      }
    }
    
    // 3. Relatório final
    console.log('\n\n═══════════════════════════════════════════════════');
    console.log('📊 RELATÓRIO FINAL');
    console.log('═══════════════════════════════════════════════════\n');
    
    console.log(`Total de conquistas corrigidas: ${totalFixed}`);
    console.log(`Total de XP creditado: ${totalXP}`);
    console.log(`Usuários afetados: ${userResults.length}`);
    
    if (userResults.length > 0) {
      console.log('\n📋 Detalhes por usuário:');
      for (const ur of userResults) {
        console.log(`   ${ur.username}: ${ur.fixed} conquistas, +${ur.xp} XP`);
      }
    }
    
    console.log('\n✅ Correção concluída com sucesso!\n');
    
  } catch (error) {
    console.error('\n❌ ERRO durante correção:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
