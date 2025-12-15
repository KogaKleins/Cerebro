/**
 * 🔧 SCRIPT DE RETROATIVAÇÃO DE XP AUDIT LOGS
 * 
 * Este script cria registros de XP Audit para dados históricos
 * que foram criados ANTES da integração do Points Engine.
 * 
 * IMPORTANTE: Execute apenas UMA VEZ!
 * 
 * Execução: npx tsx scripts/backfill-xp-audit.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

// Configurações de XP (valores default, serão sobrescritos pelo banco)
let XP_CONFIG = {
  'coffee-made': 50,
  'coffee-brought': 75,
  'rating-given': 15,
  'five-star-received': 30,
  'four-star-received': 15,
  'message-sent': 1,
  'reaction-given': 3,
  'reaction-received': 5,
  'achievement-common': 25,
  'achievement-rare': 50,
  'achievement-epic': 100,
  'achievement-legendary': 200,
  'achievement-platinum': 500,
};

const ACHIEVEMENT_RARITY: Record<string, string> = {
  'first-coffee': 'common',
  'coffee-lover': 'common',
  'barista-junior': 'rare',
  'barista-senior': 'epic',
  'coffee-master': 'legendary',
  'coffee-legend': 'platinum',
  'coffee-god': 'platinum',
  'first-supply': 'common',
  'supplier': 'common',
  'generous': 'rare',
  'benefactor': 'epic',
  'philanthropist': 'legendary',
  'five-stars': 'common',
  'five-stars-master': 'epic',
  'five-stars-legend': 'legendary',
  'top-rated': 'epic',
  'perfect-score': 'legendary',
  'first-rate': 'common',
  'taste-expert': 'rare',
  'sommelier': 'epic',
  'first-message': 'common',
  'chatterbox': 'common',
  'social-butterfly': 'rare',
  'communicator': 'epic',
  'influencer': 'legendary',
  'early-bird': 'rare',
  'night-owl': 'rare',
  'weekend-warrior': 'rare',
  'monday-hero': 'rare',
  'friday-finisher': 'rare',
};

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('');
  console.log('🔧 ═══════════════════════════════════════════════════════════════');
  console.log('   RETROATIVAÇÃO DE XP AUDIT LOGS');
  console.log('   Criando registros de XP para dados históricos');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Carregar config de XP do banco
  const xpConfigSetting = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });
  
  if (xpConfigSetting?.value) {
    const config = xpConfigSetting.value as Record<string, { xp: number }>;
    for (const [key, value] of Object.entries(config)) {
      if (value && typeof value.xp === 'number') {
        (XP_CONFIG as any)[key] = value.xp;
      }
    }
  }
  
  console.log('📊 Configuração de XP carregada do banco\n');

  let totalCreated = 0;
  let totalSkipped = 0;

  // ═══════════════════════════════════════════════════════════════
  // 1. RETROATIVAR CAFÉS
  // ═══════════════════════════════════════════════════════════════
  console.log('☕ PROCESSANDO CAFÉS...\n');
  
  const coffees = await prisma.coffee.findMany({
    include: { maker: true }
  });

  for (const coffee of coffees) {
    const source = coffee.type === 'MADE' ? 'coffee-made' : 'coffee-brought';
    const sourceIdentifier = `${source}-${coffee.id}`;
    
    // Verificar se já existe
    const existing = await prisma.xPAuditLog.findFirst({
      where: { sourceIdentifier, status: { in: ['pending', 'confirmed'] } }
    });
    
    if (existing) {
      totalSkipped++;
      continue;
    }

    const xpAmount = XP_CONFIG[source];
    
    // Buscar userLevel atual
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: coffee.makerId }
    });
    
    await prisma.xPAuditLog.create({
      data: {
        userId: coffee.makerId,
        username: coffee.maker.username,
        amount: xpAmount,
        reason: source === 'coffee-made' ? 'Fez café (retroativo)' : 'Trouxe café (retroativo)',
        source,
        sourceId: coffee.id,
        sourceIdentifier,
        metadata: { coffeeType: coffee.type, retroactive: true },
        balanceBefore: userLevel?.totalXP || 0,
        balanceAfter: (userLevel?.totalXP || 0) + xpAmount,
        status: 'confirmed',
        timestamp: coffee.timestamp
      }
    });
    totalCreated++;
  }
  
  console.log(`   Cafés processados: ${coffees.length}, Criados: ${totalCreated}, Já existiam: ${totalSkipped}\n`);

  // ═══════════════════════════════════════════════════════════════
  // 2. RETROATIVAR RATINGS
  // ═══════════════════════════════════════════════════════════════
  console.log('⭐ PROCESSANDO AVALIAÇÕES...\n');
  
  const prevCreated = totalCreated;
  const prevSkipped = totalSkipped;
  
  const ratings = await prisma.rating.findMany({
    include: { 
      user: true,
      coffee: { include: { maker: true } }
    }
  });

  for (const rating of ratings) {
    // XP para quem avaliou (rating-given)
    const ratingGivenId = `rating-given-${rating.id}`;
    const existingGiven = await prisma.xPAuditLog.findFirst({
      where: { sourceIdentifier: ratingGivenId, status: { in: ['pending', 'confirmed'] } }
    });
    
    if (!existingGiven) {
      const userLevel = await prisma.userLevel.findUnique({
        where: { userId: rating.userId }
      });
      
      await prisma.xPAuditLog.create({
        data: {
          userId: rating.userId,
          username: rating.user.username,
          amount: XP_CONFIG['rating-given'],
          reason: `Avaliou café com ${rating.rating} estrelas (retroativo)`,
          source: 'rating',
          sourceId: rating.id,
          sourceIdentifier: ratingGivenId,
          metadata: { coffeeId: rating.coffeeId, rating: rating.rating, retroactive: true },
          balanceBefore: userLevel?.totalXP || 0,
          balanceAfter: (userLevel?.totalXP || 0) + XP_CONFIG['rating-given'],
          status: 'confirmed',
          timestamp: rating.createdAt
        }
      });
      totalCreated++;
    } else {
      totalSkipped++;
    }

    // XP para quem recebeu 5 ou 4 estrelas
    if (rating.rating >= 4 && rating.coffee) {
      const source = rating.rating === 5 ? 'five-star-received' : 'four-star-received';
      const receivedId = `${source}-${rating.coffeeId}-${rating.userId}`;
      
      const existingReceived = await prisma.xPAuditLog.findFirst({
        where: { sourceIdentifier: receivedId, status: { in: ['pending', 'confirmed'] } }
      });
      
      if (!existingReceived) {
        const makerLevel = await prisma.userLevel.findUnique({
          where: { userId: rating.coffee.makerId }
        });
        
        const xp = XP_CONFIG[source];
        
        await prisma.xPAuditLog.create({
          data: {
            userId: rating.coffee.makerId,
            username: rating.coffee.maker.username,
            amount: xp,
            reason: `Recebeu ${rating.rating} estrelas no café (retroativo)`,
            source: 'rating',
            sourceId: rating.id,
            sourceIdentifier: receivedId,
            metadata: { coffeeId: rating.coffeeId, rating: rating.rating, ratedBy: rating.userId, retroactive: true },
            balanceBefore: makerLevel?.totalXP || 0,
            balanceAfter: (makerLevel?.totalXP || 0) + xp,
            status: 'confirmed',
            timestamp: rating.createdAt
          }
        });
        totalCreated++;
      } else {
        totalSkipped++;
      }
    }
  }
  
  console.log(`   Ratings processados: ${ratings.length}, Criados: ${totalCreated - prevCreated}, Já existiam: ${totalSkipped - prevSkipped}\n`);

  // ═══════════════════════════════════════════════════════════════
  // 3. RETROATIVAR MENSAGENS
  // ═══════════════════════════════════════════════════════════════
  console.log('💬 PROCESSANDO MENSAGENS...\n');
  
  const prevCreated2 = totalCreated;
  const prevSkipped2 = totalSkipped;
  
  const messages = await prisma.message.findMany({
    include: { author: true }
  });

  for (const msg of messages) {
    const sourceIdentifier = `message-sent-${msg.id}`;
    
    const existing = await prisma.xPAuditLog.findFirst({
      where: { sourceIdentifier, status: { in: ['pending', 'confirmed'] } }
    });
    
    if (existing) {
      totalSkipped++;
      continue;
    }

    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: msg.authorId }
    });
    
    await prisma.xPAuditLog.create({
      data: {
        userId: msg.authorId,
        username: msg.author.username,
        amount: XP_CONFIG['message-sent'],
        reason: 'Enviou mensagem no chat (retroativo)',
        source: 'message',
        sourceId: msg.id,
        sourceIdentifier,
        metadata: { messageId: msg.id, retroactive: true },
        balanceBefore: userLevel?.totalXP || 0,
        balanceAfter: (userLevel?.totalXP || 0) + XP_CONFIG['message-sent'],
        status: 'confirmed',
        timestamp: msg.timestamp
      }
    });
    totalCreated++;
  }
  
  console.log(`   Mensagens processadas: ${messages.length}, Criados: ${totalCreated - prevCreated2}, Já existiam: ${totalSkipped - prevSkipped2}\n`);

  // ═══════════════════════════════════════════════════════════════
  // 4. RETROATIVAR REAÇÕES
  // ═══════════════════════════════════════════════════════════════
  console.log('👍 PROCESSANDO REAÇÕES...\n');
  
  const prevCreated3 = totalCreated;
  const prevSkipped3 = totalSkipped;
  
  const reactions = await prisma.messageReaction.findMany({
    include: { message: { include: { author: true } } }
  });

  for (const reaction of reactions) {
    // XP para quem reagiu
    const givenId = `reaction-given-${reaction.messageId}-${reaction.emoji}-${reaction.userId}`;
    const existingGiven = await prisma.xPAuditLog.findFirst({
      where: { sourceIdentifier: givenId, status: { in: ['pending', 'confirmed'] } }
    });
    
    if (!existingGiven) {
      // Buscar user que reagiu
      const reactor = await prisma.user.findFirst({ where: { id: reaction.userId } });
      const userLevel = await prisma.userLevel.findUnique({ where: { userId: reaction.userId } });
      
      if (reactor) {
        await prisma.xPAuditLog.create({
          data: {
            userId: reaction.userId,
            username: reactor.username,
            amount: XP_CONFIG['reaction-given'],
            reason: `Reagiu a mensagem com ${reaction.emoji} (retroativo)`,
            source: 'rating',
            sourceId: reaction.id,
            sourceIdentifier: givenId,
            metadata: { messageId: reaction.messageId, emoji: reaction.emoji, retroactive: true },
            balanceBefore: userLevel?.totalXP || 0,
            balanceAfter: (userLevel?.totalXP || 0) + XP_CONFIG['reaction-given'],
            status: 'confirmed',
            timestamp: reaction.createdAt
          }
        });
        totalCreated++;
      }
    } else {
      totalSkipped++;
    }

    // XP para autor da mensagem (se diferente)
    if (reaction.message && reaction.userId !== reaction.message.authorId) {
      const receivedId = `reaction-received-${reaction.messageId}-${reaction.emoji}-${reaction.userId}`;
      const existingReceived = await prisma.xPAuditLog.findFirst({
        where: { sourceIdentifier: receivedId, status: { in: ['pending', 'confirmed'] } }
      });
      
      if (!existingReceived) {
        const authorLevel = await prisma.userLevel.findUnique({ where: { userId: reaction.message.authorId } });
        
        await prisma.xPAuditLog.create({
          data: {
            userId: reaction.message.authorId,
            username: reaction.message.author.username,
            amount: XP_CONFIG['reaction-received'],
            reason: `Recebeu reação ${reaction.emoji} (retroativo)`,
            source: 'rating',
            sourceId: reaction.id,
            sourceIdentifier: receivedId,
            metadata: { messageId: reaction.messageId, emoji: reaction.emoji, reactorId: reaction.userId, retroactive: true },
            balanceBefore: authorLevel?.totalXP || 0,
            balanceAfter: (authorLevel?.totalXP || 0) + XP_CONFIG['reaction-received'],
            status: 'confirmed',
            timestamp: reaction.createdAt
          }
        });
        totalCreated++;
      } else {
        totalSkipped++;
      }
    }
  }
  
  console.log(`   Reações processadas: ${reactions.length}, Criados: ${totalCreated - prevCreated3}, Já existiam: ${totalSkipped - prevSkipped3}\n`);

  // ═══════════════════════════════════════════════════════════════
  // 5. RETROATIVAR CONQUISTAS
  // ═══════════════════════════════════════════════════════════════
  console.log('🏆 PROCESSANDO CONQUISTAS...\n');
  
  const prevCreated4 = totalCreated;
  const prevSkipped4 = totalSkipped;
  
  const achievements = await prisma.achievement.findMany({
    include: { user: true }
  });

  for (const ach of achievements) {
    const sourceIdentifier = `achievement-${ach.type}-${ach.userId}`;
    
    const existing = await prisma.xPAuditLog.findFirst({
      where: { sourceIdentifier, status: { in: ['pending', 'confirmed'] } }
    });
    
    if (existing) {
      totalSkipped++;
      continue;
    }

    const rarity = ACHIEVEMENT_RARITY[ach.type] || 'common';
    const xpKey = `achievement-${rarity}` as keyof typeof XP_CONFIG;
    const xpAmount = XP_CONFIG[xpKey] || XP_CONFIG['achievement-common'];
    
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: ach.userId }
    });
    
    await prisma.xPAuditLog.create({
      data: {
        userId: ach.userId,
        username: ach.user.username,
        amount: xpAmount,
        reason: `Desbloqueou conquista: ${ach.title} (${rarity}) - retroativo`,
        source: 'achievement',
        sourceId: ach.id,
        sourceIdentifier,
        metadata: { achievementType: ach.type, rarity, retroactive: true },
        balanceBefore: userLevel?.totalXP || 0,
        balanceAfter: (userLevel?.totalXP || 0) + xpAmount,
        status: 'confirmed',
        timestamp: ach.unlockedAt
      }
    });
    totalCreated++;
  }
  
  console.log(`   Conquistas processadas: ${achievements.length}, Criados: ${totalCreated - prevCreated4}, Já existiam: ${totalSkipped - prevSkipped4}\n`);

  // ═══════════════════════════════════════════════════════════════
  // RESUMO
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📊 ═══════════════════════════════════════════════════════════════');
  console.log('   RESUMO DA RETROATIVAÇÃO');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`   ✅ Total de registros criados: ${totalCreated}`);
  console.log(`   ⏭️ Registros já existentes (pulados): ${totalSkipped}`);

  await prisma.$disconnect();
  await pool.end();

  console.log('\n✅ Retroativação concluída!\n');
}

main().catch(console.error);
