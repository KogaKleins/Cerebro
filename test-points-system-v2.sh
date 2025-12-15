#!/bin/bash

# 🧪 SCRIPT DE TESTES DO SISTEMA DE PONTOS
# Valida que o sistema está funcionando corretamente sem duplicação de XP

echo "🔧 INICIANDO TESTES DO SISTEMA DE PONTOS"
echo "=========================================="

API_BASE="http://localhost:3000/api"
ADMIN_TOKEN="${ADMIN_TOKEN}"  # Definir variável de ambiente

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Erro: ADMIN_TOKEN não definido"
  echo "   Execute: export ADMIN_TOKEN='seu-token-aqui'"
  exit 1
fi

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
passed=0
failed=0

# Função para teste
run_test() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  local expected_status=$5

  test_count=$((test_count + 1))
  echo ""
  echo -n "[$test_count] $name... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      "$API_BASE$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$API_BASE$endpoint")
  fi

  # Último linha é o status code
  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✅ PASSOU${NC} (HTTP $status_code)"
    passed=$((passed + 1))
  else
    echo -e "${RED}❌ FALHOU${NC} (esperado $expected_status, recebido $status_code)"
    echo "   Resposta: $body"
    failed=$((failed + 1))
  fi
}

echo ""
echo "📋 TESTES DE INTEGRIDADE"
echo "========================"

# Teste 1: Validar integridade de XP
run_test "Validação de integridade XP" \
  "POST" \
  "/v2/admin/validate-integrity" \
  "" \
  "200"

# Teste 2: Verificar duplicações
run_test "Verificar duplicações de níveis" \
  "GET" \
  "/v2/admin/check-duplicates" \
  "" \
  "200"

# Teste 3: Recalcular níveis
run_test "Recalcular todos os níveis" \
  "POST" \
  "/v2/admin/recalculate-levels" \
  "" \
  "200"

echo ""
echo "📊 TESTES DE AUDITORIA"
echo "====================="

# Teste 4: Ver audit logs do admin
run_test "Buscar audit logs do admin" \
  "GET" \
  "/v2/admin/audit-logs/admin" \
  "" \
  "200"

# Teste 5: Ver audit do usuário
run_test "Buscar auditoria do usuário atual" \
  "GET" \
  "/v2/users/admin/audit" \
  "" \
  "200"

echo ""
echo "📈 RESUMO"
echo "========="
echo "Total de testes: $test_count"
echo -e "Aprovados: ${GREEN}$passed${NC}"
if [ $failed -gt 0 ]; then
  echo -e "Reprovados: ${RED}$failed${NC}"
else
  echo -e "Reprovados: ${GREEN}0${NC}"
fi

if [ $failed -eq 0 ]; then
  echo -e "\n${GREEN}✅ TODOS OS TESTES PASSARAM!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ ALGUNS TESTES FALHARAM!${NC}"
  exit 1
fi
