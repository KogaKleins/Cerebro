@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: ╔══════════════════════════════════════════════════════════════════════════════╗
:: ║                    🧠 CÉREBRO - Configuração Inicial                         ║
:: ║                                                                              ║
:: ║  Script completo para primeira execução                                      ║
:: ╚══════════════════════════════════════════════════════════════════════════════╝

title 🧠 Cérebro - Setup Inicial

cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                                                            ║
echo  ║           🧠 CÉREBRO - CONFIGURAÇÃO INICIAL                ║
echo  ║                                                            ║
echo  ║       Este assistente irá guiá-lo na configuração          ║
echo  ║       completa do sistema Cérebro.                         ║
echo  ║                                                            ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  Pressione qualquer tecla para continuar...
pause > nul

:: ────────────────────────────────────────────────────────────────
:: ETAPA 1: PRÉ-REQUISITOS
:: ────────────────────────────────────────────────────────────────

cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  ETAPA 1/5: VERIFICAÇÃO DE PRÉ-REQUISITOS                  ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.

echo  Verificando Node.js...
where node > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ Node.js NÃO ENCONTRADO!
    echo.
    echo  O Node.js é necessário para executar o Cérebro.
    echo.
    echo  Instalação:
    echo  1. Acesse: https://nodejs.org/
    echo  2. Baixe a versão LTS (recomendada)
    echo  3. Execute o instalador
    echo  4. Reinicie este script após a instalação
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo  ✅ Node.js: %NODE_VERSION%

for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
echo  ✅ npm: v%NPM_VERSION%

echo.
echo  Verificando PostgreSQL...
where psql > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  ⚠️  PostgreSQL não encontrado no PATH
    echo     Certifique-se de ter um banco PostgreSQL disponível.
    echo.
    echo  Opções de banco de dados:
    echo  • Local: Instale o PostgreSQL (https://postgresql.org)
    echo  • Cloud: Use Supabase, Railway, Neon, ou Render
    echo.
) else (
    echo  ✅ PostgreSQL encontrado
)

echo.
echo  Pré-requisitos verificados!
echo  Pressione qualquer tecla para continuar...
pause > nul

:: ────────────────────────────────────────────────────────────────
:: ETAPA 2: CONFIGURAÇÃO DO AMBIENTE
:: ────────────────────────────────────────────────────────────────

cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  ETAPA 2/5: CONFIGURAÇÃO DO AMBIENTE                       ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.

if exist ".env" (
    echo  Arquivo .env já existe.
    echo.
    set /p RECRIAR="  Deseja recriar o arquivo .env? (S/N): "
    if /i "!RECRIAR!"=="S" (
        del .env
        copy .env.example .env > nul
        echo  ✅ Arquivo .env recriado!
    )
) else (
    copy .env.example .env > nul
    echo  ✅ Arquivo .env criado a partir do exemplo!
)

echo.
echo  ┌────────────────────────────────────────────────────────────┐
echo  │                                                            │
echo  │  ⚠️  IMPORTANTE: Configure o arquivo .env agora!           │
echo  │                                                            │
echo  │  Você DEVE configurar pelo menos:                          │
echo  │                                                            │
echo  │  1. DATABASE_URL - URL do seu banco PostgreSQL             │
echo  │  2. JWT_SECRET - Chave secreta para autenticação           │
echo  │                                                            │
echo  │  O arquivo .env será aberto no bloco de notas.             │
echo  │  Salve e feche após editar.                                │
echo  │                                                            │
echo  └────────────────────────────────────────────────────────────┘
echo.
echo  Pressione qualquer tecla para abrir o arquivo .env...
pause > nul

start /wait notepad .env

echo.
echo  Configuração do ambiente concluída!
echo  Pressione qualquer tecla para continuar...
pause > nul

:: ────────────────────────────────────────────────────────────────
:: ETAPA 3: INSTALAÇÃO DE DEPENDÊNCIAS
:: ────────────────────────────────────────────────────────────────

cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  ETAPA 3/5: INSTALAÇÃO DE DEPENDÊNCIAS                     ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  Instalando pacotes npm...
echo  Isso pode levar alguns minutos na primeira vez.
echo.

call npm install

if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ Erro ao instalar dependências!
    echo  Verifique sua conexão com a internet e tente novamente.
    pause
    exit /b 1
)

echo.
echo  ✅ Dependências instaladas com sucesso!
echo  Pressione qualquer tecla para continuar...
pause > nul

:: ────────────────────────────────────────────────────────────────
:: ETAPA 4: CONFIGURAÇÃO DO BANCO DE DADOS
:: ────────────────────────────────────────────────────────────────

cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  ETAPA 4/5: CONFIGURAÇÃO DO BANCO DE DADOS                 ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  Gerando cliente Prisma...
call npx prisma generate

echo.
echo  Aplicando migrações ao banco de dados...
echo.
echo  ⚠️  Certifique-se de que:
echo     - O banco de dados PostgreSQL está rodando
echo     - A DATABASE_URL no .env está correta
echo.
set /p MIGRATE="  Deseja aplicar as migrações agora? (S/N): "

if /i "%MIGRATE%"=="S" (
    echo.
    call npx prisma migrate dev --name init
    
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  ⚠️  Houve um problema com as migrações.
        echo  Verifique a conexão com o banco de dados.
    ) else (
        echo.
        echo  ✅ Banco de dados configurado com sucesso!
    )
) else (
    echo.
    echo  ⏭️  Migrações puladas.
    echo  Execute 'npx prisma migrate dev' quando estiver pronto.
)

echo.
echo  Pressione qualquer tecla para continuar...
pause > nul

:: ────────────────────────────────────────────────────────────────
:: ETAPA 5: CONCLUSÃO
:: ────────────────────────────────────────────────────────────────

cls
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║  ETAPA 5/5: FINALIZAÇÃO                                    ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  Compilando TypeScript...
call npm run build > nul 2>&1

echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                                                            ║
echo  ║       🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO! 🎉            ║
echo  ║                                                            ║
echo  ╠════════════════════════════════════════════════════════════╣
echo  ║                                                            ║
echo  ║  O sistema Cérebro está pronto para uso!                   ║
echo  ║                                                            ║
echo  ║  COMO INICIAR:                                             ║
echo  ║                                                            ║
echo  ║  • Execute: start-server.bat                               ║
echo  ║  • Ou: npm run dev (desenvolvimento)                       ║
echo  ║  • Ou: npm start (produção)                                ║
echo  ║                                                            ║
echo  ║  ACESSO:                                                   ║
echo  ║                                                            ║
echo  ║  • Local: http://localhost:3000                            ║
echo  ║  • O IP de rede será exibido ao iniciar                    ║
echo  ║                                                            ║
echo  ║  PRIMEIRO USUÁRIO:                                         ║
echo  ║                                                            ║
echo  ║  • Use o script: npm run db:create-admin                   ║
echo  ║  • Ou acesse Prisma Studio: npx prisma studio              ║
echo  ║                                                            ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
set /p INICIAR="  Deseja iniciar o servidor agora? (S/N): "

if /i "%INICIAR%"=="S" (
    call start-server.bat
) else (
    echo.
    echo  Até mais! Execute 'start-server.bat' quando estiver pronto.
    echo.
    pause
)
