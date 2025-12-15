/**
 * 🔍 Script para verificar XP Audit Log - conquistas creditadas
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function main() {
    console.log('\n=== XP AUDIT LOG - CONQUISTAS ===\n');
    
    // Buscar logs de conquistas
    const achievementLogs = await prisma.xPAuditLog.findMany({
        where: {
            source: {
                contains: 'achievement'
            }
        },
        orderBy: { timestamp: 'desc' }
    });
    
    console.log(`Total de logs de conquistas: ${achievementLogs.length}\n`);
    
    if (achievementLogs.length > 0) {
        // Agrupar por usuário
        const byUser: Record<string, any[]> = {};
        achievementLogs.forEach(log => {
            if (!byUser[log.username]) byUser[log.username] = [];
            byUser[log.username].push(log);
        });
        
        Object.entries(byUser).forEach(([username, logs]) => {
            console.log(`\n📌 ${username} (${logs.length} conquistas creditadas):`);
            let totalXP = 0;
            logs.forEach(log => {
                totalXP += log.amount;
                console.log(`   - ${log.reason}: +${log.amount} XP (${new Date(log.timestamp).toLocaleDateString('pt-BR')})`);
            });
            console.log(`   📊 Total XP de conquistas: ${totalXP}`);
        });
    } else {
        console.log('Nenhum log de conquista encontrado no XPAuditLog');
        
        // Verificar se há outros logs
        const allLogs = await prisma.xPAuditLog.findMany({
            take: 20,
            orderBy: { timestamp: 'desc' }
        });
        
        console.log(`\nTotal de logs no XPAuditLog: ${allLogs.length}`);
        if (allLogs.length > 0) {
            console.log('\nPrimeiros 20 logs:');
            allLogs.forEach(log => {
                console.log(`   - [${log.source}] ${log.username}: ${log.reason} (+${log.amount} XP)`);
            });
        }
    }
    
    console.log('\n\n=== VERIFICAÇÃO DE XP ESPERADO VS ATUAL ===\n');
    
    // Valores reais de XP do banco
    const XP_BY_RARITY: Record<string, number> = {
        'common': 50,
        'rare': 500,
        'epic': 1500,
        'legendary': 3000,
        'platinum': 5000
    };
    
    // Raridade de cada conquista
    const RARITY: Record<string, string> = {
        'first-coffee': 'common',
        'coffee-lover': 'common',
        'barista-junior': 'rare',
        'barista-senior': 'epic',
        'coffee-master': 'legendary',
        'coffee-legend': 'platinum',
        'coffee-god': 'platinum',
        'first-supply': 'common',
        'supplier': 'common',
        'generous': 'rare',
        'benefactor': 'epic',
        'philanthropist': 'legendary',
        'supply-king': 'platinum',
        'supply-legend': 'platinum',
        'first-rate': 'common',
        'taste-expert': 'rare',
        'sommelier': 'epic',
        'five-stars': 'common',
        'five-stars-master': 'epic',
        'five-stars-legend': 'legendary',
        'top-rated': 'epic',
        'perfect-score': 'platinum',
        'galaxy-of-stars': 'platinum',
        'critic-master': 'legendary',
        'diversity-champion': 'rare',
        'first-message': 'common',
        'chatterbox': 'common',
        'social-butterfly': 'rare',
        'communicator': 'epic',
        'influencer': 'legendary',
        'viral': 'epic',
        'popular': 'legendary',
        'early-bird': 'rare',
        'night-owl': 'rare',
        'weekend-warrior': 'rare',
        'monday-hero': 'rare',
        'friday-finisher': 'rare',
        'early-legend': 'legendary',
        'first-of-the-day': 'epic',
        'last-of-the-day': 'epic',
        'streak-3': 'common',
        'streak-7': 'rare',
        'streak-14': 'epic',
        'streak-30': 'legendary',
        'streak-60': 'platinum',
        'coffee-streak-master': 'platinum',
        'veteran': 'rare',
        'ancient': 'epic',
        'founding-member': 'legendary',
        'all-rounder': 'epic',
        'perfectionist': 'legendary',
        'completionist': 'platinum',
        'community-pillar': 'platinum',
        'eternal-legend': 'platinum',
        'emoji-master': 'rare',
        'emoji-legend': 'epic',
        'reactor': 'rare',
        'reaction-god': 'legendary',
        'speed-typer': 'rare',
        'coffee-duo': 'rare',
        'triple-threat': 'legendary',
        'night-shift': 'epic',
        'silent-hero': 'epic',
        'perfect-month': 'legendary',
        'comeback-king': 'rare',
        'double-rainbow': 'epic',
        'unanimous': 'platinum',
    };
    
    // Buscar conquistas de cada usuário
    const users = await prisma.user.findMany();
    const userLevels = await prisma.userLevel.findMany({ include: { user: true } });
    
    for (const user of users) {
        const achievements = await prisma.achievement.findMany({
            where: { userId: user.id }
        });
        
        if (achievements.length === 0) continue;
        
        // Calcular XP esperado com valores REAIS
        let xpEsperado = 0;
        const detalhes: string[] = [];
        
        achievements.forEach(a => {
            const rarity = RARITY[a.type] || 'common';
            const xp = XP_BY_RARITY[rarity] || 50;
            xpEsperado += xp;
            detalhes.push(`${a.type} (${rarity}): ${xp}`);
        });
        
        // Buscar XP atual do usuário
        const userLevel = userLevels.find(ul => ul.userId === user.id);
        const xpAtual = userLevel?.totalXP || 0;
        
        // Buscar XP creditado por conquistas no audit log
        const userAchLogs = achievementLogs.filter(l => l.userId === user.id);
        const xpCreditado = userAchLogs.reduce((sum, l) => sum + l.amount, 0);
        
        console.log(`\n📌 ${user.name || user.username}:`);
        console.log(`   Conquistas: ${achievements.length}`);
        console.log(`   XP esperado de conquistas: ${xpEsperado}`);
        console.log(`   XP creditado (audit log): ${xpCreditado}`);
        console.log(`   XP total atual: ${xpAtual}`);
        
        if (xpCreditado < xpEsperado) {
            console.log(`   ⚠️  FALTANDO: ${xpEsperado - xpCreditado} XP de conquistas`);
        } else if (xpCreditado === xpEsperado) {
            console.log(`   ✅ XP de conquistas está correto`);
        } else {
            console.log(`   ⚠️  EXCEDENTE: ${xpCreditado - xpEsperado} XP a mais`);
        }
        
        console.log(`   Detalhes:`);
        detalhes.forEach(d => console.log(`      - ${d}`));
    }
    
    await prisma.$disconnect();
    await pool.end();
}

main();
