import { build } from 'esbuild'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ENTRIES = [
  ['src/features/agent/mcp/server.ts', 'dist/server/mcp/mcp-demo.mjs'],
  ['src/features/agent/mcp/jobs/server.ts', 'dist/server/mcp/mcp-jobs.mjs'],
  [
    'src/features/agent/mcp/research/server.ts',
    'dist/server/mcp/mcp-research.mjs',
  ],
  ['src/features/agent/mcp/market/server.ts', 'dist/server/mcp/mcp-market.mjs'],
]

for (const [entry, outfile] of ENTRIES) {
  await build({
    entryPoints: [resolve(root, entry)],
    outfile: resolve(root, outfile),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    packages: 'external',
    sourcemap: false,
    logLevel: 'info',
  })
}
