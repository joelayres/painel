import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Testes que rodam contra o projeto Supabase de desenvolvimento (.env.local).
export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/integracao/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
}))
