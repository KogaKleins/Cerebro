@echo off
REM ============================================
REM    CEREBRO - Servidor Local
REM    Sistema do Setor Mais Inteligente
REM ============================================

title Cerebro - Servidor Local (Porta 3000)

REM Mudar para o diretório raiz do projeto (um nível acima de tools)
cd /d "%~dp0\.."

echo.
echo  ======================================
echo       CEREBRO - Servidor Local
echo  ======================================
echo.

REM Verificar se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [ERRO] Node.js nao encontrado!
    echo.
    echo  Por favor, instale o Node.js:
    echo  https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Verificar se as dependências estão instaladas
if not exist "node_modules" (
    echo  Instalando dependencias...
    echo.
    npm install
    echo.
)

echo  Compilando TypeScript...
echo.
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERRO] Falha na compilacao do TypeScript!
    echo.
    pause
    exit /b 1
)
echo.

echo  Iniciando servidor...
echo  Pressione Ctrl+C para parar o servidor
echo.

REM Usar 'call' para manter a janela aberta
node dist\server.js

REM Se o servidor parar, manter a janela aberta
echo.
echo  Servidor encerrado.
pause
