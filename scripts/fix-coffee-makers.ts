/**
 * Script para corrigir cafés sem makerId
 * Baseado na análise do audit, os cafés órfãos são atribuídos aos usuários corretos
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🔧 Iniciando correção de cafés órfãos...\n');

  // Primeiro, vamos verificar os usuários
  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true }
  });
  
  console.log('👥 Usuários no sistema:');
  users.forEach(u => console.log(`   - ${u.name} (${u.username}): ${u.id}`));
  console.log('');

  // Mapeamento de cafés para seus makers corretos
  // Baseado na análise: quem NÃO avaliou o café é o maker
  const coffeeFixMap: { id: string; makerId: string; makerName: string }[] = [
    // Coffee 1764956820236 - "café na medida para ter um dia tranquilo" (Dec 5)
    // Ratings from: Wilmar, Chris, Pedrão → Should be Renan's
    { id: '1764956820236', makerId: '9d0c82e0-04a7-4f7b-b0cb-347086c15f23', makerName: 'Renan' },
    
    // Coffee 1765013623415 - "Café de Sabadão" (Dec 6)
    // Ratings from: Chris, Renan, Wilmar → Should be Pedrão's
    { id: '1765013623415', makerId: '5596ed5a-57c5-4c65-8dd1-074b693b9b7f', makerName: 'Pedrão' },
    
    // Coffee 1765195579753 - "café baludo na medida" (Dec 8)
    // Ratings from: Pedrão, Wilmar, Chris → Should be Renan's
    { id: '1765195579753', makerId: '9d0c82e0-04a7-4f7b-b0cb-347086c15f23', makerName: 'Renan' },
    
    // Coffee 1764959193841 - "Café tradicional" (Dec 5) - BROUGHT
    // Ratings from: Renan, Pedrão, Chris → Should be Wilmar's
    { id: '1764959193841', makerId: '1297e7c3-2008-4927-b8f5-11ec56265967', makerName: 'Wilmar' },
    
    // Coffee f9630c9c-... - "Café moido as 08 h" (Dec 9)
    // Ratings from: Renan, Chris, Wilmar → Should be Pedrão's
    { id: 'f9630c9c-0f4e-460d-a0b7-bad1f6bf4d7d', makerId: '5596ed5a-57c5-4c65-8dd1-074b693b9b7f', makerName: 'Pedrão' },
    
    // Coffee 0de0fb5e-... - "cafezinho madrigador!" (Dec 10)
    // Ratings from: Pedrão, Chris, Wilmar → Should be Renan's
    { id: '0de0fb5e-ee24-48b9-bb64-b0b64e4fd0e6', makerId: '9d0c82e0-04a7-4f7b-b0cb-347086c15f23', makerName: 'Renan' },
    
    // Coffee 3e4eb3e5-... - "aquele melita de respeito" (Dec 10) - BROUGHT
    // Ratings from: Pedrão, Chris, Wilmar → Should be Renan's
    { id: '3e4eb3e5-4e3e-4e04-8b57-32ceeda4ec47', makerId: '9d0c82e0-04a7-4f7b-b0cb-347086c15f23', makerName: 'Renan' },
    
    // Coffee aaed5695-... - "Café Padrão" (Dec 11)
    // Ratings from: Renan, Wilmar → Should be Chris's
    { id: 'aaed5695-af11-49f9-8761-06c1b65dc93c', makerId: 'd9749c5d-a68e-4aca-a1ed-6ea2084df0c4', makerName: 'Chris' }
  ];

  console.log('📝 Corrigindo cafés:\n');

  let fixedCount = 0;
  let errorCount = 0;

  for (const fix of coffeeFixMap) {
    try {
      // Verificar se o café existe
      const coffee = await prisma.coffee.findUnique({
        where: { id: fix.id }
      });

      if (!coffee) {
        console.log(`   ❌ Café ${fix.id} não encontrado`);
        errorCount++;
        continue;
      }

      // Atualizar makerId
      await prisma.coffee.update({
        where: { id: fix.id },
        data: { makerId: fix.makerId }
      });

      console.log(`   ✅ Café ${fix.id} → Maker: ${fix.makerName}`);
      fixedCount++;
    } catch (error) {
      console.log(`   ❌ Erro ao atualizar café ${fix.id}: ${error}`);
      errorCount++;
    }
  }

  console.log('\n📊 Resultado:');
  console.log(`   Cafés corrigidos: ${fixedCount}`);
  console.log(`   Erros: ${errorCount}`);

  // Verificação final
  console.log('\n🔍 Verificando cafés sem maker após correção:');
  const allCoffees = await prisma.coffee.findMany({
    include: { maker: true }
  });
  const orphanCoffees = allCoffees.filter(c => !c.makerId);
  
  if (orphanCoffees.length === 0) {
    console.log('   ✅ Nenhum café órfão restante!');
  } else {
    console.log(`   ⚠️ Ainda há ${orphanCoffees.length} cafés sem maker:`);
    orphanCoffees.forEach(c => console.log(`      - ${c.id}: ${c.description}`));
  }

  await prisma.$disconnect();
  await pool.end();
  
  console.log('\n✨ Correção concluída!');
}

main().catch(console.error);
