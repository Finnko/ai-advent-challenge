import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), 'src')

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      { find: '@lib', replacement: resolve(srcDir, 'lib') },
      { find: '@', replacement: srcDir },
    ],
  },
  preview: {
    allowedHosts: true,
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
