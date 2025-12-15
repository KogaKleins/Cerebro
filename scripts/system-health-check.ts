import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function systemHealthCheck() {
  console.log('\n🏥 VERIFICAÇÃO DE SAÚDE DO SISTEMA\n');
  console.log('=' .repeat(60));
  
  // 1. Verificar usuários e níveis
  console.log('\n👥 USUÁRIOS E NÍVEIS:');
  const users = await prisma.userLevel.findMany({
    include: { user: { select: { name: true } } },
    orderBy: { totalXP: 'desc' }
  });
  
  for (const u of users) {
    console.log(`   ${u.user.name}: Nível ${u.level} (${u.totalXP} XP total)`);
  }
  
  // 2. Café de hoje
  console.log('\n☕ CAFÉ DE HOJE:');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayCoffees = await prisma.coffee.findMany({
    where: { timestamp: { gte: today, lt: tomorrow } },
    include: { 
      maker: true,
      ratings: { include: { user: true } }
    },
    orderBy: { timestamp: 'desc' }
  });
  
  if (todayCoffees.length === 0) {
    console.log('   ⚠️ Nenhum café feito hoje');
  } else {
    for (const c of todayCoffees) {
      console.log(`   ☕ ${c.maker.name} às ${c.timestamp.toLocaleTimeString('pt-BR')}`);
      console.log(`      Avaliações: ${c.ratings.length}`);
      for (const r of c.ratings) {
        console.log(`         - ${r.user.name}: ${r.rating}⭐`);
      }
    }
  }
  
  // 3. Auto-avaliações
  console.log('\n🔍 VERIFICANDO AUTO-AVALIAÇÕES:');
  const allRatings = await prisma.rating.findMany({
    include: { user: true, coffee: { include: { maker: true } } }
  });
  const selfRatings = allRatings.filter(r => r.userId === r.coffee.makerId);
  
  if (selfRatings.length === 0) {
    console.log('   ✅ Nenhuma auto-avaliação encontrada');
  } else {
    console.log(`   ⚠️ ${selfRatings.length} auto-avaliações encontradas`);
    selfRatings.forEach(r => console.log(`      - ${r.user.name} avaliou próprio café`));
  }
  
  // 4. Avaliações duplicadas
  console.log('\n🔄 VERIFICANDO DUPLICATAS:');
  const grouped: Record<string, number> = {};
  for (const r of allRatings) {
    const key = `${r.coffeeId}|${r.userId}`;
    grouped[key] = (grouped[key] || 0) + 1;
  }
  const duplicates = Object.entries(grouped).filter(([_, count]) => count > 1);
  
  if (duplicates.length === 0) {
    console.log('   ✅ Nenhuma avaliação duplicada');
  } else {
    console.log(`   ⚠️ ${duplicates.length} combinações com duplicatas`);
  }
  
  // 5. Total de avaliações por usuário
  console.log('\n📊 AVALIAÇÕES POR USUÁRIO:');
  const ratingsByUser: Record<string, number> = {};
  for (const r of allRatings) {
    const name = r.user.name;
    ratingsByUser[name] = (ratingsByUser[name] || 0) + 1;
  }
  
  for (const [name, count] of Object.entries(ratingsByUser).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${name}: ${count} avaliações`);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ VERIFICAÇÃO COMPLETA\n');
  
  await prisma.$disconnect();
  await pool.end();
}

systemHealthCheck().catch(console.error);
