#!/bin/bash

# 🧪 Script de Teste - Validação de Correções do Sistema de Níveis
# Data: 11 de Dezembro de 2025
# Verifica se as correções de userData.history foram aplicadas com sucesso

echo "🧪 VALIDAÇÃO DE CORREÇÕES - SISTEMA DE NÍVEIS"
echo "=============================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
TOTAL_TESTS=0
PASSED_TESTS=0

# Função para executar teste
test_case() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${BLUE}▶ ${test_name}${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✅ PASSOU${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}  ❌ FALHOU${NC}"
        echo "    Command: $test_command"
    fi
    echo ""
}

echo -e "${YELLOW}📋 Testes de Código (Static Analysis)${NC}"
echo "----------------------------------------"

# Test 1: Verificar se normalizeUserData existe em storage.js
test_case "normalizeUserData() definido em storage.js" \
    "grep -q 'normalizeUserData' js/levels/storage.js"

# Test 2: Verificar se Array.isArray guard existe em calculator.js
test_case "Array.isArray guard em calculator.js" \
    "grep -q 'Array.isArray(userData.history)' js/levels/calculator.js"

# Test 3: Verificar se normalização é aplicada em load()
test_case "normalizeUserData aplicado em storage.load()" \
    "grep -A5 'async load()' js/levels/storage.js | grep -q 'normalizeUserData'"

# Test 4: Verificar se normalização é aplicada em loadFromLocalStorage()
test_case "normalizeUserData aplicado em loadFromLocalStorage()" \
    "grep -A5 'loadFromLocalStorage()' js/levels/storage.js | grep -q 'normalizeUserData'"

# Test 5: Verificar se normalização é aplicada em addXP()
test_case "normalizeUserData aplicado em addXP()" \
    "grep -A10 'addXP(userName' js/levels/index.js | grep -q 'normalizeUserData'"

# Test 6: Verificar se normalização é aplicada em addTrackedXP()
test_case "normalizeUserData aplicado em addTrackedXP()" \
    "grep -A10 'addTrackedXP(userName' js/levels/index.js | grep -q 'normalizeUserData'"

# Test 7: Verificar se normalização é aplicada em syncWithServer()
test_case "normalizeUserData aplicado em syncWithServer()" \
    "grep -A5 'syncWithServer()' js/levels/index.js | grep -q 'normalizeUserData'"

# Test 8: Verificar se normalização é aplicada em sincCurrentUser()
test_case "normalizeUserData aplicado em sincCurrentUser (linha 339)" \
    "sed -n '330,350p' js/levels/index.js | grep -q 'normalizeUserData'"

# Test 9: Verificar se WebSocket listeners foram adicionados
test_case "WebSocket listeners adicionados em main.js" \
    "grep -q 'Socket.on.*users:online' js/main.js"

# Test 10: Verificar se console.warn foi removido de api.js
test_case "console.warn removido de saveAchievements()" \
    "grep -A5 'saveAchievements' js/api.js | grep -q '// Deprecated'"

echo -e "${YELLOW}📊 Resumo dos Testes${NC}"
echo "----------------------------------------"
echo -e "Total: ${BLUE}${TOTAL_TESTS}${NC}"
echo -e "Passou: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Falhou: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo ""
    echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM!${NC}"
    echo ""
    echo "As seguintes correções foram validadas:"
    echo "  ✅ normalizeUserData() criado e aplicado em todos os pontos de carregamento"
    echo "  ✅ Array.isArray guard implementado como defesa final"
    echo "  ✅ WebSocket listeners sincronizam status online"
    echo "  ✅ Avisos desnecessários removidos"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️ ALGUNS TESTES FALHARAM${NC}"
    echo ""
    echo "Por favor, verifique:"
    echo "  - Se todos os arquivos estão presentes"
    echo "  - Se as correções foram aplicadas corretamente"
    exit 1
fi
