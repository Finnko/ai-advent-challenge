// Runtime alias/extension resolver for TypeScript sources executed by Node.
//
// Vite and TypeScript resolve `@/`, `@lib/` and extensionless imports; Node
// resolves none of them. MCP servers are spawned as child processes
// (`node server.ts`) in dev and tests, so this hook teaches Node the same
// resolution — including the common TypeScript extensions. It is only passed
// to entries that resolve to a `.ts` source; compiled `.mjs` bundles are
// self-contained and do not need it.
import { statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

const ALIASES = [
  ['@lib/', 'lib/'],
  ['@/', ''],
]

const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js']

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function withExtensions(base) {
  if (isFile(base)) {
    return base
  }
  for (const ext of EXTENSIONS) {
    if (isFile(base + ext)) {
      return base + ext
    }
  }
  for (const ext of EXTENSIONS) {
    const index = resolve(base, `index${ext}`)
    if (isFile(index)) {
      return index
    }
  }
  return null
}

function resolveSpecifier(specifier, parentURL) {
  for (const [prefix, target] of ALIASES) {
    if (specifier.startsWith(prefix)) {
      return withExtensions(
        resolve(srcRoot, target + specifier.slice(prefix.length)),
      )
    }
  }
  if (specifier.startsWith('.') && parentURL) {
    try {
      const parentPath = fileURLToPath(parentURL)
      return withExtensions(resolve(dirname(parentPath), specifier))
    } catch {
      return null
    }
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = resolveSpecifier(specifier, context.parentURL)
    if (mapped) {
      return { url: pathToFileURL(mapped).href, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})
