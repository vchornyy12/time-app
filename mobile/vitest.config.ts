import { defineConfig } from 'vitest/config'
import path from 'node:path'
export default defineConfig({
  root: path.resolve(__dirname),
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['lib/**/*.test.ts'], clearMocks: true },
})
