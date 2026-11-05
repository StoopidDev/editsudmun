import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Tests run against the dev project; credentials come from supabase/.env (gitignored).
export default defineConfig(({ mode }) => ({
  test: {
    env: loadEnv(mode, process.cwd(), ''),
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
}))
