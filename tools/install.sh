#!/bin/bash

echo "========================================"
echo "   CÉREBRO - Script de Instalação"
echo "========================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica se o Node.js está instalado
echo -e "${YELLOW}[1/4] Verificando Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERRO] Node.js não encontrado!${NC}"
    echo ""
    echo "Por favor, instale o Node.js primeiro:"
    echo "  - Ubuntu/Debian: sudo apt install nodejs npm"
    echo "  - Fedora: sudo dnf install nodejs npm"
    echo "  - Arch: sudo pacman -S nodejs npm"
    echo "  - Ou baixe de: https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js $NODE_VERSION encontrado!${NC}"
echo ""

# Verifica se o npm está instalado
echo -e "${YELLOW}[2/4] Verificando npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERRO] npm não encontrado!${NC}"
    echo ""
    exit 1
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}npm $NPM_VERSION encontrado!${NC}"
echo ""

# Instala as dependências
echo -e "${YELLOW}[3/4] Instalando dependências...${NC}"
echo ""
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[ERRO] Falha ao instalar dependências!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[4/4] Instalação concluída com sucesso!${NC}"
echo ""
echo "========================================"
echo "   Instalação Completa!"
echo "========================================"
echo ""
echo "Para iniciar o servidor, execute:"
echo "  - ./start-server.sh"
echo ""
echo "Ou manualmente:"
echo "  - npm start"
echo ""
