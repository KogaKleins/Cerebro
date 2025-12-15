@echo off
echo ============================================
echo  INSTALACAO - WebSockets, TypeScript ^& Monitoramento
echo  Sistema Cerebro
echo ============================================
echo.

echo [1/6] Instalando dependencias TypeScript...
call npm install --save-dev typescript @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/cors ts-node nodemon rimraf

echo.
echo [2/6] Instalando Socket.io...
call npm install socket.io
call npm install --save-dev @types/socket.io

echo.
echo [3/6] Instalando sistema de logging...
call npm install winston winston-daily-rotate-file

echo.
echo [4/6] Criando estrutura de pastas...
if not exist "src\types" mkdir src\types
if not exist "src\utils" mkdir src\utils
if not exist "src\services" mkdir src\services
if not exist "src\middleware" mkdir src\middleware
if not exist "logs" mkdir logs
if not exist "dist" mkdir dist

echo.
echo [5/6] Testando compilacao TypeScript...
call npx tsc --version
call npm run build

echo.
echo [6/6] Validando instalacao...
if exist "dist\services\socket.service.js" (
    echo   [OK] TypeScript compilado com sucesso
) else (
    echo   [AVISO] Alguns arquivos TypeScript podem nao ter compilado
)

if exist "logs" (
    echo   [OK] Pasta de logs criada
) else (
    echo   [ERRO] Pasta de logs nao encontrada
)

if exist "tsconfig.json" (
    echo   [OK] tsconfig.json encontrado
) else (
    echo   [ERRO] tsconfig.json nao encontrado
)

echo.
echo Arquivos TypeScript compilados:
if exist "dist" (
    dir dist\*.js /s /b 2>nul | find /c ".js" > temp_count.txt
    set /p JS_COUNT=<temp_count.txt
    del temp_count.txt
    echo   - Arquivos JavaScript gerados
) else (
    echo   [AVISO] Pasta dist nao encontrada
)

echo.
echo ============================================
echo  INSTALACAO CONCLUIDA!
echo ============================================
echo.
echo Proximos passos:
echo   1. Execute: npm run dev
echo   2. Acesse: http://localhost:3000
echo   3. Consulte: PLANO-IMPLEMENTACAO.md
echo.
pause
