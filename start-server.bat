@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: ╔══════════════════════════════════════════════════════════════════════════════╗
:: ║                    🧠 CÉREBRO - Iniciar Servidor                             ║
:: ╚══════════════════════════════════════════════════════════════════════════════╝

title 🧠 Cérebro - Servidor

echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                                                            ║
echo  ║              🧠 CÉREBRO - SERVIDOR                         ║
echo  ║                                                            ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.

:: ────────────────────────────────────────────────────────────────
:: VERIFICAÇÕES
:: ────────────────────────────────────────────────────────────────

if not exist "node_modules" (
    echo  ❌ Dependências não instaladas!
    echo.
    echo  Execute primeiro: install.bat
    echo  Ou: npm install
    echo.
    pause
    exit /b 1
)

if not exist ".env" (
    echo  ❌ Arquivo .env não encontrado!
    echo.
    echo  Copie o arquivo .env.example para .env e configure-o.
    echo.
    pause
    exit /b 1
)

:: ────────────────────────────────────────────────────────────────
:: MENU DE OPÇÕES
:: ────────────────────────────────────────────────────────────────

echo  Selecione o modo de execução:
echo.
echo  [1] Desenvolvimento (hot-reload) - Recomendado para dev
echo  [2] Produção - Usar código compilado
echo  [3] Desenvolvimento + Prisma Studio
echo  [4] Apenas Prisma Studio (interface do banco)
echo  [5] Executar migrações do banco
echo.
set /p OPCAO="  Digite a opção (1-5): "

echo.

if "%OPCAO%"=="1" (
    echo  🚀 Iniciando em modo DESENVOLVIMENTO...
    echo.
    echo  ┌────────────────────────────────────────────────────────┐
    echo  │  O servidor irá reiniciar automaticamente quando       │
    echo  │  você salvar alterações nos arquivos TypeScript.       │
    echo  │                                                        │
    echo  │  Pressione Ctrl+C para parar o servidor.               │
    echo  └────────────────────────────────────────────────────────┘
    echo.
    call npm run dev
)

if "%OPCAO%"=="2" (
    echo  🏭 Iniciando em modo PRODUÇÃO...
    echo.
    echo  Compilando TypeScript...
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo  ❌ Erro na compilação!
        pause
        exit /b 1
    )
    echo.
    echo  ✅ Compilação concluída!
    echo  🚀 Iniciando servidor...
    echo.
    call npm start
)

if "%OPCAO%"=="3" (
    echo  🚀 Iniciando Desenvolvimento + Prisma Studio...
    echo.
    start cmd /k "title Prisma Studio && npx prisma studio"
    timeout /t 3 > nul
    call npm run dev
)

if "%OPCAO%"=="4" (
    echo  📊 Abrindo Prisma Studio...
    echo.
    echo  O Prisma Studio abrirá no navegador automaticamente.
    echo  Use para visualizar e editar dados do banco.
    echo.
    call npx prisma studio
)

if "%OPCAO%"=="5" (
    echo  🔄 Executando migrações do banco de dados...
    echo.
    call npx prisma migrate dev
    echo.
    echo  ✅ Migrações aplicadas!
    echo.
    pause
)

if "%OPCAO%"=="" (
    echo  ❌ Opção inválida!
    pause
)
