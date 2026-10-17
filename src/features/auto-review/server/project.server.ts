import type { ServerHandle } from './exec.server'
import { runCommand, startServer } from './exec.server'
import { ReviewCancelledError } from './cancel.server'
import { installTimeoutMs, serveTimeoutMs } from './config.server'

export async function extractProject(
  zipPath: string,
  target: string,
): Promise<void> {
  const result = await runCommand(
    'unzip',
    ['-o', '-q', zipPath, '-d', target],
    {
      cwd: target,
      timeoutMs: 120_000,
    },
  )
  if (result.code !== 0) {
    throw new Error(
      `не удалось распаковать архив: ${result.stderr.trim() || result.stdout.trim()}`,
    )
  }
}

async function hasPackageJson(dir: string): Promise<boolean> {
  const { stat } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  try {
    return (await stat(nodePath.join(dir, 'package.json'))).isFile()
  } catch {
    return false
  }
}

export async function resolveProjectRoot(dir: string): Promise<string> {
  if (await hasPackageJson(dir)) {
    return dir
  }
  const { readdir } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  let entries: string[] = []
  try {
    entries = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return dir
  }
  for (const entry of entries) {
    const candidate = nodePath.join(dir, entry)
    if (await hasPackageJson(candidate)) {
      return candidate
    }
  }
  for (const entry of entries) {
    const nested = nodePath.join(dir, entry)
    const children = await readdir(nested, { withFileTypes: true }).catch(
      () => [],
    )
    for (const child of children) {
      if (!child.isDirectory()) {
        continue
      }
      const candidate = nodePath.join(nested, child.name)
      if (await hasPackageJson(candidate)) {
        return candidate
      }
    }
  }
  return dir
}

type PackageJson = {
  name?: string
  scripts?: Record<string, string>
}

export async function readPackage(root: string): Promise<PackageJson> {
  const { readFile } = await import('node:fs/promises')
  const nodePath = await import('node:path')
  try {
    const raw = await readFile(nodePath.join(root, 'package.json'), 'utf8')
    return JSON.parse(raw) as PackageJson
  } catch {
    return {}
  }
}

export async function readPackageName(root: string): Promise<string> {
  const pkg = await readPackage(root)
  return pkg.name && pkg.name.trim().length > 0
    ? pkg.name.trim()
    : 'unknown-project'
}

export async function installDependencies(
  root: string,
  onLine: (line: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const result = await runCommand(
    'npm',
    ['install', '--no-audit', '--no-fund'],
    { cwd: root, timeoutMs: installTimeoutMs(), onLine, signal },
  )
  if (result.aborted) {
    throw new ReviewCancelledError()
  }
  if (result.timedOut) {
    throw new Error('установка зависимостей превысила лимит времени')
  }
  if (result.code !== 0) {
    throw new Error(
      `npm install завершился с ошибкой: ${result.stderr.trim().slice(-400)}`,
    )
  }
}

export async function startDevServer(
  root: string,
  onLine: (line: string) => void,
  signal?: AbortSignal,
): Promise<ServerHandle> {
  const pkg = await readPackage(root)
  const scripts = pkg.scripts ?? {}
  let script: string | null = null
  if ('start' in scripts) {
    script = 'start'
  } else if ('dev' in scripts) {
    script = 'dev'
  }
  if (!script) {
    throw new Error('в package.json нет скрипта start или dev')
  }
  const args = script === 'start' ? ['start'] : ['run', script]
  return startServer('npm', args, {
    cwd: root,
    env: { BROWSER: 'none', CI: '1' },
    onLine,
    signal,
    urlTimeoutMs: serveTimeoutMs(),
  })
}
