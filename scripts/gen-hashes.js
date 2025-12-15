const bcrypt = require('bcrypt');

const senhas = {
    chris: 'chris@cerebro2025!!589finalização',
    atila: 'atila@cerebro2025$$!desenvolvimento',
    renan: 'renan@cerebro2025*&**pcp',
    pedrao: 'pedrao@cerebro2025%%qualidade',
    marcus: 'marcus@cerebro2025%%&8qualidade'
};

async function gerarHashes() {
    for (const [user, senha] of Object.entries(senhas)) {
        const hash = await bcrypt.hash(senha, 10);
        console.log(`${user.toUpperCase()}: ${hash}`);
    }
}

gerarHashes();
