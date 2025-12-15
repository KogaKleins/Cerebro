/**
 * Testar findMadeByMaker diretamente
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter, log: ['query'] });

async function test() {
  try {
    const chris = await prisma.user.findUnique({ where: { username: 'chris' } });
    if (!chris) {
      console.log('Chris não encontrado');
      return;
    }

    console.log('=== TESTANDO findMadeByMaker ===\n');
    console.log('Chris ID:', chris.id);

    // Simular findMadeByMaker
    console.log('\n1. Query com type=MADE:');
    const madeCoffees = await prisma.coffee.findMany({
      where: { 
        makerId: chris.id,
        type: 'MADE'
      },
      take: 1000,
      orderBy: { timestamp: 'desc' }
    });

    console.log(`\nEncontrados ${madeCoffees.length} cafés FEITOS:`);
    madeCoffees.forEach(c => {
      const date = new Date(c.timestamp);
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      console.log(`  ${date.toLocaleString('pt-BR')} | ${dayNames[dayOfWeek]} | ${c.type}${isWeekend ? ' <<< FIM DE SEMANA' : ''}`);
    });

    // 2. Verificar se algum é fim de semana
    console.log('\n2. Cafés FEITOS no fim de semana:');
    const weekendMade = madeCoffees.filter(c => {
      const day = new Date(c.timestamp).getDay();
      return day === 0 || day === 6;
    });
    
    if (weekendMade.length === 0) {
      console.log('  >>> NENHUM! Chris NÃO tem café FEITO no fim de semana!');
    } else {
      console.log(`  >>> ${weekendMade.length} café(s)`);
      weekendMade.forEach(c => console.log(`     ${new Date(c.timestamp).toLocaleString('pt-BR')}`));
    }

    // 3. Todos os cafés (sem filtro de type)
    console.log('\n3. TODOS os cafés do Chris (sem filtro):');
    const allCoffees = await prisma.coffee.findMany({
      where: { makerId: chris.id },
      orderBy: { timestamp: 'desc' }
    });
    
    console.log(`Encontrados ${allCoffees.length} cafés total:`);
    allCoffees.forEach(c => {
      const date = new Date(c.timestamp);
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      console.log(`  ${date.toLocaleString('pt-BR')} | ${dayNames[dayOfWeek]} | ${c.type}${isWeekend ? ' <<< FIM DE SEMANA' : ''}`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

test();
