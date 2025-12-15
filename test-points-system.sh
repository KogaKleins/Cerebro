#!/bin/bash

# Script de teste do Sistema Centralizado de Pontos
# Demonstra todas as funcionalidades

echo "🎮 TESTE DO SISTEMA CENTRALIZADO DE PONTOS"
echo "==========================================="
echo ""

API="http://localhost:3000/api/v2/admin"

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}1. Obtendo Resumo do Sistema${NC}"
echo "---"
curl -s "$API/xp-audit/summary" | jq '.' | head -20
echo ""
echo ""

echo -e "${BLUE}2. Procurando Duplicatas${NC}"
echo "---"
curl -s "$API/xp-audit/duplicates" | jq '.'
echo ""
echo ""

echo -e "${BLUE}3. Validando Usuário (Wilmar)${NC}"
echo "---"
# Primeiro, precisamos encontrar o ID do Wilmar
# Isso é apenas um exemplo - você precisa ajustar o ID
curl -s "$API/xp-audit?username=wilmar" | jq '.currentBalance, .currentLevel, .totalTransactions' 2>/dev/null || echo "Usuário não encontrado ou sistema não tem dados"
echo ""
echo ""

echo -e "${GREEN}✅ Testes Concluídos${NC}"
echo ""
echo -e "${YELLOW}Próximos passos:${NC}"
echo "1. Acesse o sistema com usuário admin:"
echo "   http://localhost:3000"
echo ""
echo "2. Navegue para Administração > Auditoria XP"
echo "   - TAB Resumo: Ver estatísticas gerais"
echo "   - TAB Auditoria: Buscar usuário 'wilmar' ou 'renan'"
echo "   - TAB Integridade: Validar todos os usuários"
echo ""
echo "3. Faça uma ação (fazer café) e veja os pontos sendo registrados"
echo "   com auditoria completa no painel!"
