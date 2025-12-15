/**
 * Script para sincronizar XP de todos os usuários
 * Corrige inconsistências entre UserLevel.totalXP e soma dos XPAuditLog
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Função para calcular nível baseado em XP
function calculateLevel(totalXP: number): number {
    const XP_PER_LEVEL = 100;
    const LEVEL_MULTIPLIER = 1.5;
    
    let level = 1;
    let xpNeeded = XP_PER_LEVEL;
    let accumulatedXP = 0;
    
    while (accumulatedXP + xpNeeded <= totalXP) {
        accumulatedXP += xpNeeded;
        level++;
        xpNeeded = Math.floor(XP_PER_LEVEL * Math.pow(LEVEL_MULTIPLIER, level - 1));
    }
    
    return level;
}

async function syncAllUsers() {
    console.log('\n══════════════════════════════════════════════════');
    console.log('       SINCRONIZAÇÃO DE XP - TODOS OS USUÁRIOS     ');
    console.log('══════════════════════════════════════════════════\n');

    const users = await prisma.user.findMany({
        include: { levelData: true }
    });

    let corrected = 0;
    let consistent = 0;

    for (const user of users) {
        // Somar todos os logs confirmados
        const logs = await prisma.xPAuditLog.findMany({
            where: { userId: user.id, status: 'confirmed' }
        });
        
        const logsTotal = logs.reduce((sum, l) => sum + l.amount, 0);
        const dbTotal = user.levelData?.totalXP || 0;
        
        if (dbTotal !== logsTotal) {
            const diff = dbTotal - logsTotal;
            console.log(`\n⚠️  ${user.name} (@${user.username}):`);
            console.log(`   DB: ${dbTotal} XP | Logs: ${logsTotal} XP | Diferença: ${diff > 0 ? '+' : ''}${diff} XP`);
            
            // Calcular novo nível
            const newLevel = calculateLevel(logsTotal);
            
            // Corrigir
            await prisma.userLevel.upsert({
                where: { userId: user.id },
                update: {
                    totalXP: logsTotal,
                    level: newLevel
                },
                create: {
                    userId: user.id,
                    totalXP: logsTotal,
                    level: newLevel
                }
            });
            
            console.log(`   ✅ CORRIGIDO: XP atualizado para ${logsTotal}, Nível ${newLevel}`);
            corrected++;
        } else {
            console.log(`✓ ${user.name}: ${dbTotal} XP (consistente)`);
            consistent++;
        }
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('                      RESUMO                       ');
    console.log('══════════════════════════════════════════════════');
    console.log(`Total de usuários: ${users.length}`);
    console.log(`Consistentes: ${consistent}`);
    console.log(`Corrigidos: ${corrected}`);
    console.log('══════════════════════════════════════════════════\n');

    await prisma.$disconnect();
}

syncAllUsers().catch(console.error);
