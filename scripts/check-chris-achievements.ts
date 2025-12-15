/**
 * Script para verificar conquistas do usuário Chris
 */

import { getPrismaClient } from '../src/repositories';

const prisma = getPrismaClient();

async function checkChris() {
  // Buscar usuário chris
  const chris = await prisma.user.findFirst({
    where: { username: { contains: 'chris', mode: 'insensitive' } }
  });
  
  if (!chris) {
    console.log('❌ Usuário chris não encontrado');
    return;
  }
  
  console.log('=== Usuário Chris ===');
  console.log('ID:', chris.id);
  console.log('Username:', chris.username);
  console.log('Name:', chris.name);
  
  // Buscar cafés do chris
  const coffees = await prisma.coffee.findMany({
    where: { makerId: chris.id },
    include: { ratings: true }
  });
  
  console.log('\n=== Cafés do Chris ===');
  console.log('Total de cafés:', coffees.length);
  
  // Verificar 5 estrelas recebidas
  let totalFiveStars = 0;
  const coffeesWithFiveStars: { id: string; count: number }[] = [];
  
  for (const coffee of coffees) {
    const fiveStars = coffee.ratings.filter(r => r.rating === 5);
    if (fiveStars.length > 0) {
      console.log(`  Café ${coffee.id.substring(0, 8)}... - ${fiveStars.length}x ⭐⭐⭐⭐⭐`);
      totalFiveStars += fiveStars.length;
      coffeesWithFiveStars.push({ id: coffee.id, count: fiveStars.length });
    }
  }
  
  console.log('\n=== Resumo de 5 Estrelas ===');
  console.log('Total de 5 estrelas recebidas:', totalFiveStars);
  console.log('Cafés com 5 estrelas:', coffeesWithFiveStars.length);
  
  // Verificar conquistas relacionadas
  console.log('\n=== Verificação de Conquistas ===');
  
  // Conquista: five-stars (1+ 5 estrelas total)
  if (totalFiveStars >= 1) {
    console.log('✅ Deveria ter: five-stars (Primeira 5 estrelas)');
  }
  
  // Conquista: five-stars-master (10+ 5 estrelas total)
  if (totalFiveStars >= 10) {
    console.log('✅ Deveria ter: five-stars-master (10 avaliações 5 estrelas)');
  }
  
  // Conquista: five-stars-legend (25+ 5 estrelas total)
  if (totalFiveStars >= 25) {
    console.log('✅ Deveria ter: five-stars-legend (25 avaliações 5 estrelas)');
  }
  
  // Conquista: double-rainbow (2+ 5 estrelas no MESMO café)
  const coffeesWithDouble = coffeesWithFiveStars.filter(c => c.count >= 2);
  if (coffeesWithDouble.length > 0) {
    console.log(`✅ Deveria ter: double-rainbow (2+ 5 estrelas mesmo café) - ${coffeesWithDouble.length} café(s)`);
  }
  
  // Conquista: unanimous (5+ 5 estrelas no MESMO café)
  const coffeesWithFive = coffeesWithFiveStars.filter(c => c.count >= 5);
  if (coffeesWithFive.length > 0) {
    console.log(`✅ Deveria ter: unanimous (5+ 5 estrelas mesmo café) - ${coffeesWithFive.length} café(s)`);
  } else {
    console.log('❌ NÃO tem unanimous: nenhum café com 5+ avaliações 5 estrelas');
    console.log('   A conquista "unanimous" requer 5 avaliações 5 estrelas NO MESMO CAFÉ');
  }
  
  // Verificar conquistas atuais do chris
  const achievements = await prisma.achievement.findMany({
    where: { userId: chris.id }
  });
  
  console.log('\n=== Conquistas Atuais do Chris ===');
  if (achievements.length === 0) {
    console.log('(nenhuma conquista)');
  } else {
    const ratingAchievements = achievements.filter(a => 
      ['five-stars', 'five-stars-master', 'five-stars-legend', 'double-rainbow', 'unanimous'].includes(a.type)
    );
    
    if (ratingAchievements.length > 0) {
      console.log('Conquistas de Rating:');
      ratingAchievements.forEach(a => console.log(`  - ${a.type}: ${a.title}`));
    }
    
    const otherAchievements = achievements.filter(a => 
      !['five-stars', 'five-stars-master', 'five-stars-legend', 'double-rainbow', 'unanimous'].includes(a.type)
    );
    
    if (otherAchievements.length > 0) {
      console.log('Outras conquistas:');
      otherAchievements.forEach(a => console.log(`  - ${a.type}: ${a.title}`));
    }
  }
  
  await prisma.$disconnect();
}

checkChris().catch(console.error);
