import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkIndexes() {
  console.log('\n📋 VERIFICANDO ÍNDICES E CONSTRAINTS DA TABELA RATINGS\n');
  
  // Verificar índices
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'ratings'
  `;
  console.log('Índices:', indexes);
  
  // Verificar constraints
  const constraints = await prisma.$queryRaw`
    SELECT conname, contype, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'ratings'::regclass
  `;
  console.log('Constraints:', constraints);
  
  await prisma.$disconnect();
  await pool.end();
}

checkIndexes().catch(console.error);
