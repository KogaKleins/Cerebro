/**
 * Remover conquistas indevidas do Chris
 * - weekend-warrior: Não tem café FEITO no fim de semana
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter, log: ['error'] });

async function fix() {
  try {
    const chris = await prisma.user.findUnique({ where: { username: 'chris' } });
    if (!chris) {
      console.log('Chris não encontrado');
      return;
    }

    console.log('=== REMOVENDO CONQUISTAS INDEVIDAS DO CHRIS ===\n');

    // 1. Verificar se Chris tem café FEITO no fim de semana
    const madeCoffees = await prisma.coffee.findMany({
      where: { makerId: chris.id, type: 'MADE' }
    });

    const weekendMade = madeCoffees.filter(c => {
      const day = new Date(c.timestamp).getDay();
      return day === 0 || day === 6;
    });

    console.log(`Chris tem ${weekendMade.length} café(s) FEITO(s) no fim de semana`);

    if (weekendMade.length === 0) {
      // Remover weekend-warrior
      const deleted = await prisma.achievement.deleteMany({
        where: { userId: chris.id, type: 'weekend-warrior' }
      });
      console.log(`\n✅ Removida conquista weekend-warrior (${deleted.count} registro)`);

      // Buscar nível do usuário
      const userLevel = await prisma.userLevel.findUnique({
        where: { userId: chris.id }
      });

      if (userLevel) {
        // Remover 500 XP (valor de conquista rare)
        const xpToRemove = 500;
        const newXp = userLevel.xp - xpToRemove;
        
        await prisma.userLevel.update({
          where: { userId: chris.id },
          data: { xp: newXp }
        });
        console.log(`✅ XP atualizado: ${userLevel.xp} -> ${newXp}`);
        
        // Registrar no audit log
        await prisma.xPAuditLog.create({
          data: {
            userId: chris.id,
            username: 'chris',
            source: 'admin-correction',
            amount: -xpToRemove,
            reason: 'Correção: Removida conquista weekend-warrior indevida (não tinha café FEITO no fim de semana)',
            balanceBefore: userLevel.xp,
            balanceAfter: newXp,
            timestamp: new Date()
          }
        });
        console.log('✅ Audit log criado');
      }
    } else {
      console.log('\n❌ Chris TEM café feito no fim de semana, conquista é válida');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

fix();
