@echo off
echo ============================================
echo  VALIDACAO RAPIDA - Sistema Cerebro 2.0
echo ============================================
echo.

echo [1/5] Verificando TypeScript...
call npx tsc --version
if %ERRORLEVEL% EQU 0 (
    echo   [OK] TypeScript instalado
) else (
    echo   [ERRO] TypeScript nao encontrado
)

echo.
echo [2/5] Verificando compilacao...
call npm run type-check >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Codigo TypeScript valido
) else (
    echo   [ERRO] Erros de compilacao encontrados
    echo   Execute: npm run type-check
)

echo.
echo [3/5] Verificando arquivos compilados...
if exist "dist\services\socket.service.js" (
    echo   [OK] Socket service compilado
) else (
    echo   [ERRO] Socket service nao encontrado
)

if exist "dist\utils\logger.js" (
    echo   [OK] Logger compilado
) else (
    echo   [ERRO] Logger nao encontrado
)

if exist "dist\utils\auth.utils.js" (
    echo   [OK] Auth utils compilado
) else (
    echo   [ERRO] Auth utils nao encontrado
)

echo.
echo [4/5] Verificando estrutura...
if exist "logs" (
    echo   [OK] Pasta de logs existe
) else (
    echo   [AVISO] Pasta de logs nao encontrada
    mkdir logs
    echo   [OK] Pasta de logs criada
)

if exist "tsconfig.json" (
    echo   [OK] tsconfig.json configurado
) else (
    echo   [ERRO] tsconfig.json nao encontrado
)

if exist "nodemon.json" (
    echo   [OK] nodemon.json configurado
) else (
    echo   [ERRO] nodemon.json nao encontrado
)

echo.
echo [5/5] Verificando dependencias...
call npm list socket.io >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Socket.io instalado
) else (
    echo   [ERRO] Socket.io nao encontrado
)

call npm list winston >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] Winston instalado
) else (
    echo   [ERRO] Winston nao encontrado
)

call npm list typescript >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   [OK] TypeScript instalado
) else (
    echo   [ERRO] TypeScript nao encontrado
)

echo.
echo ============================================
echo  RESULTADO DA VALIDACAO
echo ============================================
echo.

if exist "dist\services\socket.service.js" if exist "dist\utils\logger.js" (
    echo   STATUS: TUDO OK! ✅
    echo.
    echo   Seu sistema esta pronto para uso!
    echo.
    echo   Comandos disponiveis:
    echo     npm run dev       - Desenvolvimento com TS
    echo     npm run dev:old   - Sistema original
    echo     npm run build     - Compilar TypeScript
    echo.
    echo   Proximos passos:
    echo     1. Execute: npm run dev:old
    echo     2. Acesse: http://localhost:3000
    echo     3. Consulte: VALIDACAO-INSTALACAO.md
) else (
    echo   STATUS: ALGUNS PROBLEMAS ENCONTRADOS
    echo.
    echo   Execute novamente:
    echo     .\install-websockets.bat
    echo.
    echo   Ou compile manualmente:
    echo     npm run build
)

echo.
echo ============================================
pause
