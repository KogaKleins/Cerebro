/**
 * Script para gerar hashes de senhas
 * Execute: node generate-hashes.js
 */

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const usuarios = [
    { usuario: 'wilmar', senha: 'wilmargraficasoller793!#123', nome: 'Wilmar', role: 'admin', avatar: '👑', setor: 'PCP' },
    { usuario: 'renan', senha: 'renan@cerebro2025', nome: 'Renan', role: 'member', avatar: '🧠', setor: 'PCP' },
    { usuario: 'chris', senha: 'chris@cerebro2025', nome: 'Chris', role: 'member', avatar: '💡', setor: 'Desenvolvimento' },
    { usuario: 'pedrao', senha: 'pedrao@cerebro2025', nome: 'Pedrão', role: 'member', avatar: '💪', setor: 'Qualidade' },
    { usuario: 'marcus', senha: 'marcus@cerebro2025', nome: 'Marcus', role: 'member', avatar: '🎯', setor: 'Qualidade' },
    { usuario: 'atila', senha: 'atila@cerebro2025', nome: 'Átila', role: 'member', avatar: '⚡', setor: 'Desenvolvimento' }
];

async function gerarHashes() {
    console.log('\n🔐 Gerando hashes de senhas...\n');
    console.log('Cole essas linhas no seu arquivo .env:\n');
    console.log('# ===== USUÁRIOS =====');
    
    for (const user of usuarios) {
        const hash = await bcrypt.hash(user.senha, 10);
        console.log(`USER_${user.usuario.toUpperCase()}=${user.usuario}:${hash}:${user.nome}:${user.role}:${user.avatar}:${user.setor}`);
    }
    
    console.log('\n✅ Hashes gerados com sucesso!');
    console.log('\n⚠️  IMPORTANTE:');
    console.log('1. Copie as linhas acima para o arquivo .env');
    console.log('2. Remova o arquivo CREDENCIAIS.md');
    console.log('3. Nunca commit o arquivo .env no Git');
    console.log('4. Altere as senhas em produção!\n');
    
    rl.close();
}

gerarHashes().catch(console.error);
