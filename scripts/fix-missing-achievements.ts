/**
 * Script para verificar e conceder conquistas pendentes de todos os usuários
 * Execute após as correções para garantir que todos recebam suas conquistas devidas
 * 
 * npx ts-node scripts/fix-missing-achievements.ts
 */

import { getPrismaClient, CoffeeRepository, AchievementRepository, LevelRepository, SettingRepository, UserRepository, RatingRepository, ReactionRepository } from '../src/repositories';
import { AchievementService } from '../src/services/achievement.service';

const prisma = getPrismaClient();

async function fixMissingAchievements() {
  console.log('🔧 Verificando conquistas pendentes de todos os usuários...\n');
  
  const achievementService = new AchievementService(
    new CoffeeRepository(prisma),
    new AchievementRepository(prisma),
    new LevelRepository(prisma),
    new SettingRepository(prisma),
    new UserRepository(prisma),
    prisma,
    new RatingRepository(prisma)
  );
  
  const reactionRepo = new ReactionRepository(prisma);
  
  // Buscar todos os usuários
  const users = await prisma.user.findMany();
  console.log(`📊 Total de usuários: ${users.length}\n`);
  
  let totalFixed = 0;
  
  for (const user of users) {
    console.log(`\n👤 Verificando: ${user.username} (${user.name})`);
    
    try {
      // Obter estatísticas para verificação completa
      const messageCount = await prisma.message.count({
        where: { authorId: user.id, deletedAt: null }
      });
      
      const reactionStats = await reactionRepo.getReactionStatsForUser(user.id);
      
      // Contar conquistas antes
      const beforeCount = await prisma.achievement.count({
        where: { userId: user.id }
      });
      
      // Verificar TODAS as conquistas
      await achievementService.checkAllAchievementsForUser(user.id, {
        messageCount,
        reactionsGiven: reactionStats.given,
        reactionsReceived: reactionStats.received
      });
      
      // Verificar conquistas específicas que foram adicionadas
      await achievementService.checkEmojiAchievements(user.id, reactionStats.uniqueEmojis);
      
      // Contar conquistas depois
      const afterCount = await prisma.achievement.count({
        where: { userId: user.id }
      });
      
      const newAchievements = afterCount - beforeCount;
      if (newAchievements > 0) {
        console.log(`  ✅ ${newAchievements} nova(s) conquista(s) desbloqueada(s)!`);
        totalFixed += newAchievements;
      } else {
        console.log(`  ℹ️ Nenhuma conquista pendente`);
      }
      
    } catch (error) {
      console.log(`  ❌ Erro: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Processo concluído!`);
  console.log(`📈 Total de novas conquistas desbloqueadas: ${totalFixed}`);
  
  await prisma.$disconnect();
}

fixMissingAchievements().catch(console.error);
