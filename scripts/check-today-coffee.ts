import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkTodayCoffee() {
  console.log('\n☕ VERIFICANDO CAFÉ DE HOJE\n');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayCoffees = await prisma.coffee.findMany({
    where: {
      timestamp: {
        gte: today,
        lt: tomorrow
      }
    },
    orderBy: { timestamp: 'desc' },
    include: {
      maker: true,
      ratings: {
        include: {
          user: true
        }
      }
    }
  });
  
  console.log(`Data de hoje: ${today.toLocaleDateString('pt-BR')}`);
  console.log(`Cafés feitos hoje: ${todayCoffees.length}`);
  
  if (todayCoffees.length === 0) {
    console.log('\n⚠️ NENHUM CAFÉ FOI FEITO HOJE!');
    console.log('   O sistema mostra "Ninguém fez café ainda hoje..."');
    console.log('   As avaliações de cafés de outros dias estão no histórico, não no dashboard principal.');
    
    console.log('\n📅 Últimos cafés feitos:');
    const recentCoffees = await prisma.coffee.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
      include: { maker: true }
    });
    
    for (const c of recentCoffees) {
      console.log(`   - ${c.maker.name}: ${c.timestamp.toLocaleString('pt-BR')}`);
    }
  } else {
    console.log('\n--- Cafés de hoje ---');
    
    for (const coffee of todayCoffees) {
      console.log(`\n☕ Café por ${coffee.maker.name}`);
      console.log(`   ID: ${coffee.id}`);
      console.log(`   Hora: ${coffee.timestamp.toLocaleString('pt-BR')}`);
      console.log(`   Avaliações: ${coffee.ratings.length}`);
      
      for (const r of coffee.ratings) {
        console.log(`      - ${r.user?.name || 'ANÔNIMO'}: ${r.rating} ⭐`);
      }
    }
    
    // Qual será mostrado no dashboard?
    const lastCoffee = todayCoffees[0];
    console.log(`\n🎯 O CAFÉ EXIBIDO NO DASHBOARD é o de ${lastCoffee.maker.name} às ${lastCoffee.timestamp.toLocaleTimeString('pt-BR')}`);
  }
  
  await prisma.$disconnect();
  await pool.end();
}

checkTodayCoffee().catch(console.error);
