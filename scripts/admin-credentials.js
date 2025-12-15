/**
 * 🔐 ADMIN CREDENTIALS TOOL
 * Ferramenta CLI segura para administradores consultarem credenciais
 * 
 * Uso:
 *   node scripts/admin-credentials.js list           # Listar todos os usuários
 *   node scripts/admin-credentials.js show wilmar    # Ver credenciais de um usuário
 *   node scripts/admin-credentials.js generate       # Gerar novo hash de senha
 * 
 * ⚠️  IMPORTANTE:
 * - Senhas são lidas do .env (que está no .gitignore)
 * - NUNCA compartilhe este script com senhas hardcoded
 * - NUNCA commit o arquivo .env
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Parse user data from .env
 */
function loadUsers() {
    const users = [];
    const envKeys = Object.keys(process.env).filter(key => key.startsWith('USER_'));
    
    for (const key of envKeys) {
        const value = process.env[key];
        const [username, hash, name, role, avatar, setor] = value.split(':');
        users.push({ username, hash, name, role, avatar, setor });
    }
    
    return users;
}

/**
 * List all users (without passwords)
 */
function listUsers() {
    console.log('\n📋 USUÁRIOS CADASTRADOS\n');
    console.log('┌─────────────┬──────────────────┬───────────┬────────┬──────────────────────┐');
    console.log('│ Username    │ Nome             │ Role      │ Avatar │ Setor                │');
    console.log('├─────────────┼──────────────────┼───────────┼────────┼──────────────────────┤');
    
    const users = loadUsers();
    users.forEach(user => {
        console.log(
            `│ ${user.username.padEnd(11)} │ ${user.name.padEnd(16)} │ ${user.role.padEnd(9)} │ ${user.avatar.padEnd(6)} │ ${user.setor.padEnd(20)} │`
        );
    });
    
    console.log('└─────────────┴──────────────────┴───────────┴────────┴──────────────────────┘\n');
}

/**
 * Show specific user details
 */
function showUser(username) {
    const users = loadUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (!user) {
        console.log(`\n❌ Usuário '${username}' não encontrado!\n`);
        return;
    }
    
    console.log('\n👤 INFORMAÇÕES DO USUÁRIO\n');
    console.log(`Username:  ${user.username}`);
    console.log(`Nome:      ${user.name}`);
    console.log(`Role:      ${user.role}`);
    console.log(`Avatar:    ${user.avatar}`);
    console.log(`Setor:     ${user.setor}`);
    console.log(`\nHash bcrypt: ${user.hash}`);
    console.log('\n⚠️  O hash acima é o que está armazenado no .env');
    console.log('⚠️  A senha original não pode ser recuperada do hash\n');
}

/**
 * Generate new password hash
 */
async function generateHash() {
    console.log('\n🔐 GERADOR DE HASH DE SENHA\n');
    
    rl.question('Digite a senha: ', async (password) => {
        if (!password) {
            console.log('❌ Senha não pode ser vazia!\n');
            rl.close();
            return;
        }
        
        console.log('\n⏳ Gerando hash...\n');
        const hash = await bcrypt.hash(password, 10);
        
        console.log('✅ Hash gerado com sucesso!\n');
        console.log(`Hash bcrypt: ${hash}\n`);
        console.log('📋 Use este hash no arquivo .env:');
        console.log(`USER_EXEMPLO=username:${hash}:Nome:role:avatar:setor\n`);
        
        rl.close();
    });
}

/**
 * Verify password against hash
 */
async function verifyPassword() {
    console.log('\n🔍 VERIFICAR SENHA\n');
    
    rl.question('Username: ', (username) => {
        const users = loadUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        
        if (!user) {
            console.log(`\n❌ Usuário '${username}' não encontrado!\n`);
            rl.close();
            return;
        }
        
        rl.question('Senha para testar: ', async (password) => {
            const match = await bcrypt.compare(password, user.hash);
            
            if (match) {
                console.log('\n✅ SENHA CORRETA!\n');
            } else {
                console.log('\n❌ SENHA INCORRETA!\n');
            }
            
            rl.close();
        });
    });
}

/**
 * Show help
 */
function showHelp() {
    console.log('\n🔐 ADMIN CREDENTIALS TOOL\n');
    console.log('Comandos disponíveis:');
    console.log('  list              Lista todos os usuários');
    console.log('  show <username>   Mostra detalhes de um usuário');
    console.log('  generate          Gera hash de uma nova senha');
    console.log('  verify            Verifica se uma senha está correta');
    console.log('  help              Mostra esta ajuda\n');
    console.log('Exemplos:');
    console.log('  node scripts/admin-credentials.js list');
    console.log('  node scripts/admin-credentials.js show wilmar');
    console.log('  node scripts/admin-credentials.js generate\n');
}

// Main CLI
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
    case 'list':
        listUsers();
        break;
    case 'show':
        if (!arg) {
            console.log('\n❌ Especifique um username!\nUso: node scripts/admin-credentials.js show <username>\n');
        } else {
            showUser(arg);
        }
        break;
    case 'generate':
        generateHash();
        break;
    case 'verify':
        verifyPassword();
        break;
    case 'help':
    default:
        showHelp();
        break;
}
