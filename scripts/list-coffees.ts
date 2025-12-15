/**
 * Verificar detalhes dos cafés
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter, log: ['error'] });

async function listCoffees() {
  try {
    console.log('\n=== TODOS OS CAFES (ordenados por data) ===\n');
    
    const coffees = await prisma.coffee.findMany({
      orderBy: { timestamp: 'desc' },
      include: { maker: { select: { username: true } } }
    });
    
    coffees.forEach(c => {
      const date = new Date(c.timestamp);
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const marker = isWeekend ? ' <<< FIM DE SEMANA' : '';
      
      console.log(`${date.toISOString()} | ${date.toLocaleString('pt-BR')} | ${dayNames[dayOfWeek]} | ${c.maker?.username} | ${c.type}${marker}`);
    });
    
    console.log(`\nTotal: ${coffees.length} cafes`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

listCoffees();
