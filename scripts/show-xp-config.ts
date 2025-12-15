/**
 * Script para verificar as configurações de XP no banco
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

  console.log('📊 CONFIGURAÇÕES DO BANCO:\n');
  
  // Buscar todas as settings
  const allSettings = await prisma.setting.findMany();
  
  for (const s of allSettings) {
    console.log(`\n=== ${s.key} ===`);
    console.log(JSON.stringify(s.value, null, 2));
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
