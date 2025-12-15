/**
 * Script para verificar roles de usuários
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('=== Verificando Roles de Usuários ===\n');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true
    }
  });
  
  console.log('Usuários no sistema:');
  users.forEach(u => {
    const isAdmin = u.role === 'ADMIN';
    console.log(`  ${isAdmin ? '👑' : '👤'} ${u.name} (@${u.username}) - ${u.role}`);
  });
  
  const admins = users.filter(u => u.role === 'ADMIN');
  console.log(`\n✅ Total de Admins: ${admins.length}`);
  
  if (admins.length === 0) {
    console.log('\n⚠️  NENHUM ADMIN ENCONTRADO!');
    console.log('Você precisa promover um usuário para ADMIN.');
    console.log('\nPara promover um usuário, execute:');
    console.log('  npx ts-node scripts/promote-admin.ts <username>');
  }
  
  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
