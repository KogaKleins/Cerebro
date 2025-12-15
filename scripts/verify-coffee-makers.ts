/**
 * Script para verificar se ainda existem cafés sem makerId
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

  console.log('🔍 Verificando todos os cafés...\n');

  const allCoffees = await prisma.coffee.findMany({
    include: { 
      maker: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Total de cafés: ${allCoffees.length}\n`);
  
  let orphanCount = 0;
  
  for (const coffee of allCoffees) {
    const makerName = coffee.maker?.name || '❌ SEM MAKER';
    const isOrphan = !coffee.makerId;
    
    if (isOrphan) {
      orphanCount++;
      console.log(`❌ ${coffee.id} - makerId: ${coffee.makerId} - ${makerName}`);
    } else {
      console.log(`✅ ${coffee.id} - ${makerName}`);
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   Total de cafés: ${allCoffees.length}`);
  console.log(`   Cafés sem maker: ${orphanCount}`);
  console.log(`   Cafés com maker: ${allCoffees.length - orphanCount}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
