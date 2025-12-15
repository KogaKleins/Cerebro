#!/bin/bash

echo "========================================"
echo "   CÉREBRO - Iniciando Servidor"
echo "========================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verifica se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependências não encontradas. Executando instalação...${NC}"
    echo ""
    ./install.sh
    if [ $? -ne 0 ]; then
        echo -e "${RED}Falha na instalação!${NC}"
        exit 1
    fi
    echo ""
fi

# Inicia o servidor
echo -e "${GREEN}Iniciando servidor...${NC}"
echo ""
echo -e "${BLUE}Servidor rodando em:${NC}"
echo -e "${BLUE}  → http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para parar o servidor${NC}"
echo ""
echo "========================================"
echo ""

node server.js
