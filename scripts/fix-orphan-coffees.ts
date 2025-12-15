/**
 * 🔧 SCRIPT PARA CORRIGIR CAFÉS SEM MAKER
 * 
 * Cafés criados antes da migração podem estar sem makerId.
 * Este script tenta associar baseado no nome salvo na descrição ou remove cafés órfãos.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

async function main() {
  console.log('\n🔧 ═══════════════════════════════════════════════════');
  console.log('   CORREÇÃO DE CAFÉS SEM MAKER');
  console.log('═══════════════════════════════════════════════════\n');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    // Buscar todos os usuários para mapping
    const users = await prisma.user.findMany();
    const userByName: Record<string, string> = {};
    const userByUsername: Record<string, string> = {};
    
    for (const u of users) {
      userByName[u.name.toLowerCase()] = u.id;
      userByUsername[u.username.toLowerCase()] = u.id;
    }
    
    console.log('Usuários disponíveis:');
    for (const u of users) {
      console.log(`  - ${u.name} (@${u.username}): ${u.id}`);
    }
    
    // Buscar cafés sem maker
    const orphanCoffees = await prisma.coffee.findMany({
      where: { makerId: { equals: undefined as any } },
      include: { ratings: true }
    });
    
    console.log(`\n📊 Cafés sem maker: ${orphanCoffees.length}\n`);
    
    // Tenta associar cada café a um usuário
    for (const coffee of orphanCoffees) {
      console.log(`\n☕ Coffee ID: ${coffee.id}`);
      console.log(`   Descrição: ${coffee.description || '(vazia)'}`);
      console.log(`   Criado em: ${coffee.timestamp}`);
      console.log(`   Tipo: ${coffee.type}`);
      console.log(`   Ratings: ${coffee.ratings.length}`);
      
      // Verificar se há ratings - se houver, podemos inferir o maker
      if (coffee.ratings.length > 0) {
        // Buscar ratings detalhados
        const ratings = await prisma.rating.findMany({
          where: { coffeeId: coffee.id },
          include: {
            user: true
          }
        });
        
        console.log('   Avaliadores:');
        for (const r of ratings) {
          console.log(`     - ${r.user.name}: ${r.rating}⭐`);
        }
        
        // Se o café não tem maker, mas foi avaliado,
        // provavelmente foi um café antigo. Vamos tentar inferir.
        // Por enquanto, apenas logar para análise manual
        console.log('   ⚠️ Este café precisa ser associado manualmente');
      } else {
        // Café sem ratings - pode ser deletado
        console.log('   🗑️ Café sem ratings - será mantido para análise');
      }
    }
    
    // Buscar todos os cafés com ratings para análise
    console.log('\n\n📊 ANÁLISE DE TODOS OS CAFÉS COM RATINGS:\n');
    
    const coffeesWithRatings = await prisma.coffee.findMany({
      include: {
        maker: true,
        ratings: {
          include: { user: true }
        }
      },
      orderBy: { timestamp: 'desc' }
    });
    
    for (const c of coffeesWithRatings) {
      if (c.ratings.length > 0) {
        const makerInfo = c.maker ? `${c.maker.name} (@${c.maker.username})` : '❌ SEM MAKER';
        console.log(`☕ ${c.timestamp.toLocaleDateString()} - Maker: ${makerInfo}`);
        console.log(`   ID: ${c.id}`);
        for (const r of c.ratings) {
          console.log(`   ⭐ ${r.rating} por ${r.user.name}`);
        }
        console.log('');
      }
    }

    console.log('\n✅ Análise concluída!\n');
    console.log('Para corrigir cafés sem maker, execute:');
    console.log('  UPDATE "Coffee" SET "makerId" = \'USER_ID\' WHERE id = \'COFFEE_ID\';');

  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
