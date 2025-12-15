/**
 * 🔧 Correção de Conquistas de Mensagem
 * 
 * Este script:
 * 1. Verifica todos os usuários com mensagens suficientes para conquistas
 * 2. Desbloqueia conquistas faltando
 * 
 * USO:
 * npx ts-node scripts/fix-message-achievements.ts
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

async function fixMessageAchievements() {
  try {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🔧 CORREÇÃO DE CONQUISTAS DE MENSAGEM');
    console.log('═══════════════════════════════════════════════════════════\n');

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

    // Buscar todos os usuários
    const users = await prisma.user.findMany();
    let fixedCount = 0;

    for (const user of users) {
      // Contar mensagens não deletadas
      const msgCount = await prisma.message.count({
        where: { authorId: user.id, deletedAt: null }
      });

      // Conquistas atuais
      const achievements = await prisma.achievement.findMany({
        where: { userId: user.id },
        select: { type: true }
      });
      const achievementTypes = achievements.map(a => a.type);

      // Verificar conquistas que deveriam ter
      const shouldHave: string[] = [];
      
      if (msgCount >= 1 && !achievementTypes.includes('first-message')) {
        shouldHave.push('first-message');
      }
      if (msgCount >= 50 && !achievementTypes.includes('chatterbox')) {
        shouldHave.push('chatterbox');
      }
      if (msgCount >= 200 && !achievementTypes.includes('social-butterfly')) {
        shouldHave.push('social-butterfly');
      }
      if (msgCount >= 500 && !achievementTypes.includes('communicator')) {
        shouldHave.push('communicator');
      }
      if (msgCount >= 1000 && !achievementTypes.includes('influencer')) {
        shouldHave.push('influencer');
      }

      if (shouldHave.length > 0) {
        console.log(`\n📧 ${user.username}: ${msgCount} mensagens`);
        console.log(`   Conquistas faltando: ${shouldHave.join(', ')}`);
        
        // Verificar conquistas
        await achievementService.checkMessageAchievements(user.id, msgCount);
        
        // Verificar se foram criadas
        const afterAchievements = await prisma.achievement.findMany({
          where: { userId: user.id, type: { in: shouldHave } },
          select: { type: true, title: true }
        });
        
        if (afterAchievements.length > 0) {
          console.log(`   ✅ Desbloqueadas: ${afterAchievements.map(a => `${a.type} (${a.title})`).join(', ')}`);
          fixedCount += afterAchievements.length;
        } else {
          console.log(`   ⚠️ Nenhuma conquista foi desbloqueada - verificando problema...`);
        }
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`✅ Correção concluída: ${fixedCount} conquistas desbloqueadas`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fixMessageAchievements();
