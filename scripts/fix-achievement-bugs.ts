/**
 * Script para corrigir bugs nas conquistas
 */
import { getPrismaClient } from '../src/repositories';
import { AchievementService } from '../src/services/achievement.service';
import { CoffeeRepository, AchievementRepository, LevelRepository, SettingRepository, UserRepository, RatingRepository } from '../src/repositories';

const prisma = getPrismaClient();

async function fixAchievements() {
  console.log('🔧 Corrigindo conquistas...\n');

  // Criar serviço de conquistas
  const achievementService = new AchievementService(
    new CoffeeRepository(prisma),
    new AchievementRepository(prisma),
    new LevelRepository(prisma),
    new SettingRepository(prisma),
    new UserRepository(prisma),
    prisma,
    new RatingRepository(prisma)
  );

  // 1. Corrigir conquistas do Wilmar
  console.log('=== CORRIGINDO WILMAR ===');
  const wilmar = await prisma.user.findUnique({ where: { username: 'wilmar' } });
  if (wilmar) {
    console.log('Verificando conquistas de café...');
    await achievementService.checkCoffeeAchievements(wilmar.id);
    
    console.log('Verificando conquistas de horário especial...');
    await achievementService.checkSpecialTimeAchievements(wilmar.id);
    
    console.log('Verificando conquistas de mensagens...');
    const msgCount = await prisma.message.count({
      where: { authorId: wilmar.id, deletedAt: null }
    });
    await achievementService.checkMessageAchievements(wilmar.id, msgCount);
    
    console.log('✅ Wilmar corrigido!\n');
  }

  // 2. Corrigir conquistas do Renan
  console.log('=== CORRIGINDO RENAN ===');
  const renan = await prisma.user.findUnique({ where: { username: 'renan' } });
  if (renan) {
    console.log('Verificando conquistas de mensagens...');
    const msgCount = await prisma.message.count({
      where: { authorId: renan.id, deletedAt: null }
    });
    await achievementService.checkMessageAchievements(renan.id, msgCount);
    
    console.log('✅ Renan corrigido!\n');
  }

  // 3. Corrigir conquistas do Chris (caso a early-bird tenha sumido)
  console.log('=== VERIFICANDO CHRIS ===');
  const chris = await prisma.user.findUnique({ where: { username: 'chris' } });
  if (chris) {
    // Verificar se early-bird está lá
    const earlyBird = await prisma.achievement.findFirst({
      where: { userId: chris.id, type: 'early-bird' }
    });
    
    if (earlyBird) {
      console.log('✅ Chris já tem early-bird!');
    } else {
      console.log('⚠️ Chris não tem early-bird, verificando...');
      await achievementService.checkSpecialTimeAchievements(chris.id);
    }
    console.log('');
  }

  // 4. Corrigir streak do Atila (nunca fez café mas tem streak)
  console.log('=== CORRIGINDO STREAKS INVÁLIDOS ===');
  const usersWithoutCoffee = await prisma.user.findMany({
    where: {
      coffeeMade: { none: {} }
    }
  });

  for (const u of usersWithoutCoffee) {
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: u.id }
    });
    if (userLevel && userLevel.streak > 0) {
      console.log(`Zerando streak de ${u.username} (tinha ${userLevel.streak}, nunca fez café)`);
      await prisma.userLevel.update({
        where: { userId: u.id },
        data: { streak: 0 }
      });
    }
  }

  console.log('\n✅ Todas as correções aplicadas!');
  
  // Mostrar resultado
  console.log('\n=== RESULTADO FINAL ===');
  for (const username of ['wilmar', 'renan', 'chris']) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
      const achievements = await prisma.achievement.findMany({
        where: { userId: user.id },
        orderBy: { unlockedAt: 'desc' }
      });
      console.log(`\n${username}: ${achievements.length} conquistas`);
      achievements.forEach(a => console.log(`  - ${a.type}: ${a.title}`));
    }
  }

  await prisma.$disconnect();
}

fixAchievements().catch(e => {
  console.error('Erro:', e);
  prisma.$disconnect();
});
