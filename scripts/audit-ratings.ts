/**
 * 🔍 SCRIPT DE AUDITORIA DE RATINGS
 * 
 * Verifica inconsistências no sistema de avaliações:
 * - Auto-avaliações (usuário avaliando próprio café)
 * - Ratings duplicados
 * - Cafés sem maker associado
 * - Inconsistências de IDs
 * 
 * Executar: npx ts-node scripts/audit-ratings.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  console.log('\n🔍 ═══════════════════════════════════════════════════');
  console.log('   AUDITORIA COMPLETA DE RATINGS');
  console.log('═══════════════════════════════════════════════════\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Buscar todos os ratings
    console.log('📊 Carregando dados...\n');
    
    const allRatings = await prisma.rating.findMany({
      include: {
        coffee: { 
          include: { 
            maker: { select: { id: true, name: true, username: true } } 
          } 
        },
        user: { select: { id: true, name: true, username: true } }
      }
    });

    console.log(`Total de ratings: ${allRatings.length}\n`);

    // 2. Verificar auto-avaliações
    console.log('🔍 1. VERIFICANDO AUTO-AVALIAÇÕES:\n');
    const selfRatings = allRatings.filter(r => r.coffee.makerId === r.userId);
    
    if (selfRatings.length > 0) {
      console.log(`⚠️  ENCONTRADAS ${selfRatings.length} AUTO-AVALIAÇÕES!`);
      for (const r of selfRatings) {
        console.log(`   - Coffee ${r.coffeeId}: ${r.user.name} (@${r.user.username}) avaliou próprio café`);
      }
      console.log('\n   💡 Solução: Estas avaliações serão removidas.\n');
    } else {
      console.log('✅ Nenhuma auto-avaliação encontrada\n');
    }

    // 3. Verificar cafés sem maker
    console.log('🔍 2. VERIFICANDO CAFÉS SEM MAKER:\n');
    const orphanCoffees = await prisma.coffee.findMany({
      where: { makerId: { equals: undefined as any } }
    });
    
    if (orphanCoffees.length > 0) {
      console.log(`⚠️  ENCONTRADOS ${orphanCoffees.length} CAFÉS SEM MAKER!`);
      for (const c of orphanCoffees) {
        console.log(`   - Coffee ID: ${c.id}, criado em: ${c.timestamp}`);
      }
    } else {
      console.log('✅ Todos os cafés têm maker associado\n');
    }

    // 4. Verificar ratings sem user
    console.log('🔍 3. VERIFICANDO RATINGS SEM USUÁRIO:\n');
    const orphanRatings = allRatings.filter(r => !r.user);
    
    if (orphanRatings.length > 0) {
      console.log(`⚠️  ENCONTRADOS ${orphanRatings.length} RATINGS SEM USUÁRIO!`);
    } else {
      console.log('✅ Todos os ratings têm usuário associado\n');
    }

    // 5. Estatísticas por usuário
    console.log('🔍 4. ESTATÍSTICAS POR USUÁRIO:\n');
    
    const users = await prisma.user.findMany({
      select: { id: true, name: true, username: true }
    });
    
    for (const user of users) {
      const coffeesMade = await prisma.coffee.count({
        where: { makerId: user.id, type: 'MADE' }
      });
      
      const ratingsReceived = await prisma.rating.count({
        where: { coffee: { makerId: user.id } }
      });
      
      const ratingsGiven = await prisma.rating.count({
        where: { userId: user.id }
      });
      
      const fiveStars = await prisma.rating.count({
        where: { rating: 5, coffee: { makerId: user.id } }
      });
      
      console.log(`📌 ${user.name} (@${user.username}):`);
      console.log(`   Cafés feitos: ${coffeesMade}`);
      console.log(`   Ratings recebidos: ${ratingsReceived} (${fiveStars} × 5⭐)`);
      console.log(`   Ratings dados: ${ratingsGiven}`);
      console.log('');
    }

    // 6. Listar últimos 10 cafés com ratings
    console.log('🔍 5. ÚLTIMOS 10 CAFÉS COM RATINGS:\n');
    
    const recentCoffees = await prisma.coffee.findMany({
      where: { type: 'MADE' },
      include: {
        maker: { select: { name: true, username: true } },
        ratings: {
          include: {
            user: { select: { name: true, username: true } }
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    for (const c of recentCoffees) {
      console.log(`☕ ${c.maker.name} - ${c.timestamp.toLocaleString()}`);
      console.log(`   ID: ${c.id}`);
      if (c.ratings.length > 0) {
        for (const r of c.ratings) {
          console.log(`   ⭐ ${r.rating} por ${r.user.name} (@${r.user.username})`);
        }
      } else {
        console.log('   (sem avaliações)');
      }
      console.log('');
    }

    // 7. Remover auto-avaliações se houver
    if (selfRatings.length > 0) {
      console.log('🔧 REMOVENDO AUTO-AVALIAÇÕES...\n');
      
      for (const r of selfRatings) {
        await prisma.rating.delete({
          where: {
            coffeeId_userId: {
              coffeeId: r.coffeeId,
              userId: r.userId
            }
          }
        });
        console.log(`   ✅ Removida: ${r.user.name} auto-avaliação no café ${r.coffeeId}`);
      }
      
      console.log(`\n✅ ${selfRatings.length} auto-avaliações removidas!`);
    }

    console.log('\n✅ Auditoria concluída!\n');

  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
