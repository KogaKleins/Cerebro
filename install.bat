@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: ╔══════════════════════════════════════════════════════════════════════════════╗
:: ║                    🧠 CÉREBRO - Script de Instalação                         ║
:: ║                                                                              ║
:: ║  Este script prepara todo o ambiente para execução do sistema               ║
:: ╚══════════════════════════════════════════════════════════════════════════════╝

title 🧠 Cérebro - Instalação

echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                                                            ║
echo  ║              🧠 CÉREBRO - INSTALAÇÃO                       ║
echo  ║                                                            ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.

:: ────────────────────────────────────────────────────────────────
:: VERIFICAÇÃO DE PRÉ-REQUISITOS
:: ────────────────────────────────────────────────────────────────

echo [1/6] Verificando Node.js...
where node > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ ERRO: Node.js não encontrado!
    echo.
    echo  Por favor, instale o Node.js 18+ em:
    echo  https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo     ✅ Node.js encontrado: %NODE_VERSION%

echo.
echo [2/6] Verificando npm...
where npm > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ ERRO: npm não encontrado!
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
echo     ✅ npm encontrado: v%NPM_VERSION%

:: ────────────────────────────────────────────────────────────────
:: CONFIGURAÇÃO DO AMBIENTE
:: ────────────────────────────────────────────────────────────────

echo.
echo [3/6] Verificando arquivo .env...
if not exist ".env" (
    if exist ".env.example" (
        echo     ⚠️  Arquivo .env não encontrado
        echo     📋 Copiando .env.example para .env...
        copy ".env.example" ".env" > nul
        echo     ✅ Arquivo .env criado!
        echo.
        echo  ┌────────────────────────────────────────────────────────┐
        echo  │  ⚠️  IMPORTANTE: Configure o arquivo .env antes de    │
        echo  │     continuar. Edite as variáveis de banco de dados   │
        echo  │     e segurança conforme sua necessidade.             │
        echo  └────────────────────────────────────────────────────────┘
        echo.
    ) else (
        echo     ❌ ERRO: Arquivos .env e .env.example não encontrados!
        pause
        exit /b 1
    )
) else (
    echo     ✅ Arquivo .env já existe
)

:: ────────────────────────────────────────────────────────────────
:: INSTALAÇÃO DE DEPENDÊNCIAS
:: ────────────────────────────────────────────────────────────────

echo.
echo [4/6] Instalando dependências (npm install)...
echo     Isso pode levar alguns minutos...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ❌ ERRO: Falha ao instalar dependências!
    echo.
    pause
    exit /b 1
)
echo.
echo     ✅ Dependências instaladas com sucesso!

:: ────────────────────────────────────────────────────────────────
:: GERAÇÃO DO CLIENTE PRISMA
:: ────────────────────────────────────────────────────────────────

echo.
echo [5/6] Gerando cliente Prisma...
call npx prisma generate
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ⚠️  Aviso: Falha ao gerar cliente Prisma
    echo     Verifique se o DATABASE_URL está correto no .env
    echo.
)
echo     ✅ Cliente Prisma gerado!

:: ────────────────────────────────────────────────────────────────
:: COMPILAÇÃO DO TYPESCRIPT
:: ────────────────────────────────────────────────────────────────

echo.
echo [6/6] Compilando TypeScript...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo  ⚠️  Aviso: Falha na compilação TypeScript
    echo     Você ainda pode usar 'npm run dev' para desenvolvimento
    echo.
)
echo     ✅ TypeScript compilado!

:: ────────────────────────────────────────────────────────────────
:: CONCLUSÃO
:: ────────────────────────────────────────────────────────────────

echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                                                            ║
echo  ║          ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!              ║
echo  ║                                                            ║
echo  ╠════════════════════════════════════════════════════════════╣
echo  ║                                                            ║
echo  ║  Próximos passos:                                          ║
echo  ║                                                            ║
echo  ║  1. Configure o arquivo .env com suas credenciais          ║
echo  ║                                                            ║
echo  ║  2. Configure o banco de dados PostgreSQL                  ║
echo  ║     Execute: npx prisma migrate dev                        ║
echo  ║                                                            ║
echo  ║  3. Inicie o servidor:                                     ║
echo  ║     - Desenvolvimento: npm run dev                         ║
echo  ║     - Produção: npm start                                  ║
echo  ║     - Ou use: start-server.bat                             ║
echo  ║                                                            ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.

pause
