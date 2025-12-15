import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('== LOGS DE XP POR MENSAGEM (POR USUÁRIO) ==\n');

  const users = await prisma.user.findMany({ select: { id: true, username: true, name: true } });

  for (const u of users) {
    const count = await prisma.xPAuditLog.count({
      where: { userId: u.id, source: 'message', status: 'confirmed' }
    });
    if (count > 0) {
      console.log(`${u.name || u.username}: ${count} logs de mensagem`);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main();
