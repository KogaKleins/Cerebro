/**
 * 🔍 INVESTIGAÇÃO: CAUSA RAIZ DOS ERROS DE XP
 * 
 * Objetivos:
 * 1. Descobrir POR QUE o XP estava errado
 * 2. Verificar se emojis das MENSAGENS também são contados (não só reações)
 * 3. Analisar se conquistas de emoji fazem sentido
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Regex para detectar emojis
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{2764}]|[\u{FE0F}]?/gu;

async function extractEmojisFromText(text: string): Promise<string[]> {
  const matches = text.match(EMOJI_REGEX);
  if (!matches) return [];
  // Filtrar vazios e duplicados
  return [...new Set(matches.filter(e => e && e.trim().length > 0))];
}

async function main() {
  console.log('═'.repeat(80));
  console.log('🔍 INVESTIGAÇÃO: CAUSA RAIZ DOS ERROS DE XP');
  console.log('═'.repeat(80));

  // ═══════════════════════════════════════════════════════════════
  // 1. CAUSA RAIZ: Analisar XPAuditLog vs UserLevel
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📊 ANÁLISE 1: Comparando XPAuditLog com UserLevel\n');

  const users = await prisma.user.findMany({
    include: {
      levelData: true
    }
  });

  for (const user of users) {
    // Soma de XP no audit log
    const auditSum = await prisma.xPAuditLog.aggregate({
      where: {
        userId: user.id,
        status: 'confirmed'
      },
      _sum: { amount: true }
    });

    const xpFromAudit = auditSum._sum.amount || 0;
    const xpFromLevel = user.levelData?.totalXP || 0;
    const diff = xpFromLevel - xpFromAudit;

    if (diff !== 0) {
      console.log(`⚠️  ${user.username}:`);
      console.log(`   XP no UserLevel: ${xpFromLevel}`);
      console.log(`   XP no AuditLog:  ${xpFromAudit}`);
      console.log(`   DIFERENÇA: ${diff > 0 ? '+' : ''}${diff} XP`);
      console.log(`   📌 CAUSA PROVÁVEL: XP adicionado SEM passar pelo audit system`);
    } else {
      console.log(`✅ ${user.username}: XP consistente (${xpFromLevel})`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. EMOJIS NAS MENSAGENS vs EMOJIS NAS REAÇÕES
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 ANÁLISE 2: Emojis nas MENSAGENS vs nas REAÇÕES\n');
  console.log('(Sistema atual só conta emojis de REAÇÕES, mas mensagens também têm emojis)\n');

  // Emojis disponíveis no sistema de reações
  const reactionEmojis = await prisma.messageReaction.groupBy({
    by: ['emoji'],
    _count: { emoji: true }
  });
  
  console.log('🎯 EMOJIS DISPONÍVEIS NO SISTEMA DE REAÇÕES:');
  reactionEmojis.forEach(r => {
    console.log(`   ${r.emoji} - usado ${r._count.emoji} vezes`);
  });
  console.log(`   TOTAL: ${reactionEmojis.length} emojis diferentes\n`);

  // Agora buscar emojis nas mensagens
  const messages = await prisma.message.findMany({
    where: { deletedAt: null },
    select: {
      text: true,
      authorId: true,
      author: { select: { username: true } }
    }
  });

  const emojisByUser: Record<string, Set<string>> = {};
  const allMessageEmojis = new Set<string>();

  for (const msg of messages) {
    const emojis = await extractEmojisFromText(msg.text);
    if (emojis.length > 0) {
      if (!emojisByUser[msg.author.username]) {
        emojisByUser[msg.author.username] = new Set();
      }
      emojis.forEach(e => {
        emojisByUser[msg.author.username].add(e);
        allMessageEmojis.add(e);
      });
    }
  }

  console.log('💬 EMOJIS ENCONTRADOS NAS MENSAGENS DO CHAT:');
  console.log(`   TOTAL ÚNICO: ${allMessageEmojis.size} emojis diferentes`);
  console.log(`   Emojis: ${[...allMessageEmojis].join(' ')}\n`);

  console.log('📊 EMOJIS ÚNICOS POR USUÁRIO (MENSAGENS):');
  for (const [username, emojis] of Object.entries(emojisByUser)) {
    console.log(`   ${username}: ${emojis.size} emojis - ${[...emojis].join(' ')}`);
  }

  // Comparar com emojis de reações
  console.log('\n📊 EMOJIS ÚNICOS POR USUÁRIO (REAÇÕES):');
  for (const user of users) {
    const reactionEmojisByUser = await prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { userId: user.username }
    });
    console.log(`   ${user.username}: ${reactionEmojisByUser.length} emojis - ${reactionEmojisByUser.map(r => r.emoji).join(' ')}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. ANÁLISE DE DUPLICAÇÃO NO AUDIT LOG
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 ANÁLISE 3: Verificando duplicações no XPAuditLog\n');

  // Buscar transações que podem ter sido duplicadas
  const potentialDuplicates = await prisma.xPAuditLog.groupBy({
    by: ['userId', 'source', 'sourceId'],
    where: {
      status: 'confirmed',
      sourceId: { not: null }
    },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } }
    }
  });

  if (potentialDuplicates.length > 0) {
    console.log('⚠️  POSSÍVEIS DUPLICAÇÕES ENCONTRADAS:');
    for (const dup of potentialDuplicates) {
      console.log(`   ${dup.userId} - ${dup.source} - ${dup.sourceId}: ${dup._count.id} registros`);
    }
  } else {
    console.log('✅ Nenhuma duplicação óbvia encontrada no audit log');
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. VERIFICAR CONQUISTAS vs TRANSAÇÕES DE XP
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📊 ANÁLISE 4: Conquistas desbloqueadas vs XP creditado\n');

  for (const user of users) {
    const achievements = await prisma.achievement.findMany({
      where: { userId: user.id }
    });

    const achievementXP = await prisma.xPAuditLog.findMany({
      where: {
        userId: user.id,
        source: 'achievement',
        status: 'confirmed'
      }
    });

    if (achievements.length !== achievementXP.length) {
      console.log(`⚠️  ${user.username}:`);
      console.log(`   Conquistas desbloqueadas: ${achievements.length}`);
      console.log(`   Transações de XP de conquistas: ${achievementXP.length}`);
      console.log(`   DIFERENÇA: ${achievements.length - achievementXP.length} conquistas sem XP creditado!`);
      
      // Identificar quais conquistas não creditaram XP
      const creditedTypes = new Set(achievementXP.map(a => (a.metadata as any)?.achievementType || a.sourceId));
      const uncredited = achievements.filter(a => !creditedTypes.has(a.type));
      if (uncredited.length > 0) {
        console.log(`   Conquistas sem XP: ${uncredited.map(a => a.type).join(', ')}`);
      }
    } else {
      console.log(`✅ ${user.username}: ${achievements.length} conquistas, ${achievementXP.length} transações de XP`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. CONCLUSÕES E RECOMENDAÇÕES
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 CONCLUSÕES E RECOMENDAÇÕES');
  console.log('═'.repeat(80));

  console.log(`
🔍 CAUSAS RAIZ IDENTIFICADAS:

1. ❌ XP NÃO AUDITADO:
   - Algumas ações creditavam XP diretamente sem passar pelo audit system
   - Isso causava inconsistência entre XPAuditLog e UserLevel
   - FIX: Todas as ações DEVEM passar pelo PointsEngine

2. ❌ CONQUISTAS SEM XP:
   - Algumas conquistas eram desbloqueadas mas o XP não era creditado
   - Provavelmente erro no fluxo de processamento
   - FIX: unlockAchievement DEVE chamar PointsEngine

3. ⚠️  EMOJIS NAS MENSAGENS NÃO CONTADOS:
   - O sistema só conta emojis usados em REAÇÕES (${reactionEmojis.length} disponíveis)
   - Emojis enviados nas MENSAGENS são ignorados (${allMessageEmojis.size} encontrados)
   - DECISÃO: Contar ambos OU redesenhar conquistas de emoji

4. ⚠️  CONQUISTAS DE EMOJI MUITO FÁCEIS:
   - emoji-master (rare/500 XP): Requer apenas 5 emojis diferentes
   - emoji-legend (epic/1500 XP): Requer apenas 8 emojis diferentes
   - Com apenas 8 emojis de reação disponíveis, é IMPOSSÍVEL falhar
   - RECOMENDAÇÃO: Remover épica ou mudar para contar quantidade total

📊 EMOJIS NO SISTEMA:
   - Reações disponíveis: ${reactionEmojis.length} emojis
   - Emojis nas mensagens: ${allMessageEmojis.size} emojis diferentes

🎯 PRÓXIMOS PASSOS:
   1. Corrigir todos os pontos onde XP é creditado fora do PointsEngine
   2. Decidir sobre emojis: contar mensagens + reações OU remover conquistas épicas
   3. Rebalancear conquistas de emoji (se mantidas)
`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
