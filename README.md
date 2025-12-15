<p align="center">
  <img src="assets/icons/cerebro-icon.svg" alt="Cérebro Logo" width="180" height="180">
</p>

<h1 align="center">🧠 Cérebro</h1>

<p align="center">
  <strong>Sistema de Gerenciamento Interno com Chat em Tempo Real e Gamificação</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue.svg" alt="Version 2.0.0">
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg" alt="Node.js >=18">
  <img src="https://img.shields.io/badge/typescript-5.x-blue.svg" alt="TypeScript 5.x">
  <img src="https://img.shields.io/badge/license-ISC-yellow.svg" alt="License ISC">
</p>

<p align="center">
  <a href="#-visão-geral">Visão Geral</a> •
  <a href="#-funcionalidades">Funcionalidades</a> •
  <a href="#-instalação">Instalação</a> •
  <a href="#-configuração">Configuração</a> •
  <a href="#-uso">Uso</a> •
  <a href="#-estrutura-do-projeto">Estrutura</a>
</p>

---

## 📋 Visão Geral

**Cérebro**:

- 💬 **Chat em tempo real** com WebSockets
- ☕ **Controle de atividades** (ex: controle de café)
- 🏆 **Sistema de gamificação** com conquistas e níveis
- 📊 **Rankings e estatísticas** em tempo real
- 👥 **Painel administrativo** completo
- 🔐 **Autenticação segura** com JWT

---

## ✨ Funcionalidades

### 💬 Chat em Tempo Real
- Mensagens instantâneas via WebSocket
- Sistema de reações com emojis
- Resposta a mensagens (reply)
- Histórico completo de conversas
- Moderação de conteúdo

### ☕ Controle de Atividades
- Registro de atividades (café feito/trazido)
- Sistema de avaliação com estrelas
- Rankings e estatísticas
- Histórico completo

### 🏆 Sistema de Gamificação
- **Níveis**: Progressão baseada em XP
- **Conquistas**: Desbloqueie achievements por ações
- **Streaks**: Recompensas por consistência
- **Rankings**: Competição saudável entre membros

### 👥 Painel Administrativo
- Gerenciamento de usuários
- Moderação de chat
- Comunicados e anúncios
- Auditoria de XP
- Caixa de sugestões

### 🔐 Segurança
- Autenticação JWT
- Rate limiting
- Proteção CORS
- Logs de auditoria
- Sistema de ban temporário

---

## 🔧 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

