import { build } from 'esbuild'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'dist/server/llm-service')
const outfile = resolve(outDir, 'llm-service.mjs')

await build({
  entryPoints: [resolve(root, 'src/features/llm-service/entry.ts')],
  outfile,
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

await mkdir(outDir, { recursive: true })
await copyFile(
  resolve(root, 'src/features/llm-service/web/index.html'),
  resolve(outDir, 'index.html'),
)
