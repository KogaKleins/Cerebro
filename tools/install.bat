@echo off
echo ========================================
echo    CEREBRO - Script de Instalacao
echo ========================================
echo.

:: Verifica se o Node.js esta instalado
echo [1/4] Verificando Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] Node.js nao encontrado!
    echo.
    echo Por favor, instale o Node.js primeiro:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Exibe versao do Node.js
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Node.js %NODE_VERSION% encontrado!
echo.

:: Verifica se o npm esta instalado
echo [2/4] Verificando npm...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] npm nao encontrado!
    echo.
    pause
    exit /b 1
)

:: Exibe versao do npm
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo npm %NPM_VERSION% encontrado!
echo.

:: Instala as dependencias
echo [3/4] Instalando dependencias...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo [4/4] Instalacao concluida com sucesso!
echo.
echo ========================================
echo   Instalacao Completa!
echo ========================================
echo.
echo Para iniciar o servidor, execute:
echo   - start-server.bat
echo.
echo Ou manualmente:
echo   - npm start
echo.
pause
