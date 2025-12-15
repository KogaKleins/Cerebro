/**
 * 🔍 Auditoria Rápida de Conquistas
 * Verifica o estado atual das conquistas no banco de dados
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

// Definições de conquistas do frontend (atualizado com todas as conquistas)
const ACHIEVEMENT_DEFINITIONS = {
  // ☕ CAFÉ FEITO
  'first-coffee': { requirement: 1, category: 'coffee', title: 'Primeiro Café' },
  'coffee-lover': { requirement: 10, category: 'coffee', title: 'Amante do Café' },
  'barista-junior': { requirement: 25, category: 'coffee', title: 'Barista Jr.' },
  'barista-senior': { requirement: 50, category: 'coffee', title: 'Barista Sênior' },
  'coffee-master': { requirement: 100, category: 'coffee', title: 'Mestre do Café' },
  'coffee-legend': { requirement: 250, category: 'coffee', title: 'Lenda do Café' },
  'coffee-god': { requirement: 500, category: 'coffee', title: 'Deus do Café' },
  'coffee-immortal': { requirement: 1000, category: 'coffee', title: 'Imortal do Café' },
  
  // 🛒 SUPRIMENTOS
  'first-supply': { requirement: 1, category: 'supply', title: 'Primeiro Suprimento' },
  'supplier': { requirement: 5, category: 'supply', title: 'Fornecedor' },
  'generous': { requirement: 15, category: 'supply', title: 'Generoso' },
  'benefactor': { requirement: 30, category: 'supply', title: 'Benfeitor' },
  'philanthropist': { requirement: 50, category: 'supply', title: 'Filantropo do Café' },
  'supply-king': { requirement: 100, category: 'supply', title: 'Rei dos Suprimentos' },
  'supply-legend': { requirement: 200, category: 'supply', title: 'Lenda dos Suprimentos' },
  
  // ⭐ AVALIAÇÕES RECEBIDAS
  'five-stars': { requirement: 1, category: 'rating', title: '5 Estrelas' },
  'five-stars-master': { requirement: 10, category: 'rating', title: 'Colecionador de Estrelas' },
  'five-stars-legend': { requirement: 25, category: 'rating', title: 'Constelação' },
  'galaxy-of-stars': { requirement: 50, category: 'rating', title: 'Galáxia de Estrelas' },
  'top-rated': { requirement: 4.5, category: 'rating', title: 'Mais Bem Avaliado' },
  'perfect-score': { requirement: 5.0, category: 'rating', title: 'Perfeição' },
  
  // ⭐ AVALIAÇÕES DADAS
  'first-rate': { requirement: 1, category: 'rating', title: 'Crítico' },
  'taste-expert': { requirement: 20, category: 'rating', title: 'Especialista' },
  'sommelier': { requirement: 50, category: 'rating', title: 'Sommelier de Café' },
  'critic-master': { requirement: 100, category: 'rating', title: 'Mestre Crítico' },
  'rating-legend': { requirement: 200, category: 'rating', title: 'Lenda das Avaliações' },
  
  // 💬 CHAT
  'first-message': { requirement: 1, category: 'chat', title: 'Primeiro Contato' },
  'chatterbox': { requirement: 50, category: 'chat', title: 'Tagarela' },
  'social-butterfly': { requirement: 200, category: 'chat', title: 'Sociável' },
  'communicator': { requirement: 500, category: 'chat', title: 'Comunicador' },
  'influencer': { requirement: 1000, category: 'chat', title: 'Influenciador' },
  'chat-legend': { requirement: 2500, category: 'chat', title: 'Lenda do Chat' },
  'eternal-voice': { requirement: 5000, category: 'chat', title: 'Voz Eterna' },
  'viral': { requirement: 50, category: 'chat', title: 'Viral' },
  'popular': { requirement: 200, category: 'chat', title: 'Popular' },
  
  // 😄 EMOJIS & REAÇÕES
  'emoji-master': { requirement: 20, category: 'fun', title: 'Mestre dos Emojis' },
  'emoji-legend': { requirement: 100, category: 'fun', title: 'Lenda dos Emojis' },
  'reactor': { requirement: 100, category: 'fun', title: 'Reator Nuclear' },
  'reaction-god': { requirement: 500, category: 'fun', title: 'Deus das Reações' },
  
  // ✨ ESPECIAIS
  'early-bird': { requirement: 0, category: 'special', title: 'Madrugador' },
  'night-owl': { requirement: 0, category: 'special', title: 'Coruja' },
  'weekend-warrior': { requirement: 0, category: 'special', title: 'Guerreiro de Fim de Semana' },
  'monday-hero': { requirement: 0, category: 'special', title: 'Herói da Segunda' },
  'friday-finisher': { requirement: 0, category: 'special', title: 'Finalizador da Sexta' },
  'night-shift': { requirement: 0, category: 'special', title: 'Plantão Noturno' },
  'early-legend': { requirement: 0, category: 'special', title: 'Lenda Matinal' },
  
  // 🔥 STREAKS
  'streak-3': { requirement: 3, category: 'streak', title: 'Consistente' },
  'streak-7': { requirement: 7, category: 'streak', title: 'Dedicado' },
  'streak-14': { requirement: 14, category: 'streak', title: 'Duas Semanas' },
  'streak-30': { requirement: 30, category: 'streak', title: 'Imbatível' },
  'streak-60': { requirement: 60, category: 'streak', title: 'Máquina de Café' },
  'streak-90': { requirement: 90, category: 'streak', title: 'Trimestre Perfeito' },
  'streak-180': { requirement: 180, category: 'streak', title: 'Semestre de Ouro' },
  'streak-365': { requirement: 365, category: 'streak', title: 'Ano Imbatível' },
  
  // 🏆 MARCOS
  'veteran': { requirement: 30, category: 'milestone', title: 'Veterano' },
  'ancient': { requirement: 90, category: 'milestone', title: 'Ancião' },
  'founding-member': { requirement: 180, category: 'milestone', title: 'Membro Fundador' },
  'eternal-member': { requirement: 365, category: 'milestone', title: 'Membro Eterno' },
  'all-rounder': { requirement: 1, category: 'milestone', title: 'Completo' },
  'perfectionist': { requirement: 0.75, category: 'milestone', title: 'Perfeccionista' },
  'completionist': { requirement: 1.0, category: 'milestone', title: 'Completista' },
  
  // 🎯 CONQUISTAS ESPECIAIS DIFÍCEIS
  'silent-hero': { requirement: 0, category: 'special', title: 'Herói Silencioso' },
  'coffee-streak-master': { requirement: 0, category: 'special', title: 'Mestre das Sequências' },
  'perfect-month': { requirement: 0, category: 'special', title: 'Mês Perfeito' },
  'comeback-king': { requirement: 0, category: 'special', title: 'Rei do Retorno' },
  'double-rainbow': { requirement: 0, category: 'special', title: 'Arco-Íris Duplo' },
  'unanimous': { requirement: 0, category: 'special', title: 'Unanimidade' },
  'first-of-the-day': { requirement: 0, category: 'special', title: 'Primeiro do Dia' },
  'last-of-the-day': { requirement: 0, category: 'special', title: 'Último do Dia' },
  'diversity-champion': { requirement: 0, category: 'special', title: 'Campeão da Diversidade' },
  'community-pillar': { requirement: 0, category: 'special', title: 'Pilar da Comunidade' },
  'eternal-legend': { requirement: 0, category: 'special', title: 'Lenda Eterna' },
  
  // 🎮 SECRETAS
  'speed-typer': { requirement: 5, category: 'fun', title: 'Digitador Veloz', secret: true },
  'coffee-duo': { requirement: 1, category: 'fun', title: 'Dupla do Café', secret: true },
  'triple-threat': { requirement: 1, category: 'fun', title: 'Ameaça Tripla', secret: true },
  'midnight-coffee': { requirement: 0, category: 'special', title: 'Café da Meia-Noite', secret: true },
  'humble-supplier': { requirement: 0, category: 'supply', title: 'Fornecedor Humilde', secret: true },
  'self-critic': { requirement: 0, category: 'rating', title: 'Autocrítico', secret: true },
};

async function audit() {
  console.log('');
  console.log('='.repeat(60));
  console.log('🔍 AUDITORIA DE CONQUISTAS DO CÉREBRO');
  console.log('='.repeat(60));
  
  // 1. Buscar todas as conquistas do banco
  const achievements = await prisma.achievement.findMany({
    include: { user: { select: { username: true } } },
    orderBy: { unlockedAt: 'desc' }
  });
  
  // 2. Agrupar por tipo
  const byType: Record<string, number> = {};
  for (const ach of achievements) {
    byType[ach.type] = (byType[ach.type] || 0) + 1;
  }
  
  console.log('\n📊 RESUMO GERAL');
  console.log('-'.repeat(40));
  console.log(`Total de conquistas desbloqueadas: ${achievements.length}`);
  console.log(`Tipos únicos encontrados: ${Object.keys(byType).length}`);
  console.log(`Total de definições: ${Object.keys(ACHIEVEMENT_DEFINITIONS).length}`);
  
  // 3. Verificar quais tipos existem no banco vs definições
  const definedTypes = new Set(Object.keys(ACHIEVEMENT_DEFINITIONS));
  const dbTypes = new Set(Object.keys(byType));
  
  const missingFromDb = [...definedTypes].filter(t => !dbTypes.has(t));
  const unknownInDb = [...dbTypes].filter(t => !definedTypes.has(t));
  
  console.log('\n⚠️ PROBLEMAS DETECTADOS');
  console.log('-'.repeat(40));
  
  if (missingFromDb.length > 0) {
    console.log(`\n❌ Conquistas DEFINIDAS mas NUNCA desbloqueadas (${missingFromDb.length}):`);
    missingFromDb.forEach(t => {
      const def = (ACHIEVEMENT_DEFINITIONS as any)[t];
      console.log(`   - ${t} (${def?.title || '?'})`);
    });
  } else {
    console.log('✅ Todas as conquistas definidas já foram desbloqueadas ao menos uma vez');
  }
  
  if (unknownInDb.length > 0) {
    console.log(`\n⚠️ Conquistas no BANCO mas NÃO DEFINIDAS no frontend (${unknownInDb.length}):`);
    unknownInDb.forEach(t => {
      console.log(`   - ${t} (${byType[t]} ocorrências)`);
    });
  } else {
    console.log('✅ Não há conquistas órfãs no banco');
  }
  
  // 4. Listar conquistas por tipo (ordenado por quantidade)
  console.log('\n📋 CONQUISTAS POR TIPO');
  console.log('-'.repeat(40));
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const def = (ACHIEVEMENT_DEFINITIONS as any)[type];
      const status = def ? '✓' : '⚠️';
      console.log(`   ${status} ${type}: ${count}x ${def ? `(${def.title})` : '[NÃO DEFINIDA]'}`);
    });
  
  // 5. Últimas conquistas desbloqueadas
  console.log('\n🕐 ÚLTIMAS 10 CONQUISTAS');
  console.log('-'.repeat(40));
  achievements.slice(0, 10).forEach(ach => {
    console.log(`   ${ach.type} - ${ach.user.username} (${ach.unlockedAt.toLocaleDateString('pt-BR')})`);
  });
  
  // 6. Usuários com mais conquistas
  const userCounts: Record<string, number> = {};
  for (const ach of achievements) {
    userCounts[ach.user.username] = (userCounts[ach.user.username] || 0) + 1;
  }
  
  console.log('\n🏆 TOP 5 USUÁRIOS');
  console.log('-'.repeat(40));
  Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([user, count], i) => {
      console.log(`   ${i + 1}. ${user}: ${count} conquistas`);
    });
  
  // 7. Estatísticas por categoria
  console.log('\n📂 POR CATEGORIA');
  console.log('-'.repeat(40));
  const categoryStats: Record<string, { defined: number; unlocked: number }> = {};
  
  for (const [type, def] of Object.entries(ACHIEVEMENT_DEFINITIONS)) {
    const cat = (def as any).category;
    if (!categoryStats[cat]) categoryStats[cat] = { defined: 0, unlocked: 0 };
    categoryStats[cat].defined++;
    if (byType[type]) categoryStats[cat].unlocked += byType[type];
  }
  
  Object.entries(categoryStats)
    .sort((a, b) => b[1].unlocked - a[1].unlocked)
    .forEach(([cat, stats]) => {
      console.log(`   ${cat}: ${stats.defined} definidas, ${stats.unlocked} desbloqueadas`);
    });
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Auditoria concluída');
  console.log('='.repeat(60) + '\n');
  
  await prisma.$disconnect();
  await pool.end();
}

audit().catch(console.error);
