import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Testes que rodam contra o Supabase do .env.local, que é o de produção: a trava (tests/integracao/trava.ts)
// impede a execução quando já existem vagas reais.
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/integracao/**/*.test.ts'],
    globalSetup: ['tests/integracao/trava.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
}))
