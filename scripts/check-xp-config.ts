/**
 * Script para verificar configuração de XP no banco
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function checkXPConfig() {
  console.log('========================================');
  console.log('CONFIGURACAO DE XP NO BANCO');
  console.log('========================================\n');

  const setting = await prisma.setting.findUnique({
    where: { key: 'xp-config' }
  });
  
  if (!setting || !setting.value) {
    console.log('NENHUMA CONFIGURACAO DE XP ENCONTRADA!');
    console.log('Usando valores padrao do sistema.');
  } else {
    console.log('Configuracao atual:');
    console.log(JSON.stringify(setting.value, null, 2));
  }

  await prisma.$disconnect();
  await pool.end();
}

checkXPConfig().catch(console.error);
