/**
 * 🔍 DIAGNÓSTICO DE CONQUISTAS DE REAÇÕES
 * 
 * Script para investigar o bug reportado pelo Pedrao:
 * - Fez 50 reações mas não ganhou a conquista
 * 
 * Verifica:
 * 1. Contagem real de reações no banco
 * 2. Requisitos das conquistas
 * 3. Por que não foi desbloqueada
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

interface ReactionStats {
  username: string;
  userId: string;
  reactionsGiven: number;
  reactionsReceived: number;
  uniqueEmojis: number;
  achievements: string[];
  missingAchievements: Array<{
    type: string;
    requirement: number;
    current: number;
    eligible: boolean;
    bug?: string;
  }>;
}

// Definições das conquistas de reação
const REACTION_ACHIEVEMENTS = {
  // Reações DADAS
  'reactor': { type: 'reactions-given', requirement: 100, title: 'Reator Nuclear' },
  'reaction-god': { type: 'reactions-given', requirement: 500, title: 'Deus das Reações' },
  
  // Reações RECEBIDAS
  'viral': { type: 'reactions-received', requirement: 50, title: 'Viral' },
  'popular': { type: 'reactions-received', requirement: 200, title: 'Popular' },
};

async function getUserReactionStats(username: string): Promise<ReactionStats | null> {
  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { username },
    include: { achievements: true }
  });
  
  if (!user) {
    console.log(`❌ Usuário "${username}" não encontrado`);
    return null;
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 DIAGNÓSTICO DE REAÇÕES: ${user.username}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`   UUID: ${user.id}`);
  console.log(`   Nome: ${user.name}`);
  
  // Contar reações DADAS pelo usuário
  // NOTA: Na tabela messageReaction, userId é o USERNAME (não UUID)
  const reactionsGiven = await prisma.messageReaction.count({
    where: { userId: username }  // <-- AQUI! userId é username
  });
  
  // Contar reações RECEBIDAS (mensagens do usuário que receberam reação)
  const reactionsReceived = await prisma.messageReaction.count({
    where: {
      message: {
        authorId: user.id  // <-- AQUI! authorId é UUID
      }
    }
  });
  
  // Contar emojis únicos usados
  const uniqueEmojisResult = await prisma.messageReaction.groupBy({
    by: ['emoji'],
    where: { userId: username }
  });
  const uniqueEmojis = uniqueEmojisResult.length;
  
  console.log(`\n📈 ESTATÍSTICAS DE REAÇÕES:`);
  console.log(`   Reações DADAS: ${reactionsGiven}`);
  console.log(`   Reações RECEBIDAS: ${reactionsReceived}`);
  console.log(`   Emojis únicos usados: ${uniqueEmojis}`);
  
  // Conquistas desbloqueadas
  const achievementTypes = user.achievements.map(a => a.type);
  const reactionAchievements = achievementTypes.filter(t => 
    Object.keys(REACTION_ACHIEVEMENTS).includes(t)
  );
  
  console.log(`\n🏆 CONQUISTAS DE REAÇÃO DESBLOQUEADAS: ${reactionAchievements.length}`);
  reactionAchievements.forEach(type => {
    const def = REACTION_ACHIEVEMENTS[type as keyof typeof REACTION_ACHIEVEMENTS];
    console.log(`   ✅ ${type}: ${def?.title}`);
  });
  
  // Verificar conquistas faltantes
  const missingAchievements: ReactionStats['missingAchievements'] = [];
  
  console.log(`\n❓ ANÁLISE DE CONQUISTAS FALTANTES:`);
  
  for (const [type, def] of Object.entries(REACTION_ACHIEVEMENTS)) {
    if (!achievementTypes.includes(type)) {
      const current = def.type === 'reactions-given' ? reactionsGiven : reactionsReceived;
      const eligible = current >= def.requirement;
      
      let bug: string | undefined;
      if (eligible) {
        bug = `🐛 BUG! Usuário tem ${current}/${def.requirement} mas conquista NÃO foi desbloqueada!`;
      }
      
      missingAchievements.push({
        type,
        requirement: def.requirement,
        current,
        eligible,
        bug
      });
      
      const status = eligible ? '🐛 BUG' : '⏳ Em progresso';
      console.log(`   ${status} ${type} (${def.title}): ${current}/${def.requirement}`);
      if (bug) {
        console.log(`      ${bug}`);
      }
    }
  }
  
  return {
    username,
    userId: user.id,
    reactionsGiven,
    reactionsReceived,
    uniqueEmojis,
    achievements: reactionAchievements,
    missingAchievements
  };
}

async function analyzeAllUsers() {
  console.log('\n' + '═'.repeat(60));
  console.log('🔍 ANÁLISE COMPLETA DE TODOS OS USUÁRIOS');
  console.log('═'.repeat(60));
  
  const users = await prisma.user.findMany({
    include: { achievements: true }
  });
  
  const bugs: Array<{
    username: string;
    achievement: string;
    current: number;
    requirement: number;
  }> = [];
  
  for (const user of users) {
    // Reações dadas (userId = username na tabela messageReaction)
    const reactionsGiven = await prisma.messageReaction.count({
      where: { userId: user.username }
    });
    
    // Reações recebidas (authorId = UUID)
    const reactionsReceived = await prisma.messageReaction.count({
      where: {
        message: { authorId: user.id }
      }
    });
    
    const achievementTypes = user.achievements.map(a => a.type);
    
    // Verificar conquistas que deveriam ter mas não tem
    for (const [type, def] of Object.entries(REACTION_ACHIEVEMENTS)) {
      if (!achievementTypes.includes(type)) {
        const current = def.type === 'reactions-given' ? reactionsGiven : reactionsReceived;
        if (current >= def.requirement) {
          bugs.push({
            username: user.username,
            achievement: type,
            current,
            requirement: def.requirement
          });
        }
      }
    }
  }
  
  if (bugs.length > 0) {
    console.log(`\n🐛 BUGS ENCONTRADOS: ${bugs.length}`);
    console.log('─'.repeat(60));
    
    for (const bug of bugs) {
      console.log(`   ${bug.username}: ${bug.achievement}`);
      console.log(`      Tem: ${bug.current} | Precisa: ${bug.requirement}`);
    }
    
    return bugs;
  } else {
    console.log('\n✅ Nenhum bug encontrado nas conquistas de reação!');
    return [];
  }
}

async function fixReactionAchievements(dryRun: boolean = true) {
  console.log('\n' + '═'.repeat(60));
  console.log(`🔧 ${dryRun ? '[DRY RUN]' : '[EXECUTANDO]'} CORREÇÃO DE CONQUISTAS DE REAÇÃO`);
  console.log('═'.repeat(60));
  
  const users = await prisma.user.findMany({
    include: { achievements: true }
  });
  
  let fixed = 0;
  
  for (const user of users) {
    const reactionsGiven = await prisma.messageReaction.count({
      where: { userId: user.username }
    });
    
    const reactionsReceived = await prisma.messageReaction.count({
      where: {
        message: { authorId: user.id }
      }
    });
    
    const achievementTypes = user.achievements.map(a => a.type);
    
    for (const [type, def] of Object.entries(REACTION_ACHIEVEMENTS)) {
      if (!achievementTypes.includes(type)) {
        const current = def.type === 'reactions-given' ? reactionsGiven : reactionsReceived;
        
        if (current >= def.requirement) {
          console.log(`\n   🔧 ${user.username}: ${type} (${def.title})`);
          console.log(`      ${current}/${def.requirement} - ELEGÍVEL`);
          
          if (!dryRun) {
            await prisma.achievement.create({
              data: {
                userId: user.id,
                type,
                title: def.title,
                description: `Conquista de reação: ${def.type === 'reactions-given' ? 'reações dadas' : 'reações recebidas'}`
              }
            });
            console.log(`      ✅ DESBLOQUEADA!`);
          } else {
            console.log(`      ℹ️  Seria desbloqueada (dry run)`);
          }
          
          fixed++;
        }
      }
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RESULTADO: ${fixed} conquistas ${dryRun ? 'seriam' : 'foram'} corrigidas`);
  console.log('═'.repeat(60));
  
  return fixed;
}

async function main() {
  console.log('🔍 DIAGNÓSTICO DE CONQUISTAS DE REAÇÕES');
  console.log('═'.repeat(60));
  
  const args = process.argv.slice(2);
  const username = args.find(a => !a.startsWith('--'));
  const shouldFix = args.includes('--fix');
  
  try {
    if (username) {
      // Analisar usuário específico
      await getUserReactionStats(username);
    } else {
      // Analisar todos os usuários
      await analyzeAllUsers();
    }
    
    // Se --fix foi passado, corrigir
    if (shouldFix) {
      await fixReactionAchievements(false);
    } else {
      console.log('\n💡 Para corrigir bugs, execute com: --fix');
      console.log('   Exemplo: npx ts-node scripts/diagnose-reaction-achievements.ts --fix');
      console.log('   Ou: npx ts-node scripts/diagnose-reaction-achievements.ts pedrao --fix');
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
