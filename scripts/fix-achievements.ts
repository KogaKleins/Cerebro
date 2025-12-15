/**
 * 🔧 Script para CORRIGIR títulos e XP de conquistas
 * - Corrige títulos que estão diferentes no banco
 * - Recalcula XP de conquistas que não foi creditado
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// Mapa CORRETO de títulos e raridades (do definitions.js)
const ACHIEVEMENT_DATA: Record<string, { title: string; description: string; rarity: string }> = {
    // ☕ CAFÉ FEITO
    'first-coffee': { title: 'Primeiro Café', description: 'Fez seu primeiro café', rarity: 'common' },
    'coffee-lover': { title: 'Amante do Café', description: 'Fez 10 cafés', rarity: 'common' },
    'barista-junior': { title: 'Barista Jr.', description: 'Fez 25 cafés', rarity: 'rare' },
    'barista-senior': { title: 'Barista Sênior', description: 'Fez 50 cafés', rarity: 'epic' },
    'coffee-master': { title: 'Mestre do Café', description: 'Fez 100 cafés', rarity: 'legendary' },
    'coffee-legend': { title: 'Lenda do Café', description: 'Fez 250 cafés', rarity: 'platinum' },
    'coffee-god': { title: 'Deus do Café', description: 'Fez 500 cafés', rarity: 'platinum' },
    
    // 🛒 CAFÉ TRAZIDO
    'first-supply': { title: 'Primeiro Suprimento', description: 'Trouxe café pela primeira vez', rarity: 'common' },
    'supplier': { title: 'Fornecedor', description: 'Trouxe café 5 vezes', rarity: 'common' },
    'generous': { title: 'Generoso', description: 'Trouxe café 15 vezes', rarity: 'rare' },
    'benefactor': { title: 'Benfeitor', description: 'Trouxe café 30 vezes', rarity: 'epic' },
    'philanthropist': { title: 'Filantropo do Café', description: 'Trouxe café 50 vezes', rarity: 'legendary' },
    'supply-king': { title: 'Rei dos Suprimentos', description: 'Trouxe café 100 vezes', rarity: 'platinum' },
    'supply-legend': { title: 'Lenda do Abastecimento', description: 'Trouxe café 200 vezes', rarity: 'platinum' },
    
    // ⭐ AVALIAÇÕES
    'first-rate': { title: 'Crítico', description: 'Avaliou seu primeiro café', rarity: 'common' },
    'taste-expert': { title: 'Especialista', description: 'Avaliou 20 cafés', rarity: 'rare' },
    'sommelier': { title: 'Sommelier de Café', description: 'Avaliou 50 cafés', rarity: 'epic' },
    'five-stars': { title: '5 Estrelas', description: 'Recebeu uma avaliação 5 estrelas', rarity: 'common' },
    'five-stars-master': { title: 'Colecionador de Estrelas', description: 'Recebeu 10 avaliações 5 estrelas', rarity: 'epic' },
    'five-stars-legend': { title: 'Constelação', description: 'Recebeu 25 avaliações 5 estrelas', rarity: 'legendary' },
    'top-rated': { title: 'Mais Bem Avaliado', description: 'Média de avaliação acima de 4.5', rarity: 'epic' },
    'perfect-score': { title: 'Perfeição', description: 'Mantém média 5.0 com pelo menos 10 avaliações', rarity: 'platinum' },
    'galaxy-of-stars': { title: 'Galáxia de Estrelas', description: 'Recebeu 50 avaliações 5 estrelas', rarity: 'platinum' },
    'critic-master': { title: 'Mestre Crítico', description: 'Avaliou 100 cafés', rarity: 'legendary' },
    'diversity-champion': { title: 'Campeão da Diversidade', description: 'Avaliou café de 10 pessoas diferentes', rarity: 'rare' },
    
    // 💬 CHAT
    'first-message': { title: 'Primeiro Contato', description: 'Enviou sua primeira mensagem', rarity: 'common' },
    'chatterbox': { title: 'Tagarela', description: 'Enviou 50 mensagens', rarity: 'common' },
    'social-butterfly': { title: 'Sociável', description: 'Enviou 200 mensagens', rarity: 'rare' },
    'communicator': { title: 'Comunicador', description: 'Enviou 500 mensagens', rarity: 'epic' },
    'influencer': { title: 'Influenciador', description: 'Enviou 1000 mensagens', rarity: 'legendary' },
    'viral': { title: 'Viral', description: 'Recebeu 50 reações', rarity: 'epic' },
    'popular': { title: 'Popular', description: 'Recebeu 200 reações', rarity: 'legendary' },
    
    // ✨ ESPECIAIS
    'early-bird': { title: 'Madrugador', description: 'Fez café antes das 7h', rarity: 'rare' },
    'night-owl': { title: 'Coruja', description: 'Fez café após as 20h', rarity: 'rare' },
    'weekend-warrior': { title: 'Guerreiro de Fim de Semana', description: 'Fez café no fim de semana', rarity: 'rare' },
    'monday-hero': { title: 'Herói da Segunda', description: 'Fez café na segunda-feira antes das 10h', rarity: 'rare' },
    'friday-finisher': { title: 'Finalizador da Sexta', description: 'Fez café na sexta-feira após as 14h', rarity: 'rare' },
    'early-legend': { title: 'Lenda Matinal', description: 'Fez café antes das 6h por 5 dias', rarity: 'legendary' },
    'first-of-the-day': { title: 'Primeiro do Dia', description: 'Foi o primeiro a fazer café 10 vezes', rarity: 'epic' },
    'last-of-the-day': { title: 'Último do Dia', description: 'Foi o último a fazer café 10 vezes', rarity: 'epic' },
    
    // 🔥 STREAK
    'streak-3': { title: 'Consistente', description: 'Fez café 3 dias seguidos', rarity: 'common' },
    'streak-7': { title: 'Dedicado', description: 'Fez café 7 dias seguidos', rarity: 'rare' },
    'streak-14': { title: 'Duas Semanas', description: 'Fez café 14 dias seguidos', rarity: 'epic' },
    'streak-30': { title: 'Imbatível', description: 'Fez café 30 dias seguidos', rarity: 'legendary' },
    'streak-60': { title: 'Máquina de Café', description: 'Fez café 60 dias seguidos', rarity: 'platinum' },
    'coffee-streak-master': { title: 'Senhor das Sequências', description: '100 dias consecutivos', rarity: 'platinum' },
    
    // 🏆 MILESTONE
    'veteran': { title: 'Veterano', description: 'Está no sistema há 30 dias', rarity: 'rare' },
    'ancient': { title: 'Ancião', description: 'Está no sistema há 90 dias', rarity: 'epic' },
    'founding-member': { title: 'Membro Fundador', description: 'Está no sistema há 180 dias', rarity: 'legendary' },
    'all-rounder': { title: 'Completo', description: 'Conquistas de todas categorias', rarity: 'epic' },
    'perfectionist': { title: 'Perfeccionista', description: '75% das conquistas', rarity: 'legendary' },
    'completionist': { title: 'Completista', description: 'TODAS as conquistas', rarity: 'platinum' },
    'community-pillar': { title: 'Pilar da Comunidade', description: '365 dias no sistema', rarity: 'platinum' },
    'eternal-legend': { title: 'Lenda Eterna', description: '2 anos no sistema', rarity: 'platinum' },
    
    // 🎮 FUN
    'emoji-master': { title: 'Mestre dos Emojis', description: 'Usou 20 emojis diferentes', rarity: 'rare' },
    'emoji-legend': { title: 'Lenda dos Emojis', description: 'Usou 50 emojis diferentes', rarity: 'epic' },
    'reactor': { title: 'Reator Nuclear', description: 'Reagiu a 100 mensagens', rarity: 'rare' },
    'reaction-god': { title: 'Deus das Reações', description: 'Reagiu a 500 mensagens', rarity: 'legendary' },
    
    // 🔮 SECRETAS
    'speed-typer': { title: 'Digitador Veloz', description: '5 mensagens em 1 minuto', rarity: 'rare' },
    'coffee-duo': { title: 'Dupla do Café', description: 'Fez café com outro no mesmo dia', rarity: 'rare' },
    'triple-threat': { title: 'Ameaça Tripla', description: 'Fez, trouxe e avaliou no mesmo dia', rarity: 'legendary' },
    'night-shift': { title: 'Turno da Noite', description: 'Fez café após meia-noite', rarity: 'epic' },
    'silent-hero': { title: 'Herói Silencioso', description: 'Trouxe café 10 vezes sem pedir reconhecimento', rarity: 'epic' },
    'perfect-month': { title: 'Mês Perfeito', description: 'Todos os dias úteis do mês', rarity: 'legendary' },
    'comeback-king': { title: 'Rei do Retorno', description: 'Voltou após 30+ dias ausente', rarity: 'rare' },
    'double-rainbow': { title: 'Arco-Íris Duplo', description: 'Duas 5 estrelas no mesmo café', rarity: 'epic' },
    'unanimous': { title: 'Unanimidade', description: '5x 5 estrelas no mesmo café', rarity: 'platinum' },
};

const XP_BY_RARITY: Record<string, number> = {
    'common': 25,
    'rare': 50,
    'epic': 100,
    'legendary': 200,
    'platinum': 500
};

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        🔧 CORREÇÃO DE CONQUISTAS - CÉREBRO                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const DRY_RUN = process.argv.includes('--dry-run');
    if (DRY_RUN) {
        console.log('⚠️  MODO DRY-RUN: Apenas mostrará o que seria feito\n');
    } else {
        console.log('🔴 MODO PRODUÇÃO: As alterações SERÃO aplicadas\n');
    }
    
    try {
        // ═══════════════════════════════════════════════════════════════
        // 1. CORRIGIR TÍTULOS NO BANCO
        // ═══════════════════════════════════════════════════════════════
        console.log('📝 1. CORRIGINDO TÍTULOS E DESCRIÇÕES');
        console.log('─'.repeat(60));
        
        const dbAchievements = await prisma.achievement.findMany();
        let titulosCorrigidos = 0;
        
        for (const ach of dbAchievements) {
            const correctData = ACHIEVEMENT_DATA[ach.type];
            if (!correctData) {
                console.log(`   ⚠️  Tipo desconhecido: "${ach.type}"`);
                continue;
            }
            
            if (ach.title !== correctData.title || (ach.description && ach.description !== correctData.description)) {
                console.log(`   🔄 Corrigindo "${ach.type}":`);
                console.log(`      Título: "${ach.title}" → "${correctData.title}"`);
                
                if (!DRY_RUN) {
                    await prisma.achievement.update({
                        where: { id: ach.id },
                        data: {
                            title: correctData.title,
                            description: correctData.description
                        }
                    });
                }
                titulosCorrigidos++;
            }
        }
        
        console.log(`\n   ✅ ${titulosCorrigidos} título(s) ${DRY_RUN ? 'seriam' : 'foram'} corrigido(s)`);
        
        // ═══════════════════════════════════════════════════════════════
        // 2. VERIFICAR E CORRIGIR XP DE CONQUISTAS
        // ═══════════════════════════════════════════════════════════════
        console.log('\n💰 2. VERIFICANDO XP DE CONQUISTAS');
        console.log('─'.repeat(60));
        
        const usuarios = await prisma.user.findMany();
        
        for (const user of usuarios) {
            const userAchievements = await prisma.achievement.findMany({
                where: { userId: user.id }
            });
            
            if (userAchievements.length === 0) continue;
            
            // Calcular XP esperado de conquistas
            let xpEsperado = 0;
            const achievementDetails: string[] = [];
            
            for (const ach of userAchievements) {
                const data = ACHIEVEMENT_DATA[ach.type];
                if (data) {
                    const xp = XP_BY_RARITY[data.rarity] || 25;
                    xpEsperado += xp;
                    achievementDetails.push(`${data.title} (${data.rarity}, +${xp})`);
                }
            }
            
            // Buscar nível atual do usuário
            const userLevel = await prisma.userLevel.findFirst({
                where: { username: user.username }
            });
            
            // Verificar histórico de XP para conquistas
            const history = Array.isArray(userLevel?.history) ? userLevel.history : [];
            let xpRegistrado = 0;
            
            (history as any[]).forEach((h: any) => {
                if (h.action?.startsWith('achievement:') || h.source?.includes('achievement')) {
                    xpRegistrado += h.xp || 0;
                }
            });
            
            console.log(`\n   📌 ${user.name || user.username}:`);
            console.log(`      Conquistas: ${userAchievements.length}`);
            console.log(`      XP esperado: ${xpEsperado}`);
            console.log(`      XP registrado: ${xpRegistrado}`);
            console.log(`      XP total atual: ${userLevel?.totalXP || 0}`);
            
            const xpFaltando = xpEsperado - xpRegistrado;
            
            if (xpFaltando > 0) {
                console.log(`      ⚠️  XP FALTANDO: ${xpFaltando}`);
                
                if (!DRY_RUN && userLevel) {
                    // Adicionar XP faltante ao histórico
                    const newHistory = [
                        ...(history as any[]),
                        {
                            action: 'achievement:retroactive-fix',
                            xp: xpFaltando,
                            timestamp: new Date().toISOString(),
                            note: `Correção retroativa de XP de ${userAchievements.length} conquistas`
                        }
                    ];
                    
                    const newTotalXP = (userLevel.totalXP || 0) + xpFaltando;
                    const newLevel = calculateLevel(newTotalXP);
                    const newXP = calculateCurrentLevelXP(newTotalXP, newLevel);
                    
                    await prisma.userLevel.update({
                        where: { id: userLevel.id },
                        data: {
                            totalXP: newTotalXP,
                            level: newLevel,
                            xp: newXP,
                            history: newHistory
                        }
                    });
                    
                    console.log(`      ✅ XP corrigido: +${xpFaltando} XP (novo total: ${newTotalXP})`);
                } else if (!userLevel) {
                    console.log(`      ⚠️  Usuário sem registro de nível - pulando`);
                }
            } else {
                console.log(`      ✅ XP está correto`);
            }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 3. RESUMO
        // ═══════════════════════════════════════════════════════════════
        console.log('\n\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    📊 RESUMO DA CORREÇÃO                   ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log(`   📝 Títulos corrigidos: ${titulosCorrigidos}`);
        console.log(`   ${DRY_RUN ? '⚠️  Use sem --dry-run para aplicar' : '✅ Correções aplicadas!'}`);
        
    } catch (error) {
        console.error('Erro durante correção:', error);
    }
    
    await prisma.$disconnect();
    await pool.end();
}

// Funções de cálculo de nível
function calculateLevel(totalXP: number): number {
    // Fórmula: cada nível requer XP crescente
    // Nível 1: 0-99, Nível 2: 100-299, Nível 3: 300-599, etc.
    if (totalXP < 100) return 1;
    
    let level = 1;
    let xpNeeded = 100;
    let accumulated = 0;
    
    while (accumulated + xpNeeded <= totalXP) {
        accumulated += xpNeeded;
        level++;
        xpNeeded = level * 100; // Cada nível requer 100 * nível de XP
    }
    
    return level;
}

function calculateCurrentLevelXP(totalXP: number, level: number): number {
    // Calcula XP no nível atual
    let accumulated = 0;
    for (let i = 1; i < level; i++) {
        accumulated += i * 100;
    }
    return totalXP - accumulated;
}

main();
