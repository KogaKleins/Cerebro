@echo off
echo ============================================
echo  CRIANDO BANCO DE DADOS CEREBRO
echo ============================================
echo.
echo INSTRUCOES:
echo 1. Informe a senha do PostgreSQL quando solicitado
echo 2. Atualize o arquivo .env com a senha correta
echo.
echo DATABASE_URL="postgresql://postgres:SUA_SENHA@localhost:5432/cerebro?schema=public"
echo.
pause

echo.
echo Criando database 'cerebro'...
psql -U postgres -c "DROP DATABASE IF EXISTS cerebro;"
psql -U postgres -c "CREATE DATABASE cerebro;"

if %errorlevel% equ 0 (
    echo.
    echo ✅ Database 'cerebro' criado com sucesso!
    echo.
    echo PROXIMO PASSO:
    echo 1. Atualize a senha no arquivo .env
    echo 2. Execute: npm run prisma:migrate
    echo.
) else (
    echo.
    echo ❌ Erro ao criar database. Verifique:
    echo - PostgreSQL esta rodando?
    echo - Senha esta correta?
    echo.
)

pause
