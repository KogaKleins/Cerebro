/**
 * Script para listar todas as configurações do banco
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:wilmarsoller21052025@localhost:5432/cerebro?schema=public';

async function main() {
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  console.log('╔══════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           📋 CONFIGURAÇÕES DO BANCO DE DADOS                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Buscar configuração específica de achievements
    const achievementsConfig = await prisma.setting.findUnique({
      where: { key: 'achievements-config' }
    });
    
    if (achievementsConfig) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🏆 ACHIEVEMENTS-CONFIG:');
      console.log('═══════════════════════════════════════════════════════════════');
      console.log(JSON.stringify(achievementsConfig.value, null, 2));
    } else {
      console.log('❌ achievements-config NÃO ENCONTRADO!');
    }
    
    // Listar todas as keys disponíveis
    const allSettings = await prisma.setting.findMany({
      select: { key: true }
    });
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📋 TODAS AS KEYS DISPONÍVEIS:');
    console.log('═══════════════════════════════════════════════════════════════');
    for (const s of allSettings) {
      console.log('  -', s.key);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
