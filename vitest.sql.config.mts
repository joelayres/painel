import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Testes das funções do banco, em transação desfeita (tests/sql/apoio.ts): seguros no banco de produção.
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/sql/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 30000,
    fileParallelism: false,
  },
}))
