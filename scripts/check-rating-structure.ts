import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkRatingStructure() {
  console.log('\n📊 VERIFICANDO ESTRUTURA DE RATINGS\n');
  
  // Simular o que o endpoint GET /ratings faz
  const coffees = await prisma.coffee.findMany({
    take: 10,
    orderBy: { timestamp: 'desc' },
    include: {
      maker: true,
      ratings: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        }
      }
    }
  });
  
  console.log('Últimos 10 cafés com ratings:');
  
  for (const coffee of coffees) {
    console.log(`\n☕ Café ID: ${coffee.id}`);
    console.log(`   Feito por: ${coffee.maker.name} (ID: ${coffee.makerId})`);
    console.log(`   Data: ${coffee.timestamp.toLocaleString('pt-BR')}`);
    console.log(`   Ratings: ${coffee.ratings.length}`);
    
    for (const r of coffee.ratings) {
      console.log(`      - ${r.user?.name || 'ANÔNIMO'} deu ${r.rating} estrelas`);
    }
  }
  
  // Verificar constraint único
  console.log('\n\n📋 VERIFICANDO CONSTRAINT DE UNICIDADE:\n');
  
  const duplicates = await prisma.$queryRaw`
    SELECT "coffeeId", "userId", COUNT(*) as count
    FROM "Rating"
    GROUP BY "coffeeId", "userId"
    HAVING COUNT(*) > 1
  `;
  
  console.log('Avaliações duplicadas (mesmo user, mesmo café):', duplicates);
  
  await prisma.$disconnect();
  await pool.end();
}

checkRatingStructure().catch(console.error);
