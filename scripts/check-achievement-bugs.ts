/**
 * Script para investigar bugs nas conquistas
 */
import { getPrismaClient } from '../src/repositories';

const prisma = getPrismaClient();

async function checkBugs() {
  console.log('🔍 Investigando bugs nas conquistas...\n');

  // Buscar usuários relevantes
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: 'renan', mode: 'insensitive' } },
        { username: { contains: 'christian', mode: 'insensitive' } },
        { username: { contains: 'chris', mode: 'insensitive' } },
        { username: { contains: 'wilmar', mode: 'insensitive' } }
      ]
    }
  });

  console.log('=== USUÁRIOS ENCONTRADOS ===');
  users.forEach(u => console.log(`  - ${u.username} (${u.name}) - ID: ${u.id}`));
  console.log('');

  for (const user of users) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 ${user.username} (${user.name})`);
    console.log('='.repeat(60));

    // Cafés
    const coffees = await prisma.coffee.findMany({
      where: { makerId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 10
    });
    
    console.log(`\n☕ CAFÉS: ${coffees.length} (últimos 10)`);
    coffees.forEach(c => {
      const d = new Date(c.timestamp);
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      console.log(`  - ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR')} (${dayNames[d.getDay()]}, hora: ${d.getHours()})`);
    });

    // Total de cafés
    const totalCoffees = await prisma.coffee.count({
      where: { makerId: user.id }
    });
    console.log(`  Total de cafés: ${totalCoffees}`);

    // Conquistas
    const achievements = await prisma.achievement.findMany({
      where: { userId: user.id },
      orderBy: { unlockedAt: 'desc' }
    });
    
    console.log(`\n🏆 CONQUISTAS: ${achievements.length}`);
    achievements.forEach(a => {
      console.log(`  - ${a.type}: ${a.title} (${a.unlockedAt?.toLocaleDateString('pt-BR')})`);
    });

    // Mensagens
    const msgCount = await prisma.message.count({
      where: { authorId: user.id, deletedAt: null }
    });
    console.log(`\n💬 MENSAGENS: ${msgCount}`);

    // Verificar se tem conquista de mensagens
    const hasChatterbox = achievements.some(a => a.type === 'chatterbox');
    const hasFirstMessage = achievements.some(a => a.type === 'first-message');
    
    if (msgCount >= 1 && !hasFirstMessage) {
      console.log(`  ⚠️ BUG: Tem ${msgCount} mensagens mas NÃO tem 'first-message'`);
    }
    if (msgCount >= 50 && !hasChatterbox) {
      console.log(`  ⚠️ BUG: Tem ${msgCount} mensagens mas NÃO tem 'chatterbox' (50 msgs)`);
    }

    // Verificar conquistas de café
    const hasFirstCoffee = achievements.some(a => a.type === 'first-coffee');
    if (totalCoffees >= 1 && !hasFirstCoffee) {
      console.log(`  ⚠️ BUG: Tem ${totalCoffees} cafés mas NÃO tem 'first-coffee'`);
    }

    // Verificar friday-finisher
    const hasFridayFinisher = achievements.some(a => a.type === 'friday-finisher');
    const fridayCoffees = coffees.filter(c => {
      const d = new Date(c.timestamp);
      return d.getDay() === 5 && d.getHours() >= 14;
    });
    if (fridayCoffees.length > 0 && !hasFridayFinisher) {
      console.log(`  ⚠️ BUG: Fez café na sexta após 14h mas NÃO tem 'friday-finisher'`);
      console.log(`    Cafés na sexta após 14h: ${fridayCoffees.length}`);
    }

    // Verificar early-bird
    const hasEarlyBird = achievements.some(a => a.type === 'early-bird');
    const earlyCoffees = coffees.filter(c => {
      const d = new Date(c.timestamp);
      return d.getHours() < 7;
    });
    if (earlyCoffees.length > 0 && !hasEarlyBird) {
      console.log(`  ⚠️ BUG: Fez café antes das 7h mas NÃO tem 'early-bird'`);
    }
  }

  console.log('\n\n🔍 Verificando streak de quem nunca fez café...\n');
  
  // Buscar usuários sem café
  const usersWithoutCoffee = await prisma.user.findMany({
    where: {
      coffeeMade: {
        none: {}
      }
    }
  });

  console.log(`Usuários sem café: ${usersWithoutCoffee.length}`);
  for (const u of usersWithoutCoffee.slice(0, 10)) {
    const userLevel = await prisma.userLevel.findUnique({
      where: { userId: u.id }
    });
    if (userLevel && userLevel.streak > 0) {
      console.log(`  ⚠️ BUG: ${u.username} nunca fez café mas tem streak de ${userLevel.streak}`);
    }
  }

  await prisma.$disconnect();
}

checkBugs().catch(e => {
  console.error('Erro:', e);
  prisma.$disconnect();
});
