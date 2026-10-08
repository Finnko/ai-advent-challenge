import { build } from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(root, 'src/features/telegram-quiz/bot/entry.ts')],
  outfile: resolve(root, 'dist/server/bot/telegram-quiz.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  alias: {
    '@lib': resolve(root, 'src/lib'),
    '@': resolve(root, 'src'),
  },
  sourcemap: false,
  logLevel: 'info',
})
