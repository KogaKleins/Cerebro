import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkDuplicateRatings() {
  console.log('\n🔍 VERIFICANDO AVALIAÇÕES DUPLICADAS\n');
  
  const allRatings = await prisma.rating.findMany({
    include: {
      user: true,
      coffee: {
        include: { maker: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // Agrupar por coffeeId + userId
  const grouped: Record<string, typeof allRatings> = {};
  
  for (const r of allRatings) {
    const key = `${r.coffeeId}|${r.userId}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(r);
  }
  
  // Encontrar duplicados
  const duplicates = Object.entries(grouped).filter(([_, ratings]) => ratings.length > 1);
  
  console.log(`Total de avaliações: ${allRatings.length}`);
  console.log(`Combinações user+café únicas: ${Object.keys(grouped).length}`);
  console.log(`Combinações com duplicatas: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log('\n⚠️ AVALIAÇÕES DUPLICADAS ENCONTRADAS:');
    
    for (const [_key, ratings] of duplicates) {
      const first = ratings[0];
      console.log(`\n☕ ${first.coffee.maker.name}'s café - Avaliado por ${first.user.name}`);
      console.log(`   Café ID: ${first.coffeeId}`);
      console.log(`   Duplicatas: ${ratings.length}`);
      
      for (const r of ratings) {
        console.log(`      - ${r.rating}⭐ em ${r.createdAt.toLocaleString('pt-BR')} (ID: ${r.id})`);
      }
      
      // Manter apenas a mais recente
      console.log(`   🔧 Mantendo apenas a avaliação mais recente...`);
      const toDelete = ratings.slice(1); // Manter a primeira (mais recente)
      
      for (const r of toDelete) {
        await prisma.rating.delete({ where: { id: r.id } });
        console.log(`      ✅ Deletado: ${r.id}`);
      }
    }
  } else {
    console.log('\n✅ Nenhuma avaliação duplicada encontrada!');
  }
  
  // Verificar se existe unique constraint na tabela
  console.log('\n📋 VERIFICANDO SE EXISTE UNIQUE CONSTRAINT...');
  try {
    const constraints = await prisma.$queryRaw<{constraint_name: string}[]>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'rating' 
        AND constraint_type = 'UNIQUE'
    `;
    
    if (constraints.length === 0) {
      console.log('⚠️ NENHUM UNIQUE CONSTRAINT ENCONTRADO!');
      console.log('   Isso significa que o sistema permite avaliações duplicadas.');
    } else {
      console.log('Constraints encontrados:', constraints);
    }
  } catch (e) {
    console.log('Erro ao verificar constraints:', e);
  }
  
  await prisma.$disconnect();
  await pool.end();
}

checkDuplicateRatings().catch(console.error);
