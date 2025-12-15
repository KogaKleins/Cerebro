import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkRatings() {
  console.log('\n📊 VERIFICANDO AVALIAÇÕES NO BANCO\n');
  
  const ratings = await prisma.rating.findMany({
    include: {
      user: { select: { name: true, username: true } },
      coffee: { 
        include: { 
          maker: { select: { name: true } } 
        } 
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('Total de avaliações encontradas:', ratings.length);
  
  if (ratings.length === 0) {
    console.log('\n⚠️ NENHUMA AVALIAÇÃO ENCONTRADA NO BANCO!');
    console.log('   Isso significa que as avaliações não estão sendo salvas.');
  } else {
    console.log('\n--- Últimas avaliações ---');
    
    for (const r of ratings) {
      const date = r.createdAt.toLocaleString('pt-BR');
      console.log(`[${date}] ${r.user.name} avaliou café de ${r.coffee.maker.name}: ${r.rating} estrelas`);
    }
  }
  
  // Verificar estrutura da tabela
  console.log('\n📋 Verificando tabela Rating:');
  const tableInfo = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Rating'
  `;
  console.log('Estrutura:', tableInfo);
  
  await prisma.$disconnect();
  await pool.end();
}

checkRatings().catch(console.error);
