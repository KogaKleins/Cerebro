import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkSelfRatings() {
  console.log('\n🔍 VERIFICANDO AUTO-AVALIAÇÕES\n');
  
  const allRatings = await prisma.rating.findMany({
    include: {
      user: true,
      coffee: {
        include: { maker: true }
      }
    }
  });
  
  const selfRatings = allRatings.filter(r => r.userId === r.coffee.makerId);
  
  console.log(`Total de avaliações: ${allRatings.length}`);
  console.log(`Auto-avaliações encontradas: ${selfRatings.length}`);
  
  if (selfRatings.length > 0) {
    console.log('\n⚠️ AUTO-AVALIAÇÕES:');
    for (const r of selfRatings) {
      console.log(`  - ${r.user.name} se auto-avaliou em ${r.createdAt.toLocaleString('pt-BR')} (${r.rating}⭐)`);
      console.log(`    ID: ${r.id}`);
    }
    
    // Deletar auto-avaliações
    console.log('\n🗑️ Deletando auto-avaliações...');
    for (const r of selfRatings) {
      await prisma.rating.delete({ where: { id: r.id } });
      console.log(`   ✅ Deletado rating ${r.id}`);
    }
  } else {
    console.log('\n✅ Nenhuma auto-avaliação encontrada!');
  }
  
  await prisma.$disconnect();
  await pool.end();
}

checkSelfRatings().catch(console.error);
