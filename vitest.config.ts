import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), 'src')

export default defineConfig({
  resolve: {
    alias: [
      { find: '@lib', replacement: resolve(srcDir, 'lib') },
      { find: '@', replacement: srcDir },
    ],
  },
  test: {
    environment: 'node',
  },
})
