/**
 * 🧪 Configuração do Jest - Cérebro
 *
 * Estrutura de testes:
 * ├── src/
 * │   ├── __tests__/
 * │   │   └── setup.ts              ← Configuração global
 * │   ├── services/__tests__/       ← Testes dos services
 * │   └── validators/__tests__/     ← Testes dos validators
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  // Preset para TypeScript
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Localização dos testes
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
  ],

  // Transformar módulos ESM que Jest não consegue processar nativamente
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],

  // Cobertura de código
  collectCoverageFrom: [
    'src/services/**/*.ts',
    'src/validators/**/*.ts',
    'src/middleware/**/*.ts',
    'src/controllers/**/*.ts',
    'src/utils/errors.ts',
    'src/utils/health.ts',
    'src/utils/metrics.ts',
    'src/utils/sentry.ts',
    '!src/**/__tests__/**',
    '!src/services/socket.service.ts', // WebSocket requer testes de integração específicos
  ],
  
  // Thresholds de cobertura para arquivos testados
  // TODO: Expandir conforme mais testes forem adicionados
  coverageThreshold: {
    './src/services/achievement.service.ts': {
      branches: 100,
      functions: 100,
      lines: 90,
      statements: 90,
    },
    './src/services/coffee.service.ts': {
      branches: 80,
      functions: 50,
      lines: 80,
      statements: 80,
    },
    './src/validators/auth.validator.ts': {
      statements: 100,
      lines: 100,
    },
    './src/validators/coffee.validator.ts': {
      statements: 100,
      lines: 100,
    },
    './src/validators/common.validator.ts': {
      statements: 100,
      lines: 100,
    },
  },
  coverageDirectory: 'coverage',

  // Configurações gerais
  verbose: true,
  testTimeout: 10000,

  // Aliases de importação
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Setup global executado antes dos testes
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
