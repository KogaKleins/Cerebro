# 🤝 Guia de Contribuição

Obrigado pelo interesse em contribuir com o **Cérebro**! Este documento explica como você pode participar do desenvolvimento.

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Padrões de Código](#padrões-de-código)
- [Commits](#commits)
- [Pull Requests](#pull-requests)

## 📜 Código de Conduta

- Seja respeitoso e inclusivo
- Aceite críticas construtivas
- Foque no que é melhor para o projeto
- Mostre empatia com outros membros

## 🚀 Como Contribuir

### 1. Fork e Clone

```bash
# Fork o repositório (via GitHub)

# Clone seu fork
git clone https://github.com/seu-usuario/cerebro.git
cd cerebro

# Adicione o repositório original como upstream
git remote add upstream https://github.com/original/cerebro.git
```

### 2. Configure o Ambiente

```bash
# Instale as dependências
npm install

# Configure o ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Execute as migrações
npx prisma migrate dev

# Inicie em modo desenvolvimento
npm run dev
```

### 3. Crie uma Branch

```bash
# Atualize a main
git checkout main
git pull upstream main

# Crie uma branch para sua feature/fix
git checkout -b feature/minha-feature
# ou
git checkout -b fix/meu-fix
```

### 4. Faça suas Alterações

- Escreva código limpo e documentado
- Adicione testes quando apropriado
- Siga os padrões de código do projeto

### 5. Teste

```bash
# Execute os testes
npm test

# Verifique tipos TypeScript
npm run type-check
```

### 6. Commit e Push

```bash
git add .
git commit -m "feat: adiciona nova funcionalidade X"
git push origin feature/minha-feature
```

### 7. Abra um Pull Request

- Vá ao GitHub e abra um PR para a branch `main`
- Descreva suas alterações claramente
- Referencie issues relacionadas

## 📏 Padrões de Código

### TypeScript

```typescript
// ✅ Bom - Tipos explícitos
function calcularXP(valor: number, multiplicador: number): number {
  return valor * multiplicador;
}

// ❌ Evitar - Tipos implícitos
function calcularXP(valor, multiplicador) {
  return valor * multiplicador;
}
```

### Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Variáveis | camelCase | `userName`, `totalXP` |
| Funções | camelCase | `getUserById`, `calculateLevel` |
| Classes | PascalCase | `UserService`, `CoffeeRepository` |
| Constantes | UPPER_SNAKE_CASE | `MAX_LEVEL`, `API_TIMEOUT` |
| Arquivos | kebab-case | `user.service.ts`, `auth.middleware.ts` |

### Estrutura de Arquivos

```typescript
// 1. Imports externos
import express from 'express';
import { PrismaClient } from '@prisma/client';

// 2. Imports internos
import { UserRepository } from '../repositories';
import { logger } from '../utils/logger';

// 3. Types/Interfaces
interface UserData {
  id: string;
  name: string;
}

// 4. Constantes
const MAX_RETRIES = 3;

// 5. Implementação
export class UserService {
  // ...
}
```

## 💬 Commits

Usamos commits semânticos. Formato:

```
<tipo>: <descrição curta>

[corpo opcional]

[rodapé opcional]
```

### Tipos de Commit

| Tipo | Descrição |
|------|-----------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `docs` | Documentação |
| `style` | Formatação (não afeta código) |
| `refactor` | Refatoração |
| `test` | Testes |
| `chore` | Manutenção |

### Exemplos

```bash
# Feature
git commit -m "feat: adiciona sistema de notificações push"

# Fix
git commit -m "fix: corrige cálculo de XP duplicado"

# Docs
git commit -m "docs: atualiza README com instruções de instalação"

# Refactor
git commit -m "refactor: simplifica lógica de autenticação"
```

## 🔄 Pull Requests

### Checklist

Antes de abrir um PR, verifique:

- [ ] Código segue os padrões do projeto
- [ ] Testes passam (`npm test`)
- [ ] TypeScript compila sem erros (`npm run type-check`)
- [ ] Documentação atualizada (se necessário)
- [ ] Branch está atualizada com a main

### Template de PR

```markdown
## Descrição
[Descreva suas alterações]

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova feature
- [ ] Breaking change
- [ ] Documentação

## Testes
[Descreva os testes realizados]

## Screenshots (se aplicável)
[Adicione screenshots]

## Issues Relacionadas
Fixes #123
```

## ❓ Dúvidas?

Se tiver dúvidas sobre como contribuir:

1. Verifique a documentação existente
2. Procure issues similares
3. Abra uma issue com sua pergunta

---

**Obrigado por contribuir! 🎉**