| Requisito | Versão | Obrigatório |
|-----------|--------|-------------|
| [Node.js](https://nodejs.org/) | 18.x ou superior | ✅ Sim |
| [npm](https://www.npmjs.com/) | 9.x ou superior | ✅ Sim |
| [PostgreSQL](https://postgresql.org/) | 14.x ou superior | ✅ Sim |
| [Redis](https://redis.io/) | 6.x ou superior | ❌ Opcional |

### Verificar instalação

```bash
# Verificar Node.js
node -v  # Deve mostrar v18.x.x ou superior

# Verificar npm
npm -v   # Deve mostrar 9.x.x ou superior

# Verificar PostgreSQL (se instalado localmente)
psql --version
```

### Opções de Banco de Dados

Você pode usar PostgreSQL de várias formas:

| Opção | Descrição | Melhor para |
|-------|-----------|-------------|
| **Local** | PostgreSQL instalado na máquina | Desenvolvimento |
| **Docker** | Container PostgreSQL | Desenvolvimento/Testes |
| **Supabase** | Banco cloud gratuito | Produção pequena escala |
| **Railway** | Banco cloud | Produção |
| **Render** | Banco cloud | Produção |

---

## 🚀 Instalação

### Instalação Rápida (Windows)

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/cerebro.git
cd cerebro
```

2. Execute o assistente de configuração:
```cmd
setup.bat
```

O assistente irá guiá-lo por todas as etapas necessárias.

### Instalação Manual

#### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/cerebro.git
cd cerebro
```

#### 2. Instale as dependências

```bash
npm install
```

#### 3. Configure o ambiente

```bash
# Copie o arquivo de exemplo
copy .env.example .env   # Windows
cp .env.example .env     # Linux/Mac

# Edite o arquivo .env com suas configurações
```

#### 4. Configure o banco de dados

```bash
# Gere o cliente Prisma
npx prisma generate

# Execute as migrações
npx prisma migrate dev
```

#### 5. Inicie o servidor

```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm run build
npm start
```

---

## ⚙️ Configuração

### Arquivo .env

O arquivo `.env` contém todas as configurações do sistema. **Nunca commite este arquivo!**

Consulte o arquivo `.env.example` para ver todas as variáveis disponíveis com explicações detalhadas.

#### Configurações Obrigatórias

```env
# Banco de dados PostgreSQL (OBRIGATÓRIO)
DATABASE_URL="postgresql://usuario:senha@host:5432/database?schema=public"

# Chave secreta JWT (OBRIGATÓRIO - Mude em produção!)
JWT_SECRET=sua_chave_secreta_muito_longa_e_segura
```

#### Configurações Opcionais

```env
# Servidor
PORT=3000
NODE_ENV=development

# Autenticação
JWT_EXPIRES_IN=24h

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Cache (Opcional)
REDIS_URL=redis://localhost:6379

# Monitoramento (Opcional)
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Gerando uma chave JWT segura

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Configuração do Banco de Dados

#### Banco Local

1. Crie um banco de dados:
```sql
CREATE DATABASE cerebro;
```

2. Configure a URL no `.env`:
```env
DATABASE_URL="postgresql://postgres:suasenha@localhost:5432/cerebro?schema=public"
```

#### Banco em Cloud (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Copie a Connection String (Database → Settings → Connection string)
4. Cole no `.env`:
```env
DATABASE_URL="postgresql://postgres:[SENHA]@db.[ID].supabase.co:5432/postgres?schema=public"
```

---

## 👤 Usuários e Autenticação

### Criar o Primeiro Usuário (Admin)

#### Opção 1: Via Prisma Studio

```bash
npx prisma studio
```

Isso abrirá uma interface web. Na tabela `users`, clique em "Add record" e preencha:

| Campo | Valor |
|-------|-------|
| username | admin |
| password | (hash bcrypt - veja abaixo) |
| name | Administrador |
| role | ADMIN |
| avatar | 👑 |
| setor | Geral |

#### Opção 2: Gerando hash de senha

```bash
# Gere o hash da senha
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('suasenha123', 10).then(h => console.log(h))"

# Use o hash gerado no Prisma Studio
```

### Perfis de Usuário

| Perfil | Permissões |
|--------|------------|
| **ADMIN** | Acesso total, painel admin, gerenciar usuários, moderação |
| **MEMBER** | Acesso ao sistema, chat, participação em atividades |

### Criar Novos Usuários

Após ter um admin, novos usuários podem ser criados pelo painel administrativo:

1. Faça login como admin
2. Acesse o Painel Admin
3. Vá em "Gerenciar Membros"
4. Clique em "Adicionar Membro"

---

## 🎮 Uso

### Iniciando o Servidor

#### Windows (Recomendado)
```cmd
start-server.bat
```

#### Via npm
```bash
# Desenvolvimento (hot-reload)
npm run dev

# Produção
npm run build
npm start
```

### Acessando o Sistema

Após iniciar o servidor, acesse:

- **Local**: http://localhost:3000
- **Rede**: O IP será exibido no console

### Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia em modo desenvolvimento com hot-reload |
| `npm run build` | Compila TypeScript para JavaScript |
| `npm start` | Inicia servidor de produção |
| `npm test` | Executa testes |
| `npm run test:coverage` | Executa testes com cobertura |
| `npx prisma studio` | Abre interface visual do banco |
| `npx prisma migrate dev` | Aplica migrações pendentes |

---

## 📁 Estrutura do Projeto

```
cerebro/
├── 📄 index.html              # Interface principal (SPA)
├── 📄 package.json            # Dependências e scripts
├── 📄 tsconfig.json           # Configuração TypeScript
├── 📄 .env.example            # Exemplo de variáveis de ambiente
│
├── 📂 assets/                 # Recursos estáticos
│   ├── 📂 icons/              # Ícones do sistema
│   ├── 📂 images/             # Imagens
│   └── 📂 documents/          # Documentos
│
├── 📂 css/                    # Estilos (Frontend)
│   ├── variables.css          # Variáveis CSS globais
│   ├── base.css               # Estilos base
│   ├── dark-theme.css         # Tema escuro
│   ├── animations.css         # Animações
│   ├── responsive.css         # Media queries
│   └── 📂 pages/              # Estilos por página
│
├── 📂 js/                     # JavaScript (Frontend)
│   ├── main.js                # Entrada principal
│   ├── api.js                 # Comunicação com API
│   ├── auth.js                # Autenticação
│   ├── chat.js                # Lógica do chat
│   ├── socket.js              # WebSocket client
│   └── ...                    # Outros módulos
│
├── 📂 prisma/                 # Banco de dados
│   ├── schema.prisma          # Schema do banco
│   └── 📂 migrations/         # Migrações
│
└── 📂 src/                    # Código TypeScript (Backend)
    ├── server.ts              # Servidor Express
    ├── 📂 controllers/        # Controladores (rotas)
    ├── 📂 services/           # Lógica de negócio
    ├── 📂 repositories/       # Acesso ao banco
    ├── 📂 routes/             # Definição de rotas
    ├── 📂 middleware/         # Middlewares
    ├── 📂 validators/         # Validação de dados
    ├── 📂 types/              # Tipos TypeScript
    └── 📂 utils/              # Utilitários
```

### Arquitetura

O projeto segue uma arquitetura em camadas:

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (SPA)                         │
│  index.html + CSS + JavaScript (Vanilla)                    │
├─────────────────────────────────────────────────────────────┤
│                      API REST + WebSocket                    │
│  Express.js + Socket.io                                     │
├─────────────────────────────────────────────────────────────┤
│                      CONTROLLERS                             │
│  Recebem requisições e delegam para services                │
├─────────────────────────────────────────────────────────────┤
│                      SERVICES                                │
│  Lógica de negócio (XP, Conquistas, Pontos)                │
├─────────────────────────────────────────────────────────────┤
│                      REPOSITORIES                            │
│  Acesso ao banco via Prisma ORM                             │
├─────────────────────────────────────────────────────────────┤
│                      DATABASE                                │
│  PostgreSQL                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo de Desenvolvimento

### Ambiente de Desenvolvimento

1. Inicie o servidor em modo dev:
```bash
npm run dev
```

2. O servidor reinicia automaticamente ao salvar arquivos

3. Para visualizar o banco:
```bash
npx prisma studio
```

### Criando uma Nova Funcionalidade

1. Crie/edite o schema em `prisma/schema.prisma`
2. Execute a migração: `npx prisma migrate dev --name descricao`
3. Crie o repository em `src/repositories/`
4. Crie o service em `src/services/`
5. Crie o controller em `src/controllers/`
6. Adicione as rotas em `src/routes/`
7. Escreva testes em `src/__tests__/`

### Comandos Úteis

```bash
# Verificar tipos TypeScript (sem compilar)
npm run type-check

# Limpar pasta de build
npm run clean

# Rebuild completo
npm run rebuild

# Rodar testes
npm test

# Testes com watch
npm run test:watch
```

---

## 📏 Boas Práticas para o Time

### Padrões de Código

- **TypeScript**: Use tipos explícitos sempre que possível
- **Nomenclatura**: camelCase para variáveis, PascalCase para classes
- **Arquivos**: kebab-case (ex: `user.service.ts`)
- **Commits**: Use mensagens descritivas em português

### O que NÃO versionar

O `.gitignore` já está configurado, mas nunca commite:

- ❌ `node_modules/`
- ❌ `.env` (dados sensíveis)
- ❌ `dist/` (código compilado)
- ❌ `logs/`
- ❌ `coverage/`
- ❌ Arquivos com senhas ou tokens

### Para Novos Desenvolvedores

1. Clone o repositório
2. Execute `setup.bat` (Windows) ou siga a instalação manual
3. Leia a documentação das APIs em `src/routes/`
4. Use `npm run dev` para desenvolvimento
5. Sempre escreva testes para novas funcionalidades

---

## ✅ Checklist de Primeiro Uso

- [ ] Node.js 18+ instalado
- [ ] PostgreSQL disponível (local ou cloud)
- [ ] Repositório clonado
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` configurado
- [ ] Prisma client gerado (`npx prisma generate`)
- [ ] Migrações aplicadas (`npx prisma migrate dev`)
- [ ] Primeiro usuário admin criado
- [ ] Servidor iniciado e acessível

---

## ❗ Erros Comuns e Soluções

### Erro: `Cannot find module '@prisma/client'`

```bash
npx prisma generate
```

### Erro: `Connection refused` (banco de dados)

1. Verifique se o PostgreSQL está rodando
2. Confirme a `DATABASE_URL` no `.env`
3. Verifique credenciais e permissões

### Erro: `JWT_SECRET must be provided`

Adicione no `.env`:
```env
JWT_SECRET=qualquer_string_secreta_aqui
```

### Erro: `Port 3000 is already in use`

Mude a porta no `.env`:
```env
PORT=3001
```

### Erro ao fazer login

1. Verifique se o usuário existe no banco
2. Confirme que a senha está hasheada com bcrypt
3. Verifique os logs do servidor

### Outros PCs não conseguem acessar

1. Verifique se o firewall permite a porta 3000
2. Use o IP mostrado no console do servidor
3. Certifique-se de estar na mesma rede

---

## 🔮 Sugestões de Melhorias Futuras

- [ ] Implementar notificações push
- [ ] Adicionar suporte a anexos no chat
- [ ] Criar dashboard de analytics
- [ ] Implementar integração com calendário
- [ ] Adicionar suporte a múltiplas equipes
- [ ] Criar aplicativo mobile (React Native)
- [ ] Implementar backup automático

---
