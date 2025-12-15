/**
 * Investigar bug do Chris - weekend-warrior indevida
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter, log: ['error'] });

async function investigate() {
  try {
    const chris = await prisma.user.findUnique({ where: { username: 'chris' } });
    if (!chris) {
      console.log('Chris não encontrado');
      return;
    }

    console.log('=== INVESTIGAÇÃO CHRIS - WEEKEND-WARRIOR ===\n');

    // 1. Todos os cafés do Chris
    console.log('1. TODOS OS CAFÉS DO CHRIS:');
    const allCoffees = await prisma.coffee.findMany({
      where: { makerId: chris.id },
      orderBy: { timestamp: 'desc' }
    });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
    
    allCoffees.forEach(c => {
      const date = new Date(c.timestamp);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const marker = isWeekend ? ' <<< FIM DE SEMANA' : '';
      console.log(`  ${date.toLocaleString('pt-BR')} | ${dayNames[dayOfWeek]} | ${c.type}${marker}`);
    });

    // 2. Cafés FEITOS (MADE) pelo Chris
    console.log('\n2. CAFÉS FEITOS (MADE) PELO CHRIS:');
    const madeCoffees = allCoffees.filter(c => c.type === 'MADE');
    
    if (madeCoffees.length === 0) {
      console.log('  >>> Chris NÃO TEM cafés FEITOS!');
    } else {
      madeCoffees.forEach(c => {
        const date = new Date(c.timestamp);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const marker = isWeekend ? ' <<< FIM DE SEMANA' : '';
        console.log(`  ${date.toLocaleString('pt-BR')} | ${dayNames[dayOfWeek]}${marker}`);
      });
    }

    // 3. Chris tem café FEITO no fim de semana?
    console.log('\n3. CHRIS TEM CAFÉ FEITO NO FIM DE SEMANA?');
    const weekendMade = madeCoffees.filter(c => {
      const day = new Date(c.timestamp).getDay();
      return day === 0 || day === 6;
    });
    
    if (weekendMade.length === 0) {
      console.log('  >>> NÃO! Chris NÃO tem café FEITO no fim de semana!');
      console.log('  >>> BUG CONFIRMADO: weekend-warrior foi desbloqueada indevidamente!');
    } else {
      console.log(`  >>> SIM! ${weekendMade.length} café(s) feito(s) no fim de semana`);
    }

    // 4. Verificar conquista weekend-warrior
    console.log('\n4. CONQUISTA WEEKEND-WARRIOR DO CHRIS:');
    const achievement = await prisma.achievement.findUnique({
      where: { userId_type: { userId: chris.id, type: 'weekend-warrior' } }
    });

    if (achievement) {
      console.log(`  >>> EXISTE! Desbloqueada em: ${achievement.unlockedAt.toLocaleString('pt-BR')}`);
    } else {
      console.log('  >>> NÃO existe');
    }

    // 5. Verificar se o bug está na lógica
    console.log('\n5. ANÁLISE DO BUG:');
    console.log('  - A rota /coffee-brought chama checkSpecialTimeAchievements SEM passar data');
    console.log('  - Quando não tem data, o código busca histórico de cafés FEITOS (findMadeByMaker)');
    console.log('  - Se Chris não tem café FEITO no fim de semana, é um BUG GRAVE!');

    // 6. Verificar monday-hero também
    console.log('\n6. CONQUISTA MONDAY-HERO DO CHRIS:');
    const mondayHero = await prisma.achievement.findUnique({
      where: { userId_type: { userId: chris.id, type: 'monday-hero' } }
    });
    
    if (mondayHero) {
      console.log(`  >>> EXISTE! Desbloqueada em: ${mondayHero.unlockedAt.toLocaleString('pt-BR')}`);
      
      // Verificar se ele tem café FEITO na segunda antes das 10h
      const mondayMade = madeCoffees.filter(c => {
        const date = new Date(c.timestamp);
        return date.getDay() === 1 && date.getHours() < 10;
      });
      
      if (mondayMade.length === 0) {
        console.log('  >>> BUG: Não tem café FEITO na segunda antes das 10h!');
      } else {
        console.log(`  >>> OK: Tem ${mondayMade.length} café(s) feito(s) na segunda de manhã`);
      }
    }

    // 7. Verificar café de hoje
    console.log('\n7. CAFÉS DE HOJE (15/12 - Segunda):');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCoffees = allCoffees.filter(c => new Date(c.timestamp) >= today);
    todayCoffees.forEach(c => {
      const date = new Date(c.timestamp);
      console.log(`  ${date.toLocaleString('pt-BR')} | ${c.type}`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

investigate();
