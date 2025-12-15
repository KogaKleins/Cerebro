/**
 * 🔧 CORREÇÃO DE CONQUISTAS INDEVIDAS
 * 
 * Este script remove conquistas que foram dadas incorretamente devido ao bug
 * onde findByMaker não filtrava por tipo de café (MADE vs BROUGHT).
 * 
 * CAUSA RAIZ DO BUG:
 * - O método findByMaker() retornava TODOS os cafés (MADE + BROUGHT)
 * - Conquistas de horário (early-bird, friday-finisher, etc.) devem ser
 *   apenas para cafés FEITOS (MADE), não TRAZIDOS (BROUGHT)
 * - Resultado: usuários que apenas TROUXERAM café em horários especiais
 *   receberam conquistas indevidamente
 * 
 * CORREÇÃO APLICADA:
 * - Criado método findMadeByMaker() que filtra apenas type='MADE'
 * - Corrigido checkSpecialTimeAchievements() e checkStreakAchievements()
 * - Corrigido achievement.routes.ts
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface AchievementToRemove {
  userId: string;
  username: string;
  type: string;
  title: string;
  reason: string;
  skip?: boolean;
  skipReason?: string;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);
  
  console.log('═'.repeat(70));
  console.log('🔧 CORREÇÃO DE CONQUISTAS INDEVIDAS');
  console.log('═'.repeat(70));
  console.log('\n📋 CAUSA RAIZ DO BUG:');
  console.log('   O método findByMaker() retornava TODOS os cafés (MADE + BROUGHT)');
  console.log('   Conquistas de horário devem ser apenas para cafés FEITOS (MADE)');
  console.log('   Resultado: quem TROUXE café em horários especiais ganhou conquistas\n');
  
  const toRemove: AchievementToRemove[] = [];
  
  // Buscar todos os usuários
  const users = await prisma.user.findMany({});
  
  for (const user of users) {
    // Buscar cafés FEITOS
    const cafesMade = await prisma.coffee.findMany({ 
      where: { makerId: user.id, type: 'MADE' }
    });
    
    // Buscar conquistas
    const achievements = await prisma.achievement.findMany({ 
      where: { userId: user.id }
    });
    
    // Verificar conquistas de horário especial
    const hasEarlyCoffee = cafesMade.some(c => c.timestamp.getHours() < 7);
    const hasFridayCoffee = cafesMade.some(c => c.timestamp.getDay() === 5 && c.timestamp.getHours() >= 14);
    const hasLateCoffee = cafesMade.some(c => c.timestamp.getHours() >= 20);
    const hasWeekendCoffee = cafesMade.some(c => [0, 6].includes(c.timestamp.getDay()));
    const hasMondayCoffee = cafesMade.some(c => c.timestamp.getDay() === 1 && c.timestamp.getHours() < 10);
    
    const timeAchievements = [
      { type: 'early-bird', title: 'Madrugador', qualifies: hasEarlyCoffee },
      { type: 'friday-finisher', title: 'Finalizador da Sexta', qualifies: hasFridayCoffee },
      { type: 'night-owl', title: 'Coruja Noturna', qualifies: hasLateCoffee },
      { type: 'weekend-warrior', title: 'Guerreiro de Fim de Semana', qualifies: hasWeekendCoffee },
      { type: 'monday-hero', title: 'Herói de Segunda', qualifies: hasMondayCoffee },
    ];
    
    for (const ach of timeAchievements) {
      const hasAch = achievements.some(a => a.type === ach.type);
      
      if (hasAch && !ach.qualifies) {
        // Caso especial: Chris tem early-bird dado manualmente (sistema estava bugado na época)
        if (user.username === 'chris' && ach.type === 'early-bird') {
          toRemove.push({
            userId: user.id,
            username: user.username,
            type: ach.type,
            title: ach.title,
            reason: 'Nenhum café FEITO nesse horário (apenas TRAZIDO)',
            skip: true,
            skipReason: 'MANTIDA: Chris realmente fez café antes das 7h, mas o sistema estava bugado na época e não deu automaticamente. Foi dada manualmente.'
          });
        } else {
          toRemove.push({
            userId: user.id,
            username: user.username,
            type: ach.type,
            title: ach.title,
            reason: 'Nenhum café FEITO nesse horário (apenas TRAZIDO)',
          });
        }
      }
    }
  }
  
  // Relatório
  console.log('═'.repeat(70));
  console.log('📋 CONQUISTAS IDENTIFICADAS PARA ANÁLISE');
  console.log('═'.repeat(70));
  
  if (toRemove.length === 0) {
    console.log('\n✅ Nenhuma conquista indevida encontrada!');
  } else {
    // Separar as que serão removidas das que serão mantidas
    const willRemove = toRemove.filter(a => !a.skip);
    const willKeep = toRemove.filter(a => a.skip);
    
    if (willKeep.length > 0) {
      console.log('\n📌 CONQUISTAS QUE SERÃO MANTIDAS:');
      for (const ach of willKeep) {
        console.log(`\n   👤 ${ach.username}:`);
        console.log(`      [${ach.type}] ${ach.title}`);
        console.log(`      ℹ️  ${ach.skipReason}`);
      }
    }
    
    if (willRemove.length > 0) {
      console.log('\n🗑️  CONQUISTAS QUE SERÃO REMOVIDAS:');
      for (const ach of willRemove) {
        console.log(`\n   👤 ${ach.username}:`);
        console.log(`      [${ach.type}] ${ach.title}`);
        console.log(`      ❌ ${ach.reason}`);
      }
      
      // Confirmar remoção
      console.log('\n' + '═'.repeat(70));
      console.log('⚠️  EXECUTANDO REMOÇÃO...');
      console.log('═'.repeat(70));
      
      for (const ach of willRemove) {
        try {
          const result = await prisma.achievement.deleteMany({
            where: { 
              userId: ach.userId, 
              type: ach.type 
            }
          });
          
          if (result.count > 0) {
            console.log(`   ✅ Removida: ${ach.username} → ${ach.type}`);
            
            // Também remover o XP que foi dado pela conquista (se houver log)
            const xpLogs = await prisma.xPAuditLog.findMany({
              where: {
                userId: ach.userId,
                source: 'achievement',
                reason: { contains: ach.type }
              }
            });
            
            if (xpLogs.length > 0) {
              console.log(`      ⚠️  Encontrados ${xpLogs.length} logs de XP relacionados`);
              // TODO: Reverter XP se necessário
            }
          }
        } catch (error) {
          console.log(`   ❌ Erro ao remover: ${ach.username} → ${ach.type}`);
          console.log(`      ${error}`);
        }
      }
    }
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ CORREÇÃO CONCLUÍDA');
  console.log('═'.repeat(70));
  console.log('\n📝 RESUMO:');
  console.log(`   Total analisadas: ${toRemove.length}`);
  console.log(`   Mantidas: ${toRemove.filter(a => a.skip).length}`);
  console.log(`   Removidas: ${toRemove.filter(a => !a.skip).length}`);
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
