import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:wilmarsoller21052025@localhost:5432/cerebro?schema=public';
const pool = new Pool({ connectionString });

// XP rewards das conquistas
const XP_REWARDS: Record<string, number> = {
  'early-bird': 500,
  'friday-finisher': 500,
  'coffee-duo': 300
};

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('=== VERIFICAÇÃO E CORREÇÃO: CHRIS + RENAN (12/12/2025) ===\n');

    // Buscar usuários
    const chrisResult = await client.query(
      "SELECT id, username FROM users WHERE username ILIKE '%chris%' LIMIT 1"
    );
    const renanResult = await client.query(
      "SELECT id, username FROM users WHERE username ILIKE '%renan%' LIMIT 1"
    );

    const chris = chrisResult.rows[0];
    const renan = renanResult.rows[0];

    if (!chris || !renan) {
      console.log('Usuários não encontrados!');
      return;
    }

    console.log(`CHRIS: ${chris.id} (${chris.username})`);
    console.log(`RENAN: ${renan.id} (${renan.username})`);

    // Data de hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Verificar cafés de hoje
    console.log('\n=== CAFÉS FEITOS HOJE ===');
    const coffeesTodayResult = await client.query(`
      SELECT c.*, u.username as maker_name 
      FROM coffees c 
      JOIN users u ON c."makerId" = u.id
      WHERE c."createdAt" >= $1 AND c."createdAt" < $2
      ORDER BY c."createdAt" ASC
    `, [today, tomorrow]);

    const coffeesToday = coffeesTodayResult.rows;
    coffeesToday.forEach((c: any) => {
      const hora = new Date(c.createdAt).toLocaleTimeString('pt-BR');
      console.log(`  ${c.maker_name}: ${hora}`);
    });

    // Verificar quem fez café hoje
    const chrisMadeCoffee = coffeesToday.some((c: any) => c.makerId === chris.id);
    const renanMadeCoffee = coffeesToday.some((c: any) => c.makerId === renan.id);
    const bothMadeCoffee = chrisMadeCoffee && renanMadeCoffee;

    console.log(`\nChris fez café hoje: ${chrisMadeCoffee ? 'SIM' : 'NÃO'}`);
    console.log(`Renan fez café hoje: ${renanMadeCoffee ? 'SIM' : 'NÃO'}`);
    console.log(`Ambos fizeram café hoje: ${bothMadeCoffee ? 'SIM ✓' : 'NÃO'}`);

    // Verificar horários
    const chrisCoffee = coffeesToday.find((c: any) => c.makerId === chris.id);
    const renanCoffee = coffeesToday.find((c: any) => c.makerId === renan.id);

    if (chrisCoffee) {
      const coffeeDate = new Date(chrisCoffee.createdAt);
      const hora = coffeeDate.getHours();
      console.log(`\nCHRIS fez café às ${coffeeDate.toLocaleTimeString('pt-BR')}`);
      console.log(`  Hora: ${hora} - ${hora < 8 ? 'CEDO (early-bird)' : 'NORMAL'}`);
    }

    if (renanCoffee) {
      const coffeeDate = new Date(renanCoffee.createdAt);
      const hora = coffeeDate.getHours();
      const diaSemana = coffeeDate.getDay();
      console.log(`\nRENAN fez café às ${coffeeDate.toLocaleTimeString('pt-BR')}`);
      console.log(`  Hora: ${hora} - ${hora >= 12 ? 'TARDE (friday-finisher se sexta)' : 'MANHÃ'}`);
      console.log(`  Dia da semana: ${diaSemana} (5 = sexta-feira)`);
    }

    // Buscar conquistas existentes
    console.log('\n=== CONQUISTAS ATUAIS ===');
    
    const chrisAchResult = await client.query(
      'SELECT type, title FROM achievements WHERE "userId" = $1',
      [chris.id]
    );
    console.log(`\nCHRIS (${chrisAchResult.rowCount} conquistas):`);
    chrisAchResult.rows.forEach((a: any) => console.log(`  - ${a.type}`));

    const renanAchResult = await client.query(
      'SELECT type, title FROM achievements WHERE "userId" = $1',
      [renan.id]
    );
    console.log(`\nRENAN (${renanAchResult.rowCount} conquistas):`);
    renanAchResult.rows.forEach((a: any) => console.log(`  - ${a.type}`));

    // CORREÇÕES
    console.log('\n=== APLICANDO CORREÇÕES ===\n');

    // Helper para dar conquista
    async function giveAchievement(userId: string, userName: string, type: string, title: string) {
      const existing = await client.query(
        'SELECT id FROM achievements WHERE "userId" = $1 AND type = $2',
        [userId, type]
      );
      
      if (existing.rowCount && existing.rowCount > 0) {
        console.log(`ℹ ${userName} já tem ${type}`);
        return false;
      }

      await client.query(
        'INSERT INTO achievements (id, "userId", type, title) VALUES (gen_random_uuid(), $1, $2, $3)',
        [userId, type, title]
      );

      // Adicionar XP via user_levels
      const xp = XP_REWARDS[type] || 0;
      if (xp > 0) {
        await client.query(`
          INSERT INTO user_levels (id, "userId", xp, "totalXP", level, streak, "bestStreak", "updatedAt")
          VALUES (gen_random_uuid(), $1, $2, $2, 1, 0, 0, NOW())
          ON CONFLICT ("userId") 
          DO UPDATE SET xp = user_levels.xp + $2, "totalXP" = user_levels."totalXP" + $2, "updatedAt" = NOW()
        `, [userId, xp]);
      }

      console.log(`✓ Dando ${type} para ${userName} (+${xp} XP)`);
      return true;
    }

    // 1. CHRIS - early-bird (se fez café antes das 8h)
    if (chrisCoffee) {
      const coffeeDate = new Date(chrisCoffee.createdAt);
      if (coffeeDate.getHours() < 8) {
        await giveAchievement(chris.id, 'CHRIS', 'early-bird', 'Madrugador');
      }
    }

    // 2. RENAN - friday-finisher (se fez café na sexta após 12h)
    if (renanCoffee) {
      const coffeeDate = new Date(renanCoffee.createdAt);
      const diaSemana = coffeeDate.getDay();
      const hora = coffeeDate.getHours();
      
      if (diaSemana === 5 && hora >= 12) {
        await giveAchievement(renan.id, 'RENAN', 'friday-finisher', 'Finalizador de Sexta');
      }
    }

    // 3. coffee-duo - ambos devem ganhar se fizeram café no mesmo dia
    if (bothMadeCoffee) {
      await giveAchievement(chris.id, 'CHRIS', 'coffee-duo', 'Dupla do Café');
      await giveAchievement(renan.id, 'RENAN', 'coffee-duo', 'Dupla do Café');
    }

    // Resultado final
    console.log('\n=== RESULTADO FINAL ===');
    
    const chrisFinal = await client.query(
      'SELECT COUNT(*) as count FROM achievements WHERE "userId" = $1',
      [chris.id]
    );
    const chrisLevel = await client.query(
      'SELECT xp, "totalXP" FROM user_levels WHERE "userId" = $1',
      [chris.id]
    );
    
    const renanFinal = await client.query(
      'SELECT COUNT(*) as count FROM achievements WHERE "userId" = $1',
      [renan.id]
    );
    const renanLevel = await client.query(
      'SELECT xp, "totalXP" FROM user_levels WHERE "userId" = $1',
      [renan.id]
    );

    console.log(`\nCHRIS: ${chrisFinal.rows[0].count} conquistas, ${chrisLevel.rows[0]?.xp || 0} XP`);
    console.log(`RENAN: ${renanFinal.rows[0].count} conquistas, ${renanLevel.rows[0]?.xp || 0} XP`);

    console.log('\n✅ CONCLUÍDO!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
