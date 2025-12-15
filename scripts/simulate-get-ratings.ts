import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function simulateGetRatingsEndpoint() {
  console.log('\n📊 SIMULANDO ENDPOINT GET /ratings\n');
  
  // Código exato do endpoint legacy.routes.ts
  const coffees = await prisma.coffee.findMany({
    take: 100,
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
  
  const ratingsObj: Record<string, any> = {};
  
  for (const coffee of coffees) {
    if (coffee.ratings && coffee.ratings.length > 0) {
      const totalStars = coffee.ratings.reduce((sum, r) => sum + r.rating, 0);
      ratingsObj[coffee.id] = {
        coffeeId: coffee.id,
        makerName: coffee.maker.name,
        totalStars,
        raters: coffee.ratings.map(r => ({
          name: (r as any).user?.name || 'Anônimo',
          stars: r.rating
        })),
        average: totalStars / coffee.ratings.length
      };
    }
  }
  
  console.log('Resposta JSON (como frontend receberia):');
  console.log(JSON.stringify(ratingsObj, null, 2));
  
  // Verificar se as avaliações estão sendo retornadas corretamente
  console.log('\n\n📋 RESUMO:');
  console.log(`Total de cafés com avaliações: ${Object.keys(ratingsObj).length}`);
  
  for (const coffeeId in ratingsObj) {
    const r = ratingsObj[coffeeId];
    console.log(`\n☕ ${r.makerName} (${coffeeId.substring(0, 8)}...)`);
    console.log(`   Média: ${r.average.toFixed(2)} ⭐ (${r.raters.length} avaliações)`);
    r.raters.forEach((rater: any) => {
      console.log(`   - ${rater.name}: ${rater.stars}⭐`);
    });
  }
  
  await prisma.$disconnect();
  await pool.end();
}

simulateGetRatingsEndpoint().catch(console.error);
