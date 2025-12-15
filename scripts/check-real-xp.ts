/**
 * 🔍 Script para verificar valores REAIS de XP no banco
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
    console.log('\n=== 1. CONFIGURAÇÃO DE XP NO BANCO ===\n');
    
    // Buscar configuração de XP
    const xpConfig = await prisma.setting.findFirst({
        where: { key: 'xp-config' }
    });
    
    if (xpConfig) {
        console.log('Configuração XP encontrada:');
        const config = xpConfig.value as any;
        
        // Mostrar valores de conquistas
        const achievementKeys = Object.keys(config).filter(k => k.startsWith('achievement'));
        console.log('\n📊 Valores de XP por Conquista:');
        achievementKeys.forEach(k => {
            console.log(`   ${k}: ${JSON.stringify(config[k])}`);
        });
    } else {
        console.log('Nenhuma configuração de XP encontrada no banco');
    }
    
    console.log('\n=== 2. HISTÓRICO DE XP DOS USUÁRIOS ===\n');
    
    const userLevels = await prisma.userLevel.findMany({
        include: { user: true }
    });
    
    for (const ul of userLevels) {
        const username = ul.user.name || ul.user.username;
        console.log(`\n📌 ${username} - Nível ${ul.level} - Total XP: ${ul.totalXP}`);
        
        const history = Array.isArray(ul.history) ? ul.history : [];
        
        if (history.length === 0) {
            console.log('   Sem histórico');
            continue;
        }
        
        // Filtrar conquistas no histórico
        const achievementHistory = (history as any[]).filter((h: any) => {
            const action = h.action || '';
            const source = h.source || '';
            const type = h.type || '';
            return action.includes('achievement') || 
                   source.includes('achievement') || 
                   type.includes('achievement');
        });
        
        if (achievementHistory.length > 0) {
            console.log(`   Conquistas no histórico (${achievementHistory.length}):`);
            let totalAchXP = 0;
            achievementHistory.forEach((h: any) => {
                const label = h.action || h.source || h.type || 'unknown';
                const xp = h.xp || 0;
                totalAchXP += xp;
                console.log(`      - ${label}: +${xp} XP`);
            });
            console.log(`   📊 Total XP de conquistas: ${totalAchXP}`);
        } else {
            console.log('   Nenhuma conquista no histórico');
            
            // Mostrar estrutura do histórico para debug
            console.log(`   Total de entradas no histórico: ${history.length}`);
            if (history.length > 0) {
                console.log('   Primeiras 3 entradas:');
                (history as any[]).slice(0, 3).forEach((h: any, i: number) => {
                    console.log(`      ${i+1}. ${JSON.stringify(h).substring(0, 150)}...`);
                });
            }
        }
    }
    
    console.log('\n=== 3. CONQUISTAS NO BANCO ===\n');
    
    const achievements = await prisma.achievement.findMany({
        include: { user: true }
    });
    
    console.log(`Total de conquistas no banco: ${achievements.length}`);
    
    // Agrupar por usuário
    const byUser: Record<string, any[]> = {};
    achievements.forEach((a: any) => {
        const name = a.user.name || a.user.username;
        if (!byUser[name]) byUser[name] = [];
        byUser[name].push(a);
    });
    
    Object.entries(byUser).forEach(([name, achs]) => {
        console.log(`\n   ${name} (${achs.length} conquistas):`);
        achs.forEach((a: any) => {
            console.log(`      - ${a.type}: "${a.title}"`);
        });
    });
    
    await prisma.$disconnect();
    await pool.end();
}

main();
