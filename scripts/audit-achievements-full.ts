/**
 * 🔍 Script de Auditoria COMPLETA de Conquistas
 * Verifica todas as conquistas no banco vs definições no código
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// ═══════════════════════════════════════════════════════════════
// DEFINIÇÕES COMPLETAS DE CONQUISTAS (do definitions.js)
// ═══════════════════════════════════════════════════════════════
const ACHIEVEMENT_DEFINITIONS: Record<string, {
    name: string;
    description: string;
    rarity: string;
    category: string;
    requirement: number;
    type: string;
    secret?: boolean;
}> = {
    // ☕ CAFÉ FEITO
    'first-coffee': { name: 'Primeiro Café', description: 'Fez seu primeiro café', rarity: 'common', category: 'coffee', requirement: 1, type: 'coffee-made' },
    'coffee-lover': { name: 'Amante do Café', description: 'Fez 10 cafés', rarity: 'common', category: 'coffee', requirement: 10, type: 'coffee-made' },
    'barista-junior': { name: 'Barista Jr.', description: 'Fez 25 cafés', rarity: 'rare', category: 'coffee', requirement: 25, type: 'coffee-made' },
    'barista-senior': { name: 'Barista Sênior', description: 'Fez 50 cafés', rarity: 'epic', category: 'coffee', requirement: 50, type: 'coffee-made' },
    'coffee-master': { name: 'Mestre do Café', description: 'Fez 100 cafés', rarity: 'legendary', category: 'coffee', requirement: 100, type: 'coffee-made' },
    'coffee-legend': { name: 'Lenda do Café', description: 'Fez 250 cafés', rarity: 'platinum', category: 'coffee', requirement: 250, type: 'coffee-made' },
    'coffee-god': { name: 'Deus do Café', description: 'Fez 500 cafés', rarity: 'platinum', category: 'coffee', requirement: 500, type: 'coffee-made' },
    
    // 🛒 CAFÉ TRAZIDO
    'first-supply': { name: 'Primeiro Suprimento', description: 'Trouxe café pela primeira vez', rarity: 'common', category: 'supply', requirement: 1, type: 'coffee-brought' },
    'supplier': { name: 'Fornecedor', description: 'Trouxe café 5 vezes', rarity: 'common', category: 'supply', requirement: 5, type: 'coffee-brought' },
    'generous': { name: 'Generoso', description: 'Trouxe café 15 vezes', rarity: 'rare', category: 'supply', requirement: 15, type: 'coffee-brought' },
    'benefactor': { name: 'Benfeitor', description: 'Trouxe café 30 vezes', rarity: 'epic', category: 'supply', requirement: 30, type: 'coffee-brought' },
    'philanthropist': { name: 'Filantropo do Café', description: 'Trouxe café 50 vezes', rarity: 'legendary', category: 'supply', requirement: 50, type: 'coffee-brought' },
    'supply-king': { name: 'Rei dos Suprimentos', description: 'Trouxe café 100 vezes', rarity: 'platinum', category: 'supply', requirement: 100, type: 'coffee-brought' },
    'supply-legend': { name: 'Lenda do Abastecimento', description: 'Trouxe café 200 vezes', rarity: 'platinum', category: 'supply', requirement: 200, type: 'coffee-brought' },
    'silent-hero': { name: 'Herói Silencioso', description: 'Trouxe café 10 vezes sem nunca ter pedido reconhecimento', rarity: 'epic', category: 'supply', requirement: 10, type: 'humble-supplier', secret: true },
    
    // ⭐ AVALIAÇÕES
    'first-rate': { name: 'Crítico', description: 'Avaliou seu primeiro café', rarity: 'common', category: 'rating', requirement: 1, type: 'ratings-given' },
    'taste-expert': { name: 'Especialista', description: 'Avaliou 20 cafés', rarity: 'rare', category: 'rating', requirement: 20, type: 'ratings-given' },
    'sommelier': { name: 'Sommelier de Café', description: 'Avaliou 50 cafés', rarity: 'epic', category: 'rating', requirement: 50, type: 'ratings-given' },
    'five-stars': { name: '5 Estrelas', description: 'Recebeu uma avaliação 5 estrelas', rarity: 'common', category: 'rating', requirement: 1, type: 'five-star-received' },
    'five-stars-master': { name: 'Colecionador de Estrelas', description: 'Recebeu 10 avaliações 5 estrelas', rarity: 'epic', category: 'rating', requirement: 10, type: 'five-star-received' },
    'five-stars-legend': { name: 'Constelação', description: 'Recebeu 25 avaliações 5 estrelas', rarity: 'legendary', category: 'rating', requirement: 25, type: 'five-star-received' },
    'top-rated': { name: 'Mais Bem Avaliado', description: 'Média de avaliação acima de 4.5', rarity: 'epic', category: 'rating', requirement: 4.5, type: 'average-rating' },
    'perfect-score': { name: 'Perfeição', description: 'Mantém média 5.0 com pelo menos 10 avaliações', rarity: 'platinum', category: 'rating', requirement: 5.0, type: 'perfect-average' },
    'galaxy-of-stars': { name: 'Galáxia de Estrelas', description: 'Recebeu 50 avaliações 5 estrelas', rarity: 'platinum', category: 'rating', requirement: 50, type: 'five-star-received' },
    'critic-master': { name: 'Mestre Crítico', description: 'Avaliou 100 cafés', rarity: 'legendary', category: 'rating', requirement: 100, type: 'ratings-given' },
    'double-rainbow': { name: 'Arco-Íris Duplo', description: 'Recebeu duas avaliações 5 estrelas no mesmo café', rarity: 'epic', category: 'rating', requirement: 1, type: 'double-five-star', secret: true },
    'unanimous': { name: 'Unanimidade', description: 'Recebeu 5 avaliações 5 estrelas no mesmo café', rarity: 'platinum', category: 'rating', requirement: 1, type: 'unanimous-five-star', secret: true },
    'diversity-champion': { name: 'Campeão da Diversidade', description: 'Avaliou café de pelo menos 10 pessoas diferentes', rarity: 'rare', category: 'rating', requirement: 10, type: 'rated-different-makers' },
    
    // 💬 CHAT
    'first-message': { name: 'Primeiro Contato', description: 'Enviou sua primeira mensagem', rarity: 'common', category: 'chat', requirement: 1, type: 'messages-sent' },
    'chatterbox': { name: 'Tagarela', description: 'Enviou 50 mensagens', rarity: 'common', category: 'chat', requirement: 50, type: 'messages-sent' },
    'social-butterfly': { name: 'Sociável', description: 'Enviou 200 mensagens', rarity: 'rare', category: 'chat', requirement: 200, type: 'messages-sent' },
    'communicator': { name: 'Comunicador', description: 'Enviou 500 mensagens', rarity: 'epic', category: 'chat', requirement: 500, type: 'messages-sent' },
    'influencer': { name: 'Influenciador', description: 'Enviou 1000 mensagens', rarity: 'legendary', category: 'chat', requirement: 1000, type: 'messages-sent' },
    'viral': { name: 'Viral', description: 'Recebeu 50 reações em suas mensagens', rarity: 'epic', category: 'chat', requirement: 50, type: 'reactions-received' },
    'popular': { name: 'Popular', description: 'Recebeu 200 reações em suas mensagens', rarity: 'legendary', category: 'chat', requirement: 200, type: 'reactions-received' },
    
    // ✨ ESPECIAIS
    'early-bird': { name: 'Madrugador', description: 'Fez café antes das 7h da manhã', rarity: 'rare', category: 'special', requirement: 1, type: 'early-coffee' },
    'night-owl': { name: 'Coruja', description: 'Fez café após as 20h da noite', rarity: 'rare', category: 'special', requirement: 1, type: 'late-coffee' },
    'weekend-warrior': { name: 'Guerreiro de Fim de Semana', description: 'Fez café no sábado ou domingo', rarity: 'rare', category: 'special', requirement: 1, type: 'weekend-coffee' },
    'monday-hero': { name: 'Herói da Segunda', description: 'Fez café na segunda-feira antes das 10h', rarity: 'rare', category: 'special', requirement: 1, type: 'monday-coffee' },
    'friday-finisher': { name: 'Finalizador da Sexta', description: 'Fez café na sexta-feira após as 14h', rarity: 'rare', category: 'special', requirement: 1, type: 'friday-coffee' },
    'night-shift': { name: 'Turno da Noite', description: 'Fez café após meia-noite', rarity: 'epic', category: 'special', requirement: 1, type: 'midnight-coffee', secret: true },
    'early-legend': { name: 'Lenda Matinal', description: 'Fez café antes das 6h por 5 dias diferentes', rarity: 'legendary', category: 'special', requirement: 5, type: 'early-coffee-count' },
    'comeback-king': { name: 'Rei do Retorno', description: 'Voltou a fazer café após mais de 30 dias ausente', rarity: 'rare', category: 'special', requirement: 1, type: 'comeback', secret: true },
    'first-of-the-day': { name: 'Primeiro do Dia', description: 'Foi o primeiro a fazer café do dia por 10 vezes', rarity: 'epic', category: 'special', requirement: 10, type: 'first-coffee-of-day' },
    'last-of-the-day': { name: 'Último do Dia', description: 'Foi o último a fazer café do dia por 10 vezes', rarity: 'epic', category: 'special', requirement: 10, type: 'last-coffee-of-day' },
    
    // 🔥 STREAK
    'streak-3': { name: 'Consistente', description: 'Fez café 3 dias seguidos', rarity: 'common', category: 'streak', requirement: 3, type: 'streak' },
    'streak-7': { name: 'Dedicado', description: 'Fez café 7 dias seguidos', rarity: 'rare', category: 'streak', requirement: 7, type: 'streak' },
    'streak-14': { name: 'Duas Semanas', description: 'Fez café 14 dias seguidos', rarity: 'epic', category: 'streak', requirement: 14, type: 'streak' },
    'streak-30': { name: 'Imbatível', description: 'Fez café 30 dias seguidos', rarity: 'legendary', category: 'streak', requirement: 30, type: 'streak' },
    'streak-60': { name: 'Máquina de Café', description: 'Fez café 60 dias seguidos', rarity: 'platinum', category: 'streak', requirement: 60, type: 'streak' },
    'coffee-streak-master': { name: 'Senhor das Sequências', description: 'Alcançou uma sequência de 100 dias', rarity: 'platinum', category: 'streak', requirement: 100, type: 'streak' },
    'perfect-month': { name: 'Mês Perfeito', description: 'Fez pelo menos um café em todos os dias úteis do mês', rarity: 'legendary', category: 'streak', requirement: 1, type: 'perfect-month', secret: true },
    
    // 🏆 MILESTONE
    'veteran': { name: 'Veterano', description: 'Está no sistema há mais de 30 dias', rarity: 'rare', category: 'milestone', requirement: 30, type: 'days-active' },
    'ancient': { name: 'Ancião', description: 'Está no sistema há mais de 90 dias', rarity: 'epic', category: 'milestone', requirement: 90, type: 'days-active' },
    'founding-member': { name: 'Membro Fundador', description: 'Está no sistema há mais de 180 dias', rarity: 'legendary', category: 'milestone', requirement: 180, type: 'days-active' },
    'all-rounder': { name: 'Completo', description: 'Desbloqueou conquistas de todas as categorias', rarity: 'epic', category: 'milestone', requirement: 1, type: 'all-categories' },
    'perfectionist': { name: 'Perfeccionista', description: 'Desbloqueou 75% de todas as conquistas', rarity: 'legendary', category: 'milestone', requirement: 0.75, type: 'achievement-percentage' },
    'completionist': { name: 'Completista', description: 'Desbloqueou TODAS as conquistas', rarity: 'platinum', category: 'milestone', requirement: 1.0, type: 'achievement-percentage' },
    'community-pillar': { name: 'Pilar da Comunidade', description: 'Está no sistema há mais de 365 dias', rarity: 'platinum', category: 'milestone', requirement: 365, type: 'days-active' },
    'eternal-legend': { name: 'Lenda Eterna', description: 'Está no sistema há mais de 2 anos', rarity: 'platinum', category: 'milestone', requirement: 730, type: 'days-active' },
    
    // 🎮 FUN
    'emoji-master': { name: 'Mestre dos Emojis', description: 'Usou 20 emojis diferentes no chat', rarity: 'rare', category: 'fun', requirement: 20, type: 'unique-emojis' },
    'emoji-legend': { name: 'Lenda dos Emojis', description: 'Usou 50 emojis diferentes no chat', rarity: 'epic', category: 'fun', requirement: 50, type: 'unique-emojis' },
    'reactor': { name: 'Reator Nuclear', description: 'Reagiu a 100 mensagens', rarity: 'rare', category: 'fun', requirement: 100, type: 'reactions-given' },
    'reaction-god': { name: 'Deus das Reações', description: 'Reagiu a 500 mensagens', rarity: 'legendary', category: 'fun', requirement: 500, type: 'reactions-given' },
    'speed-typer': { name: 'Digitador Veloz', description: 'Enviou 5 mensagens em 1 minuto', rarity: 'rare', category: 'fun', requirement: 5, type: 'messages-per-minute', secret: true },
    'coffee-duo': { name: 'Dupla do Café', description: 'Fez café junto com outro membro no mesmo dia', rarity: 'rare', category: 'fun', requirement: 1, type: 'coffee-same-day', secret: true },
    'triple-threat': { name: 'Ameaça Tripla', description: 'Fez café, trouxe café e avaliou no mesmo dia', rarity: 'legendary', category: 'fun', requirement: 1, type: 'triple-action', secret: true },
};

// Pontos de XP por raridade
const XP_BY_RARITY: Record<string, number> = {
    'common': 25,
    'rare': 50,
    'epic': 100,
    'legendary': 200,
    'platinum': 500
};

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║    🔍 AUDITORIA COMPLETA DE CONQUISTAS - CÉREBRO         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    try {
        // ═══════════════════════════════════════════════════════════════
        // 1. VERIFICAR CONQUISTAS NO BANCO DE DADOS
        // ═══════════════════════════════════════════════════════════════
        console.log('📊 1. CONQUISTAS NO BANCO DE DADOS');
        console.log('─'.repeat(60));
        
        const dbAchievements = await prisma.achievement.findMany({
            include: { user: true },
            orderBy: { unlockedAt: 'desc' }
        });
        
        console.log(`   Total de registros no banco: ${dbAchievements.length}`);
        
        // Agrupar por tipo
        const porTipo: Record<string, any[]> = {};
        dbAchievements.forEach((a: any) => {
            if (!porTipo[a.type]) porTipo[a.type] = [];
            porTipo[a.type].push(a);
        });
        
        const tiposNoBanco = Object.keys(porTipo);
        console.log(`   Tipos únicos de conquistas: ${tiposNoBanco.length}`);
        
        // ═══════════════════════════════════════════════════════════════
        // 2. COMPARAR COM DEFINIÇÕES DO CÓDIGO
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📋 2. COMPARAÇÃO COM DEFINIÇÕES DO CÓDIGO');
        console.log('─'.repeat(60));
        
        const totalDefinidos = Object.keys(ACHIEVEMENT_DEFINITIONS).length;
        console.log(`   Conquistas definidas no código: ${totalDefinidos}`);
        
        // Verificar conquistas no banco que não existem no código
        const tiposDesconhecidos = tiposNoBanco.filter(t => !ACHIEVEMENT_DEFINITIONS[t]);
        if (tiposDesconhecidos.length > 0) {
            console.log('\n   ⚠️  TIPOS NO BANCO QUE NÃO ESTÃO DEFINIDOS NO CÓDIGO:');
            tiposDesconhecidos.forEach(t => {
                const count = porTipo[t].length;
                console.log(`      ❌ "${t}" - ${count} registro(s)`);
            });
        } else {
            console.log('   ✅ Todos os tipos no banco estão definidos no código');
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 3. VERIFICAR TÍTULOS E DESCRIÇÕES
        // ═══════════════════════════════════════════════════════════════
        console.log('\n📝 3. VERIFICAÇÃO DE TÍTULOS E DESCRIÇÕES');
        console.log('─'.repeat(60));
        
        let titulosIncorretos = 0;
        let descricoesIncorretas = 0;
        
        dbAchievements.forEach((a: any) => {
            const def = ACHIEVEMENT_DEFINITIONS[a.type];
            if (def) {
                if (a.title !== def.name) {
                    titulosIncorretos++;
                    console.log(`   ⚠️  Título incorreto para "${a.type}":`);
                    console.log(`      Banco: "${a.title}"`);
                    console.log(`      Esperado: "${def.name}"`);
                }
                if (a.description && def.description && a.description !== def.description) {
                    descricoesIncorretas++;
                    // Só mostra se for muito diferente
                }
            }
        });
        
        if (titulosIncorretos === 0) {
            console.log('   ✅ Todos os títulos estão corretos');
        } else {
            console.log(`   ⚠️  ${titulosIncorretos} título(s) incorreto(s)`);
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 4. VERIFICAR CONQUISTAS DUPLICADAS
        // ═══════════════════════════════════════════════════════════════
        console.log('\n🔄 4. VERIFICAÇÃO DE DUPLICATAS');
        console.log('─'.repeat(60));
        
        const porUsuarioTipo: Record<string, string[]> = {};
        let duplicatas = 0;
        
        dbAchievements.forEach((a: any) => {
            const key = `${a.userId}:${a.type}`;
            if (!porUsuarioTipo[key]) porUsuarioTipo[key] = [];
            porUsuarioTipo[key].push(a.id);
        });
        
        Object.entries(porUsuarioTipo).forEach(([key, ids]) => {
            if (ids.length > 1) {
                duplicatas++;
                const [userId, type] = key.split(':');
                console.log(`   ❌ DUPLICATA: usuário=${userId.substring(0,8)}..., tipo="${type}", ${ids.length} registros`);
            }
        });
        
        if (duplicatas === 0) {
            console.log('   ✅ Nenhuma duplicata encontrada');
        } else {
            console.log(`   ⚠️  ${duplicatas} duplicata(s) encontrada(s) - PRECISA CORRIGIR!`);
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 5. VERIFICAR CONQUISTAS POR USUÁRIO
        // ═══════════════════════════════════════════════════════════════
        console.log('\n👤 5. CONQUISTAS POR USUÁRIO');
        console.log('─'.repeat(60));
        
        const usuarios = await prisma.user.findMany();
        
        for (const user of usuarios) {
            const userAchievements = dbAchievements.filter((a: any) => a.userId === user.id);
            const tipos = userAchievements.map((a: any) => a.type);
            
            // Calcular XP de conquistas
            let xpTotal = 0;
            tipos.forEach(tipo => {
                const def = ACHIEVEMENT_DEFINITIONS[tipo];
                if (def) {
                    xpTotal += XP_BY_RARITY[def.rarity] || 25;
                }
            });
            
            console.log(`\n   📌 ${user.name || user.username} (${userAchievements.length} conquistas, ${xpTotal} XP de conquistas)`);
            
            // Listar conquistas do usuário
            tipos.sort().forEach(tipo => {
                const def = ACHIEVEMENT_DEFINITIONS[tipo];
                const rarity = def?.rarity || 'unknown';
                const xp = XP_BY_RARITY[rarity] || 0;
                const icon = rarity === 'platinum' ? '💎' : 
                            rarity === 'legendary' ? '🏆' :
                            rarity === 'epic' ? '💜' :
                            rarity === 'rare' ? '💙' : '⚪';
                console.log(`      ${icon} ${def?.name || tipo} (${rarity}, +${xp} XP)`);
            });
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 6. VERIFICAR XP DE CONQUISTAS VS XP TOTAL DO USUÁRIO
        // ═══════════════════════════════════════════════════════════════
        console.log('\n\n💰 6. VERIFICAÇÃO DE XP DE CONQUISTAS');
        console.log('─'.repeat(60));
        
        const userLevels = await prisma.userLevel.findMany();
        
        for (const user of usuarios) {
            const userLevel = userLevels.find((ul: any) => ul.username === user.username);
            const userAchievements = dbAchievements.filter((a: any) => a.userId === user.id);
            
            // Calcular XP esperado de conquistas
            let xpEsperado = 0;
            userAchievements.forEach((a: any) => {
                const def = ACHIEVEMENT_DEFINITIONS[a.type];
                if (def) {
                    xpEsperado += XP_BY_RARITY[def.rarity] || 25;
                }
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
            console.log(`      XP esperado de conquistas: ${xpEsperado}`);
            console.log(`      XP registrado no histórico: ${xpRegistrado}`);
            console.log(`      XP total do usuário: ${userLevel?.totalXP || 0}`);
            
            if (xpEsperado !== xpRegistrado) {
                console.log(`      ⚠️  DIFERENÇA: ${xpEsperado - xpRegistrado} XP faltando/sobrando`);
            } else {
                console.log(`      ✅ XP de conquistas está correto`);
            }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // 7. VERIFICAR CONQUISTAS FALTANDO NO BACKEND
        // ═══════════════════════════════════════════════════════════════
        console.log('\n\n🔧 7. CONQUISTAS FALTANDO NO BACKEND (achievement.service.ts)');
        console.log('─'.repeat(60));
        
        // Lista de conquistas que o backend deveria verificar
        const conquistasBackend = [
            // Café feito
            'first-coffee', 'coffee-lover', 'barista-junior', 'barista-senior', 
            'coffee-master', 'coffee-legend', 'coffee-god',
            // Café trazido
            'first-supply', 'supplier', 'generous', 'benefactor', 'philanthropist',
            'supply-king', 'supply-legend',
            // Ratings
            'first-rate', 'taste-expert', 'sommelier', 'critic-master',
            'five-stars', 'five-stars-master', 'five-stars-legend', 'galaxy-of-stars',
            'top-rated', 'perfect-score', 'diversity-champion',
            // Chat
            'first-message', 'chatterbox', 'social-butterfly', 'communicator', 'influencer',
            'viral', 'popular',
            // Especiais
            'early-bird', 'night-owl', 'weekend-warrior', 'monday-hero', 'friday-finisher',
            'early-legend', 'first-of-the-day', 'last-of-the-day',
            // Streak
            'streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-60', 'coffee-streak-master',
            // Milestone
            'veteran', 'ancient', 'founding-member', 'all-rounder', 
            'perfectionist', 'completionist', 'community-pillar', 'eternal-legend',
            // Fun
            'emoji-master', 'emoji-legend', 'reactor', 'reaction-god',
        ];
        
        // Secretas que precisam de lógica especial
        const conquistasSecretas = [
            'speed-typer', 'coffee-duo', 'triple-threat', 'night-shift',
            'silent-hero', 'perfect-month', 'comeback-king', 'double-rainbow', 'unanimous'
        ];
        
        console.log(`   Conquistas que devem ser verificadas pelo backend: ${conquistasBackend.length}`);
        console.log(`   Conquistas secretas (lógica especial): ${conquistasSecretas.length}`);
        
        // ═══════════════════════════════════════════════════════════════
        // 8. RESUMO FINAL
        // ═══════════════════════════════════════════════════════════════
        console.log('\n\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                      📊 RESUMO FINAL                       ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log(`   📋 Total de conquistas definidas: ${totalDefinidos}`);
        console.log(`   📦 Total de registros no banco: ${dbAchievements.length}`);
        console.log(`   👤 Total de usuários: ${usuarios.length}`);
        console.log(`   ⚠️  Tipos desconhecidos: ${tiposDesconhecidos.length}`);
        console.log(`   🔄 Duplicatas: ${duplicatas}`);
        console.log(`   📝 Títulos incorretos: ${titulosIncorretos}`);
        
        // Verificar raridades
        console.log('\n   💎 Distribuição por raridade:');
        const porRaridade: Record<string, number> = {};
        dbAchievements.forEach((a: any) => {
            const def = ACHIEVEMENT_DEFINITIONS[a.type];
            const rarity = def?.rarity || 'unknown';
            porRaridade[rarity] = (porRaridade[rarity] || 0) + 1;
        });
        Object.entries(porRaridade).sort().forEach(([rarity, count]) => {
            const xp = XP_BY_RARITY[rarity] || 0;
            console.log(`      - ${rarity}: ${count} (${xp} XP cada)`);
        });
        
    } catch (error) {
        console.error('Erro durante auditoria:', error);
    }
    
    await prisma.$disconnect();
    await pool.end();
}

main();
