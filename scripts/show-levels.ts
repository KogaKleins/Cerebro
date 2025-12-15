import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const levels = await prisma.userLevel.findMany({
    include: { user: { select: { name: true, username: true } } },
    orderBy: { totalXP: 'desc' }
  });
  
  console.log('\n📊 NÍVEIS ATUAIS DOS USUÁRIOS:');
  console.log('================================');
  for (const l of levels) {
    const name = l.user?.name || 'N/A';
    console.log(`${name}: ${l.totalXP} XP, Nível ${l.level}`);
  }
  
  await prisma.$disconnect();
  process.exit(0);
}

main();
