/**
 * 🧪 Configuração Global de Testes - Cérebro
 *
 * Este arquivo é executado ANTES de todos os testes.
 * Configura mocks globais e variáveis de ambiente para o ambiente de teste.
 *
 * Estrutura de testes do projeto:
 * - src/__tests__/setup.ts        → Configuração global (este arquivo)
 * - src/services/__tests__/       → Testes unitários dos services
 * - src/validators/__tests__/     → Testes unitários dos validators
 *
 * Scripts disponíveis:
 * - npm test                      → Executa todos os testes
 * - npm run test:watch            → Modo watch
 * - npm run test:coverage         → Relatório de cobertura
 * - npm run test:services         → Apenas testes de services
 * - npm run test:validators       → Apenas testes de validators
 */

import { beforeEach, jest } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock do módulo uuid (ESM não é suportado diretamente pelo Jest)
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-9012',
}));

// Mock do Prisma Client
jest.mock('@prisma/client', () => ({
  __esModule: true,
  PrismaClient: jest.fn(),
}));

export const prismaMock = mockDeep<PrismaClient>() as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(prismaMock);
});

// Configurações globais de ambiente
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/cerebro_test';
