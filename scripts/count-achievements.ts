/**
 * Script para contar e analisar todas as conquistas
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

interface AchievementDef {
    name: string;
    rarity: string;
    category: string;
    secret: boolean;
}

// Definir conquistas manualmente baseado no definitions.js
const achievementDefinitions: Record<string, AchievementDef> = {
    // COFFEE MAKING
    'first-coffee': { name: 'Primeiro Café', rarity: 'common', category: 'coffee', secret: false },
    'coffee-lover': { name: 'Amante do Café', rarity: 'common', category: 'coffee', secret: false },
    'barista-junior': { name: 'Barista Jr.', rarity: 'rare', category: 'coffee', secret: false },
    'barista-senior': { name: 'Barista Sênior', rarity: 'epic', category: 'coffee', secret: false },
    'coffee-master': { name: 'Mestre do Café', rarity: 'legendary', category: 'coffee', secret: false },
    'coffee-legend': { name: 'Lenda do Café', rarity: 'platinum', category: 'coffee', secret: false },
    'coffee-god': { name: 'Deus do Café', rarity: 'platinum', category: 'coffee', secret: false },
    
    // SUPPLY
    'first-supply': { name: 'Primeiro Suprimento', rarity: 'common', category: 'supply', secret: false },
    'supplier': { name: 'Fornecedor', rarity: 'common', category: 'supply', secret: false },
    'generous': { name: 'Generoso', rarity: 'rare', category: 'supply', secret: false },
    'benefactor': { name: 'Benfeitor', rarity: 'epic', category: 'supply', secret: false },
    'philanthropist': { name: 'Filantropo do Café', rarity: 'legendary', category: 'supply', secret: false },
    'supply-king': { name: 'Rei dos Suprimentos', rarity: 'platinum', category: 'supply', secret: false },
    'supply-legend': { name: 'Lenda do Abastecimento', rarity: 'platinum', category: 'supply', secret: false },
    'silent-hero': { name: 'Herói Silencioso', rarity: 'epic', category: 'supply', secret: true },
    
    // RATING
    'first-rate': { name: 'Crítico', rarity: 'common', category: 'rating', secret: false },
    'taste-expert': { name: 'Especialista', rarity: 'rare', category: 'rating', secret: false },
    'sommelier': { name: 'Sommelier de Café', rarity: 'epic', category: 'rating', secret: false },
    'five-stars': { name: '5 Estrelas', rarity: 'common', category: 'rating', secret: false },
    'five-stars-master': { name: 'Colecionador de Estrelas', rarity: 'epic', category: 'rating', secret: false },
    'five-stars-legend': { name: 'Constelação', rarity: 'legendary', category: 'rating', secret: false },
    'top-rated': { name: 'Mais Bem Avaliado', rarity: 'epic', category: 'rating', secret: false },
    'perfect-score': { name: 'Perfeição', rarity: 'platinum', category: 'rating', secret: false },
    'galaxy-of-stars': { name: 'Galáxia de Estrelas', rarity: 'platinum', category: 'rating', secret: false },
    'critic-master': { name: 'Mestre Crítico', rarity: 'legendary', category: 'rating', secret: false },
    'double-rainbow': { name: 'Arco-Íris Duplo', rarity: 'epic', category: 'rating', secret: true },
    'unanimous': { name: 'Unanimidade', rarity: 'platinum', category: 'rating', secret: true },
    'diversity-champion': { name: 'Campeão da Diversidade', rarity: 'rare', category: 'rating', secret: false },
    
    // CHAT
    'first-message': { name: 'Primeiro Contato', rarity: 'common', category: 'chat', secret: false },
    'chatterbox': { name: 'Tagarela', rarity: 'common', category: 'chat', secret: false },
    'social-butterfly': { name: 'Sociável', rarity: 'rare', category: 'chat', secret: false },
    'communicator': { name: 'Comunicador', rarity: 'epic', category: 'chat', secret: false },
    'influencer': { name: 'Influenciador', rarity: 'legendary', category: 'chat', secret: false },
    'viral': { name: 'Viral', rarity: 'epic', category: 'chat', secret: false },
    'popular': { name: 'Popular', rarity: 'legendary', category: 'chat', secret: false },
    
    // SPECIAL
    'early-bird': { name: 'Madrugador', rarity: 'rare', category: 'special', secret: false },
    'night-owl': { name: 'Coruja', rarity: 'rare', category: 'special', secret: false },
    'weekend-warrior': { name: 'Guerreiro de Fim de Semana', rarity: 'rare', category: 'special', secret: false },
    'monday-hero': { name: 'Herói da Segunda', rarity: 'rare', category: 'special', secret: false },
    'friday-finisher': { name: 'Finalizador da Sexta', rarity: 'rare', category: 'special', secret: false },
    'night-shift': { name: 'Turno da Noite', rarity: 'epic', category: 'special', secret: true },
    'early-legend': { name: 'Lenda Matinal', rarity: 'legendary', category: 'special', secret: false },
    'comeback-king': { name: 'Rei do Retorno', rarity: 'rare', category: 'special', secret: true },
    'first-of-the-day': { name: 'Primeiro do Dia', rarity: 'epic', category: 'special', secret: false },
    'last-of-the-day': { name: 'Último do Dia', rarity: 'epic', category: 'special', secret: false },
    
    // STREAK
    'streak-3': { name: 'Consistente', rarity: 'common', category: 'streak', secret: false },
    'streak-7': { name: 'Dedicado', rarity: 'rare', category: 'streak', secret: false },
    'streak-14': { name: 'Duas Semanas', rarity: 'epic', category: 'streak', secret: false },
    'streak-30': { name: 'Imbatível', rarity: 'legendary', category: 'streak', secret: false },
    'streak-60': { name: 'Máquina de Café', rarity: 'platinum', category: 'streak', secret: false },
    'coffee-streak-master': { name: 'Senhor das Sequências', rarity: 'platinum', category: 'streak', secret: false },
    'perfect-month': { name: 'Mês Perfeito', rarity: 'legendary', category: 'streak', secret: true },
    
    // MILESTONE
    'veteran': { name: 'Veterano', rarity: 'rare', category: 'milestone', secret: false },
    'ancient': { name: 'Ancião', rarity: 'epic', category: 'milestone', secret: false },
    'founding-member': { name: 'Membro Fundador', rarity: 'legendary', category: 'milestone', secret: false },
    'all-rounder': { name: 'Completo', rarity: 'epic', category: 'milestone', secret: false },
    'perfectionist': { name: 'Perfeccionista', rarity: 'legendary', category: 'milestone', secret: false },
    'completionist': { name: 'Completista', rarity: 'platinum', category: 'milestone', secret: false },
    'community-pillar': { name: 'Pilar da Comunidade', rarity: 'platinum', category: 'milestone', secret: false },
    'eternal-legend': { name: 'Lenda Eterna', rarity: 'platinum', category: 'milestone', secret: false },
    
    // FUN
    'emoji-master': { name: 'Mestre dos Emojis', rarity: 'rare', category: 'fun', secret: false },
    'emoji-legend': { name: 'Lenda dos Emojis', rarity: 'epic', category: 'fun', secret: false },
    'reactor': { name: 'Reator Nuclear', rarity: 'rare', category: 'fun', secret: false },
    'reaction-god': { name: 'Deus das Reações', rarity: 'legendary', category: 'fun', secret: false },
    'speed-typer': { name: 'Digitador Veloz', rarity: 'rare', category: 'fun', secret: true },
    'coffee-duo': { name: 'Dupla do Café', rarity: 'rare', category: 'fun', secret: true },
    'triple-threat': { name: 'Ameaça Tripla', rarity: 'legendary', category: 'fun', secret: true },
};

async function main() {
    console.log('\n==========================================');
    console.log('📊 ANÁLISE COMPLETA DE CONQUISTAS');
    console.log('==========================================\n');
    
    // Contagem do definitions.js
    const total = Object.keys(achievementDefinitions).length;
    const secretas = Object.values(achievementDefinitions).filter(a => a.secret).length;
    
    console.log(`📋 Total de conquistas definidas: ${total}`);
    console.log(`🔮 Conquistas secretas: ${secretas}`);
    console.log(`📖 Conquistas normais: ${total - secretas}`);
    
    // Por categoria
    console.log('\n📁 Por categoria:');
    const cats: Record<string, number> = {};
    Object.values(achievementDefinitions).forEach(a => {
        cats[a.category] = (cats[a.category] || 0) + 1;
    });
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`   - ${cat}: ${count}`);
    });
    
    // Por raridade
    console.log('\n💎 Por raridade:');
    const rars: Record<string, number> = {};
    Object.values(achievementDefinitions).forEach(a => {
        rars[a.rarity] = (rars[a.rarity] || 0) + 1;
    });
    ['common', 'rare', 'epic', 'legendary', 'platinum'].forEach(r => {
        console.log(`   - ${r}: ${rars[r] || 0}`);
    });
    
    // Conquistas secretas
    console.log('\n🔮 Conquistas SECRETAS:');
    Object.entries(achievementDefinitions).filter(([_, a]) => a.secret).forEach(([id, a]) => {
        console.log(`   - ${id}: "${a.name}" (${a.rarity})`);
    });
    
    // Verificar banco de dados
    console.log('\n==========================================');
    console.log('🗄️  VERIFICAÇÃO DO BANCO DE DADOS');
    console.log('==========================================\n');
    
    try {
        // Verificar Achievement (conquistas desbloqueadas no banco)
        const dbAchievements = await prisma.achievement.findMany({
            include: {
                user: true
            }
        });
        console.log(`📋 Conquistas desbloqueadas no banco: ${dbAchievements.length}`);
        
        // Por usuário
        const porUsuario: Record<string, number> = {};
        dbAchievements.forEach((a: any) => {
            const name = a.user.name;
            porUsuario[name] = (porUsuario[name] || 0) + 1;
        });
        
        console.log('\n👤 Conquistas por usuário:');
        Object.entries(porUsuario).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
            console.log(`   - ${name}: ${count}`);
        });
        
        // Verificar tipos únicos de conquistas no banco
        const tiposNoBanco = new Set(dbAchievements.map((a: any) => a.type));
        console.log(`\n📊 Tipos únicos de conquistas no banco: ${tiposNoBanco.size}`);
        
        // Verificar se todos os tipos estão definidos
        const tiposFaltando = [...tiposNoBanco].filter(t => !achievementDefinitions[t as string]);
        if (tiposFaltando.length > 0) {
            console.log('\n❓ Tipos no banco que NÃO estão definidos no código:');
            tiposFaltando.forEach(t => console.log(`   - ${t}`));
        }
        
        // Verificar conquistas por tipo
        console.log('\n📈 Conquistas mais desbloqueadas:');
        const porTipo: Record<string, number> = {};
        dbAchievements.forEach((a: any) => {
            porTipo[a.type] = (porTipo[a.type] || 0) + 1;
        });
        Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([type, count]) => {
            const def = achievementDefinitions[type];
            console.log(`   - ${def?.name || type}: ${count} usuários`);
        });
        
        // Verificar conquistas nunca desbloqueadas
        const tiposDesbloqueados = new Set(Object.keys(porTipo));
        const nuncaDesbloqueadas = Object.entries(achievementDefinitions)
            .filter(([id]) => !tiposDesbloqueados.has(id));
        
        if (nuncaDesbloqueadas.length > 0) {
            console.log(`\n🔒 Conquistas NUNCA desbloqueadas (${nuncaDesbloqueadas.length}):`);
            nuncaDesbloqueadas.forEach(([id, a]) => {
                console.log(`   - ${id}: "${a.name}" (${a.rarity}${a.secret ? ', secreta' : ''})`);
            });
        }
        
        // Listar todas as conquistas do banco para debug
        console.log('\n📋 TODAS as conquistas no banco (por tipo):');
        [...tiposNoBanco].sort().forEach(type => {
            const def = achievementDefinitions[type as string];
            const count = porTipo[type as string] || 0;
            const status = def ? '✅' : '❌';
            console.log(`   ${status} ${type}: ${count} usuários ${def ? `(${def.name})` : '(NÃO DEFINIDO!)'}`);
        });
        
    } catch (error) {
        console.error('Erro ao acessar banco:', error);
    }
    
    await prisma.$disconnect();
    await pool.end();
}

main();
