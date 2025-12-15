/**
 * 🔧 Script para corrigir títulos de conquistas no banco
 * Alinha os títulos com as definições do frontend
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// Mapa de TYPE -> TÍTULO CORRETO (do definitions.js)
const CORRECT_TITLES: Record<string, string> = {
    // ☕ Café
    'first-coffee': '☕ Primeiro Café',
    'coffee-lover': '☕ Amante de Café',
    'barista-junior': '☕ Barista Júnior',
    'barista-senior': '☕ Barista Sênior',
    'coffee-master': '☕ Mestre do Café',
    'coffee-legend': '☕ Lenda do Café',
    'coffee-god': '☕ Deus do Café',
    
    // 🎁 Suprimentos
    'first-supply': '🎁 Primeiro Suprimento',
    'supplier': '🎁 Fornecedor',
    'generous': '🎁 Generoso',
    'benefactor': '🎁 Benfeitor',
    'philanthropist': '🎁 Filantropo',
    'supply-king': '🎁 Rei dos Suprimentos',
    'supply-legend': '🎁 Lenda dos Suprimentos',
    
    // ⭐ Avaliações
    'first-rate': '⭐ Primeira Avaliação',
    'taste-expert': '⭐ Especialista em Sabor',
    'sommelier': '⭐ Sommelier',
    'five-stars': '⭐ Cinco Estrelas',
    'five-stars-master': '⭐ Mestre 5 Estrelas',
    'five-stars-legend': '⭐ Lenda das 5 Estrelas',
    'top-rated': '🏆 Mais Bem Avaliado',
    'perfect-score': '💯 Pontuação Perfeita',
    'galaxy-of-stars': '🌌 Galáxia de Estrelas',
    'critic-master': '🎭 Crítico Mestre',
    'diversity-champion': '🌈 Campeão da Diversidade',
    
    // 💬 Mensagens
    'first-message': '💬 Primeira Mensagem',
    'chatterbox': '💬 Tagarela',
    'social-butterfly': '🦋 Borboleta Social',
    'communicator': '📢 Comunicador',
    'influencer': '🌟 Influenciador',
    'viral': '🔥 Viral',
    'popular': '👑 Popular',
    
    // ⏰ Horários
    'early-bird': '🌅 Madrugador',
    'night-owl': '🦉 Coruja Noturna',
    'weekend-warrior': '🎉 Guerreiro de Fim de Semana',
    'monday-hero': '💪 Herói da Segunda',
    'friday-finisher': '🎊 Finalizador da Sexta',
    'early-legend': '⏰ Lenda Matinal',
    'first-of-the-day': '🌄 Primeiro do Dia',
    'last-of-the-day': '🌙 Último do Dia',
    
    // 🔥 Sequências
    'streak-3': '🔥 Sequência de 3 Dias',
    'streak-7': '🔥 Sequência Semanal',
    'streak-14': '🔥 Sequência de 14 Dias',
    'streak-30': '🔥 Sequência Mensal',
    'streak-60': '🔥 Sequência Lendária',
    'coffee-streak-master': '☕ Mestre das Sequências',
    
    // 🎖️ Veterano
    'veteran': '🎖️ Veterano',
    'ancient': '🏛️ Ancião',
    'founding-member': '👑 Membro Fundador',
    
    // 🏆 Especiais
    'all-rounder': '🎯 Completo',
    'perfectionist': '✨ Perfeccionista',
    'completionist': '🏆 Completista',
    'community-pillar': '🏛️ Pilar da Comunidade',
    'eternal-legend': '⭐ Lenda Eterna',
    
    // 🎭 Secretas
    'emoji-master': '😎 Mestre dos Emojis',
    'emoji-legend': '🤯 Lenda dos Emojis',
    'reactor': '⚡ Reator',
    'reaction-god': '🔮 Deus das Reações',
    'speed-typer': '⚡ Digitador Veloz',
    'coffee-duo': '👫 Dupla do Café',
    'triple-threat': '🎯 Ameaça Tripla',
    'night-shift': '🌙 Turno da Noite',
    'silent-hero': '🤫 Herói Silencioso',
    'perfect-month': '📅 Mês Perfeito',
    'comeback-king': '👑 Rei do Retorno',
    'double-rainbow': '🌈 Arco-Íris Duplo',
    'unanimous': '🎯 Unânime'
};

async function main() {
    console.log('\n=== CORREÇÃO DE TÍTULOS DE CONQUISTAS ===\n');
    
    // Buscar todas as conquistas
    const achievements = await prisma.achievement.findMany({
        include: { user: true }
    });
    
    console.log(`Total de conquistas no banco: ${achievements.length}\n`);
    
    let fixed = 0;
    let alreadyCorrect = 0;
    let unknown = 0;
    
    for (const ach of achievements) {
        const correctTitle = CORRECT_TITLES[ach.type];
        
        if (!correctTitle) {
            console.log(`⚠️  Type desconhecido: ${ach.type}`);
            unknown++;
            continue;
        }
        
        if (ach.title === correctTitle) {
            alreadyCorrect++;
            continue;
        }
        
        // Corrigir título
        console.log(`🔧 Corrigindo: "${ach.title}" → "${correctTitle}" (${ach.user?.name || 'unknown'})`);
        
        await prisma.achievement.update({
            where: { id: ach.id },
            data: { title: correctTitle }
        });
        
        fixed++;
    }
    
    console.log('\n=== RESULTADO ===');
    console.log(`✅ Já corretos: ${alreadyCorrect}`);
    console.log(`🔧 Corrigidos: ${fixed}`);
    console.log(`⚠️  Desconhecidos: ${unknown}`);
    console.log(`📊 Total: ${achievements.length}`);
    
    // Verificar resultado final
    console.log('\n=== VERIFICAÇÃO PÓS-CORREÇÃO ===\n');
    
    const updated = await prisma.achievement.findMany({
        include: { user: true },
        orderBy: { unlockedAt: 'desc' }
    });
    
    updated.forEach(a => {
        const isCorrect = CORRECT_TITLES[a.type] === a.title;
        const status = isCorrect ? '✅' : '❌';
        console.log(`${status} ${a.user?.name}: ${a.title}`);
    });
    
    await prisma.$disconnect();
    await pool.end();
}

main();
