/**
 * Script para fazer um teste completo do sistema de ratings
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🔍 ═══════════════════════════════════════════════════');
  console.log('   VERIFICAÇÃO FINAL DO SISTEMA DE RATINGS');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Verificar usuários
  console.log('👥 1. USUÁRIOS CADASTRADOS:');
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true }
  });
  users.forEach(u => console.log(`   - ${u.name} (@${u.username}): ${u.id}`));
  console.log('');

  // 2. Verificar cafés e makers
  console.log('☕ 2. CAFÉS E SEUS MAKERS:');
  const coffees = await prisma.coffee.findMany({
    include: { 
      maker: { select: { name: true, username: true } },
      ratings: { 
        include: { user: { select: { name: true, username: true } } }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  let problemCount = 0;
  
  for (const coffee of coffees) {
    const makerName = coffee.maker?.name || '❌ SEM MAKER';
    const ratingsStr = coffee.ratings.map(r => `${r.user?.name}:${r.rating}⭐`).join(', ') || 'sem avaliações';
    
    // Verificar auto-avaliação
    const autoRating = coffee.ratings.find(r => r.userId === coffee.makerId);
    const status = autoRating ? '❌ AUTO-AVALIAÇÃO!' : '✅';
    
    if (autoRating) problemCount++;
    
    console.log(`   ${status} ${coffee.description?.substring(0, 30) || 'Café'}`);
    console.log(`      Maker: ${makerName} (ID: ${coffee.makerId || 'NULL'})`);
    console.log(`      Ratings: ${ratingsStr}`);
    if (autoRating) {
      console.log(`      ⚠️ PROBLEMA: ${autoRating.user?.name} avaliou seu próprio café!`);
    }
    console.log('');
  }

  // 3. Resumo
  console.log('📊 3. RESUMO:');
  console.log(`   Total de cafés: ${coffees.length}`);
  console.log(`   Cafés sem maker: ${coffees.filter(c => !c.makerId).length}`);
  console.log(`   Auto-avaliações encontradas: ${problemCount}`);
  
  const totalRatings = coffees.reduce((sum, c) => sum + c.ratings.length, 0);
  console.log(`   Total de avaliações: ${totalRatings}`);

  // 4. Estatísticas por usuário
  console.log('\n📈 4. ESTATÍSTICAS POR USUÁRIO:');
  for (const user of users) {
    const coffeeMade = coffees.filter(c => c.makerId === user.id);
    const ratingsReceived = coffeeMade.reduce((sum, c) => sum + c.ratings.length, 0);
    const fiveStarsReceived = coffeeMade.reduce((sum, c) => 
      sum + c.ratings.filter(r => r.rating === 5).length, 0);
    const ratingsGiven = coffees.reduce((sum, c) => 
      sum + c.ratings.filter(r => r.userId === user.id).length, 0);
    
    console.log(`\n   📌 ${user.name} (@${user.username}):`);
    console.log(`      Cafés feitos: ${coffeeMade.length}`);
    console.log(`      Avaliações recebidas: ${ratingsReceived} (${fiveStarsReceived} × 5⭐)`);
    console.log(`      Avaliações dadas: ${ratingsGiven}`);
  }

  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n✅ Verificação concluída!');
  
  if (problemCount > 0) {
    console.log(`\n⚠️ ATENÇÃO: Foram encontrados ${problemCount} problema(s)!`);
    process.exit(1);
  }
}

main().catch(console.error);
