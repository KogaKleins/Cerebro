import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
    // Buscar Wilmar
    const wilmar = await prisma.user.findFirst({
        where: { name: { contains: 'Wilmar' } },
        include: { levelData: true }
    });
    
    console.log('=== WILMAR ===');
    console.log('User ID:', wilmar?.id);
    console.log('XP Total (UserLevel):', wilmar?.levelData?.totalXP);
    
    // Buscar logs de auditoria
    const logs = await prisma.xPAuditLog.findMany({
        where: { userId: wilmar?.id, status: 'confirmed' },
        orderBy: { timestamp: 'desc' }
    });
    
    console.log('\nTotal de logs:', logs.length);
    
    // Agrupar por source
    const bySource: Record<string, { count: number; total: number }> = {};
    logs.forEach(l => {
        if (!bySource[l.source]) bySource[l.source] = { count: 0, total: 0 };
        bySource[l.source].count++;
        bySource[l.source].total += l.amount;
    });
    
    console.log('\nPor fonte:');
    let totalFromLogs = 0;
    for (const [src, data] of Object.entries(bySource)) {
        console.log(`  ${src}: ${data.count} transações, ${data.total} XP`);
        totalFromLogs += data.total;
    }
    console.log('\nTotal calculado dos logs:', totalFromLogs);
    
    // Ver mensagens do dia 12/12
    const dec12Start = new Date('2025-12-12T00:00:00');
    const dec12End = new Date('2025-12-12T23:59:59');
    
    const dec12Logs = logs.filter(l => {
        const ts = new Date(l.timestamp);
        return ts >= dec12Start && ts <= dec12End;
    });
    
    console.log('\nLogs de 12/12/2025:', dec12Logs.length);
    dec12Logs.forEach(l => {
        console.log(`  - ${l.source} ${l.amount} XP - ${l.reason?.substring(0, 50)}`);
    });
    
    // Contar mensagens do chat no dia 12/12
    try {
        const messages12 = await (prisma as any).chatMessage.count({
            where: {
                authorId: wilmar?.id,
                timestamp: { gte: dec12Start, lte: dec12End }
            }
        });
        console.log('\nMensagens no chat dia 12/12:', messages12);
    } catch(e) {
        console.log('\nNão foi possível contar mensagens do chat');
    }
    
    // Verificar todos os usuários
    console.log('\n\n=== TODOS USUÁRIOS ===');
    const allUsers = await prisma.user.findMany({
        include: { levelData: true }
    });
    
    for (const user of allUsers) {
        const userLogs = await prisma.xPAuditLog.findMany({
            where: { userId: user.id, status: 'confirmed' }
        });
        
        const logsTotal = userLogs.reduce((sum, l) => sum + l.amount, 0);
        const dbTotal = user.levelData?.totalXP || 0;
        
        console.log(`\n${user.name} (@${user.username}):`);
        console.log(`  DB: ${dbTotal} XP, Logs: ${logsTotal} XP`);
        
        if (dbTotal !== logsTotal) {
            console.log(`  ⚠️ DIFERENÇA: ${dbTotal - logsTotal} XP`);
        }
        
        // Agrupar por fonte
        const userBySource: Record<string, number> = {};
        userLogs.forEach(l => {
            if (!userBySource[l.source]) userBySource[l.source] = 0;
            userBySource[l.source] += l.amount;
        });
        
        console.log('  Breakdown:', userBySource);
    }
    
    await prisma.$disconnect();
}

check().catch(console.error);
