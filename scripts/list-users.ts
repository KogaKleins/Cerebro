/**
 * Lista todos os usuários
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany();
  console.log('Usuários no sistema:');
  users.forEach(u => console.log(`  - ${u.username} (${u.name})`));
  await prisma.$disconnect();
}

main();
