/**
 * 🔍 Script de Auditoria Completa do Sistema de Pontos
 * 
 * OBJETIVO: Validar integridade de TODOS os pontos no sistema
 * - Verificar se cada ação creditou os pontos corretos
 * - Validar se não há duplicações
 * - Corrigir erros de integridade
 * - Validar banco de dados robusto e completo
 * 
 * USO:
 * npx ts-node scripts/audit-points-comprehensive.ts
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

interface PointsAuditResult {
  userId: string;
  username: string;
  recordedBalance: number;
  calculatedBalance: number;
  isValid: boolean;
  difference: number;
  auditLogs: number;
  coffeeCount: number;
  achievementCount: number;
}

interface ValidationIssue {
  type: 'critical' | 'warning' | 'info';
  user: string;
  message: string;
  details?: any;
}

async function main() {
  console.log('\n📊 ═══════════════════════════════════════════════════');
  console.log('   AUDITORIA COMPLETA DO SISTEMA DE PONTOS');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // 1. Validar estrutura do banco
    console.log('1️⃣  Validando estrutura do banco de dados...');
    const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    ` as any[];
    
    const requiredTables = ['users', 'user_levels', 'xp_audit_logs', 'achievements', 'coffees'];
    const tableNames = tables.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !tableNames.includes(t));
    
    if (missingTables.length > 0) {
      console.error(`❌ Tabelas faltando: ${missingTables.join(', ')}`);
      process.exit(1);
    }
    console.log(`✅ ${requiredTables.length} tabelas requeridas encontradas\n`);

    // 2. Validar todos os usuários
    console.log('2️⃣  Auditando XP de todos os usuários...\n');
    const users = await prisma.user.findMany({
      include: {
        levelData: true,
        achievements: true,
        coffeeMade: true
      }
    });

    const results: PointsAuditResult[] = [];
    let totalIssues = 0;
    let corrected = 0;

    for (const user of users) {
      // Obter logs de auditoria confirmados
      const auditLogs = await prisma.xPAuditLog.findMany({
        where: {
          userId: user.id,
          status: 'confirmed'
        }
      });

      // Calcular saldo baseado em logs
      let calculatedBalance = 0;
      for (const log of auditLogs) {
        calculatedBalance += log.amount;
      }

      const recordedBalance = user.levelData?.totalXP || 0;
      const isValid = recordedBalance === calculatedBalance;
      const difference = recordedBalance - calculatedBalance;

      results.push({
        userId: user.id,
        username: user.username,
        recordedBalance,
        calculatedBalance,
        isValid,
        difference,
        auditLogs: auditLogs.length,
        coffeeCount: user.coffeeMade.length,
        achievementCount: user.achievements.length
      });

      if (!isValid) {
        totalIssues++;
        console.log(`⚠️  ${user.username}`);
        console.log(`   Saldo registrado: ${recordedBalance} XP`);
        console.log(`   Saldo calculado: ${calculatedBalance} XP`);
        console.log(`   Diferença: ${difference > 0 ? '+' : ''}${difference} XP`);
        console.log(`   Logs confirmados: ${auditLogs.length}\n`);

        // Corrigir se houver discrepância pequena (< 100 XP)
        if (Math.abs(difference) < 100 && difference !== 0) {
          try {
            await prisma.userLevel.update({
              where: { userId: user.id },
              data: {
                totalXP: calculatedBalance,
                history: {
                  push: {
                    type: 'audit-correction',
                    xp: difference,
                    timestamp: new Date().toISOString(),
                    reason: `Correção automática de auditoria`
                  }
                }
              }
            });
            console.log(`   ✅ Corrigido automaticamente\n`);
            corrected++;
          } catch (e) {
            console.log(`   ❌ Falha ao corrigir\n`);
          }
        }
      }
    }

    // 3. Validar conquistas desbloqueadas
    console.log('\n3️⃣  Validando conquistas desbloqueadas...\n');
    
    let achievementIssues = 0;
    for (const user of users) {
      // Buscar cafés feitos por este usuário
      const coffeesMadeCount = await prisma.coffee.count({
        where: { makerId: user.id }
      });

      if (coffeesMadeCount > 0) {
        // Verificar se conquistas esperadas existem
        if (coffeesMadeCount >= 10) {
          const achievement = await prisma.achievement.findFirst({
            where: { userId: user.id, type: 'coffee-master' }
          });
          if (!achievement) {
            console.log(`⚠️  ${user.username}: ${coffeesMadeCount} cafés feitos mas sem conquista "coffee-master"`);
            achievementIssues++;
          }
        }
        
        // Primeira xícara
        if (coffeesMadeCount >= 1) {
          const achievement = await prisma.achievement.findFirst({
            where: { userId: user.id, type: 'first-coffee' }
          });
          if (!achievement) {
            console.log(`⚠️  ${user.username}: Fez café mas sem conquista "first-coffee"`);
            achievementIssues++;
          }
        }
      }
    }
    console.log(`✅ Validação de conquistas concluída\n`);

    // 4. Validar duplicações
    console.log('4️⃣  Procurando duplicações de XP...\n');
    
    const duplicates = await prisma.$queryRaw`
      SELECT 
        source, 
        sourceId, 
        userId, 
        COUNT(*) as count
      FROM xp_audit_logs
      WHERE status = 'confirmed' AND sourceId IS NOT NULL
      GROUP BY source, sourceId, userId
      HAVING COUNT(*) > 1
      LIMIT 20
    ` as any[];

    if (duplicates.length > 0) {
      console.log(`⚠️  ${duplicates.length} potenciais duplicações encontradas:`);
      for (const dup of duplicates) {
        console.log(`   - ${dup.source} para usuário (${dup.count} vezes): ${dup.sourceId}`);
      }
    } else {
      console.log('✅ Nenhuma duplicação encontrada\n');
    }

    // 5. 🆕 Validar conquistas de 5 ESTRELAS RECEBIDAS
    console.log('\n5️⃣  Validando conquistas de 5 ESTRELAS RECEBIDAS...\n');
    
    let fiveStarIssues = 0;
    const fiveStarMissingUsers: string[] = [];
    
    for (const user of users) {
      // Contar quantas avaliações de 5 estrelas este usuário RECEBEU
      const fiveStarCount = await prisma.rating.count({
        where: {
          rating: 5,
          coffee: {
            makerId: user.id
          }
        }
      });
      
      if (fiveStarCount >= 1) {
        // Verificar se tem conquista "five-stars"
        const achievement = await prisma.achievement.findFirst({
          where: { userId: user.id, type: 'five-stars' }
        });
        
        if (!achievement) {
          console.log(`⚠️  ${user.username}: Recebeu ${fiveStarCount} avaliação(ões) de 5 estrelas mas NÃO tem conquista "five-stars"`);
          fiveStarIssues++;
          fiveStarMissingUsers.push(user.username);
        }
      }
      
      if (fiveStarCount >= 10) {
        const achievement = await prisma.achievement.findFirst({
          where: { userId: user.id, type: 'five-stars-master' }
        });
        
        if (!achievement) {
          console.log(`⚠️  ${user.username}: Recebeu ${fiveStarCount} avaliações de 5 estrelas mas NÃO tem conquista "five-stars-master"`);
          fiveStarIssues++;
          if (!fiveStarMissingUsers.includes(user.username)) {
            fiveStarMissingUsers.push(user.username);
          }
        }
      }
      
      if (fiveStarCount >= 25) {
        const achievement = await prisma.achievement.findFirst({
          where: { userId: user.id, type: 'five-stars-legend' }
        });
        
        if (!achievement) {
          console.log(`⚠️  ${user.username}: Recebeu ${fiveStarCount} avaliações de 5 estrelas mas NÃO tem conquista "five-stars-legend"`);
          fiveStarIssues++;
          if (!fiveStarMissingUsers.includes(user.username)) {
            fiveStarMissingUsers.push(user.username);
          }
        }
      }
    }
    
    if (fiveStarIssues > 0) {
      console.log(`\n❌ ${fiveStarIssues} conquistas de 5 estrelas FALTANDO!`);
      console.log(`   Usuários afetados: ${fiveStarMissingUsers.join(', ')}`);
      console.log(`   🔧 Para corrigir, execute:`);
      for (const username of fiveStarMissingUsers) {
        console.log(`      curl -X POST http://localhost:3000/api/v2/achievements/recalculate/${username} -H "Authorization: Bearer <TOKEN>"`);
      }
    } else {
      console.log('✅ Todas as conquistas de 5 estrelas estão corretas!\n');
    }

    // 6. Relatório final
    console.log('\n6️⃣  RELATÓRIO FINAL\n');
    console.log(`Total de usuários auditados: ${users.length}`);
    console.log(`Usuários com discrepâncias de XP: ${totalIssues}`);
    console.log(`Correções de XP aplicadas: ${corrected}`);
    console.log(`Problemas de conquistas de café: ${achievementIssues}`);
    console.log(`Problemas de conquistas de 5 estrelas: ${fiveStarIssues}`);
    console.log(`Potenciais duplicações: ${duplicates.length}`);

    // Estatísticas gerais
    const totalXPAuditLogs = await prisma.xPAuditLog.count();
    const totalXPConfirmed = await prisma.xPAuditLog.count({
      where: { status: 'confirmed' }
    });
    const totalXPReversed = await prisma.xPAuditLog.count({
      where: { status: 'reversed' }
    });

    console.log(`\n📊 XP Audit Logs:`);
    console.log(`   Total: ${totalXPAuditLogs}`);
    console.log(`   Confirmados: ${totalXPConfirmed}`);
    console.log(`   Revertidos: ${totalXPReversed}`);

    const totalXPDistributed = await prisma.$queryRaw`
      SELECT SUM(amount) as total FROM xp_audit_logs 
      WHERE status = 'confirmed'
    ` as any[];
    console.log(`   Total XP distribuído: ${totalXPDistributed[0]?.total || 0}`);

    // 7. Validar integridade do banco de dados
    console.log('\n7️⃣  Validando integridade do banco de dados...\n');
    
    let dbIssues = 0;
    
    // 7.1 Validar usuários sem levelData
    const usersWithoutLevelData = users.filter(u => !u.levelData);
    if (usersWithoutLevelData.length > 0) {
      console.log(`⚠️  ${usersWithoutLevelData.length} usuários sem userLevel registro`);
      for (const user of usersWithoutLevelData) {
        try {
          await prisma.userLevel.create({
            data: {
              userId: user.id,
              totalXP: 0,
              level: 1
            }
          });
          console.log(`   ✅ Criado userLevel para ${user.username}`);
        } catch (e) {
          console.log(`   ❌ Erro ao criar userLevel para ${user.username}`);
          dbIssues++;
        }
      }
    }
    
    // 7.2 Validar dados de Achievements
    const totalAchievements = await prisma.achievement.count();
    console.log(`✅ Total de achievements: ${totalAchievements}\n`);
    
    // 7.3 Contar cafés no sistema
    const totalCoffees = await prisma.coffee.count();
    console.log(`✅ Total de cafés registrados: ${totalCoffees}\n`);
    
    // 7.4 Contar avaliações de 5 estrelas no sistema
    const totalFiveStars = await prisma.rating.count({
      where: { rating: 5 }
    });
    console.log(`⭐ Total de avaliações 5 estrelas: ${totalFiveStars}\n`);
    
    console.log(`✅ Validação de banco de dados concluída (${dbIssues} problemas)\n`);

    // 8. Recomendações
    console.log('8️⃣  RECOMENDAÇÕES:\n');
    
    if (totalIssues === 0 && fiveStarIssues === 0 && achievementIssues === 0) {
      console.log('✅ Sistema está íntegro! Nenhuma ação necessária.');
    } else {
      if (totalIssues > 0) {
        console.log(`⚠️  ${totalIssues} usuários com discrepâncias de XP.`);
      }
      if (fiveStarIssues > 0) {
        console.log(`⚠️  ${fiveStarIssues} conquistas de 5 estrelas faltando.`);
        console.log('   👉 Execute POST /api/v2/achievements/recalculate/:username para cada usuário afetado');
      }
      if (achievementIssues > 0) {
        console.log(`⚠️  ${achievementIssues} conquistas de café faltando.`);
      }
      console.log('\nAções recomendadas:');
      console.log('1. Verificar logs de erro no servidor');
      console.log('2. Executar recálculos para usuários afetados via API /api/v2/achievements/recalculate/:username');
      console.log('3. Considerar restaurar backup se houver perda significativa de dados');
    }

    if (duplicates.length > 0) {
      console.log('\n⚠️  Duplicações detectadas! Revisar manualmente.');
    }

    console.log('\n═══════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ ERRO durante auditoria:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
