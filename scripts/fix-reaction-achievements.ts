/**
 * 🔧 Correção de Conquistas de Reações
 * 
 * Este script verifica e corrige conquistas de reações (reactor, viral, popular, etc)
 * para TODOS os usuários baseado no histórico real.
 * 
 * USO:
 * npx ts-node scripts/fix-reaction-achievements.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AchievementService } from '../src/services/achievement.service';
import { CoffeeRepository, AchievementRepository, LevelRepository, SettingRepository, UserRepository, RatingRepository } from '../src/repositories';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['error'],
});

async function fixReactionAchievements() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('CORRECAO DE CONQUISTAS DE REACOES');
    console.log('='.repeat(70) + '\n');

    // Criar instância do AchievementService
    const achievementService = new AchievementService(
      new CoffeeRepository(prisma),
      new AchievementRepository(prisma),
      new LevelRepository(prisma),
      new SettingRepository(prisma),
      new UserRepository(prisma),
      prisma,
      new RatingRepository(prisma)
    );

    const users = await prisma.user.findMany();
    let totalFixed = 0;

    for (const user of users) {
      // Contar reações DADAS (userId no MessageReaction é o username!)
      const reactionsGiven = await prisma.messageReaction.count({
        where: { userId: user.username }
      });
      
      // Contar reações RECEBIDAS (pelo authorId das mensagens)
      const reactionsReceived = await prisma.messageReaction.count({
        where: { message: { authorId: user.id } }
      });
      
      console.log(`\n📊 ${user.username}:`);
      console.log(`   Reacoes dadas: ${reactionsGiven}`);
      console.log(`   Reacoes recebidas: ${reactionsReceived}`);
      
      // Verificar conquistas atuais
      const achievements = await prisma.achievement.findMany({
        where: { userId: user.id },
        select: { type: true }
      });
      const achievementTypes = achievements.map(a => a.type);
      
      // Verificar conquistas que deveriam ter
      const shouldHave: string[] = [];
      
      // Reações DADAS
      if (reactionsGiven >= 100 && !achievementTypes.includes('reactor')) {
        shouldHave.push('reactor (100 reacoes dadas)');
      }
      if (reactionsGiven >= 500 && !achievementTypes.includes('reaction-god')) {
        shouldHave.push('reaction-god (500 reacoes dadas)');
      }
      
      // Reações RECEBIDAS
      if (reactionsReceived >= 50 && !achievementTypes.includes('viral')) {
        shouldHave.push('viral (50 reacoes recebidas)');
      }
      if (reactionsReceived >= 200 && !achievementTypes.includes('popular')) {
        shouldHave.push('popular (200 reacoes recebidas)');
      }
      
      if (shouldHave.length > 0) {
        console.log(`   ⚠️ Conquistas faltando: ${shouldHave.join(', ')}`);
        
        // Chamar checkReactionAchievements com os valores corretos
        await achievementService.checkReactionAchievements(user.id, reactionsGiven, reactionsReceived);
        
        // Verificar se foram criadas
        const newAchievements = await prisma.achievement.findMany({
          where: { 
            userId: user.id,
            type: { in: ['reactor', 'reaction-god', 'viral', 'popular'] }
          },
          select: { type: true, title: true, unlockedAt: true }
        });
        
        const justCreated = newAchievements.filter(a => {
          const now = new Date();
          const diff = now.getTime() - a.unlockedAt.getTime();
          return diff < 5000; // Criada nos últimos 5 segundos
        });
        
        if (justCreated.length > 0) {
          console.log(`   ✅ Desbloqueadas: ${justCreated.map(a => a.type).join(', ')}`);
          totalFixed += justCreated.length;
        }
      } else {
        console.log(`   ✅ Todas as conquistas de reacao corretas`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`CORRECAO CONCLUIDA: ${totalFixed} conquistas desbloqueadas`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixReactionAchievements();
