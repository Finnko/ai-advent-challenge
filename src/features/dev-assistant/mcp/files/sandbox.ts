import { isAbsolute, normalize, resolve, sep } from 'node:path'
import {
  isProtectedPath,
  protectedPathError,
} from '../../domain/protected-paths.ts'

export type SandboxPath =
  | { ok: true; absolute: string; relative: string }
  | { ok: false; error: string }

export type Sandbox = {
  root: string
  resolvePath(input: unknown): SandboxPath
}

export function resolveRoot(
  value = process.env.DEV_ASSISTANT_REPO_DIR,
): string {
  const trimmed = value?.trim()
  return trimmed ? resolve(trimmed) : process.cwd()
}

export function createSandbox(root: string): Sandbox {
  const absoluteRoot = resolve(root)
  return {
    root: absoluteRoot,
    resolvePath(input) {
      if (typeof input !== 'string' || input.trim().length === 0) {
        return { ok: false, error: 'Путь обязателен.' }
      }
      const raw = input.trim()
      if (isAbsolute(raw)) {
        return {
          ok: false,
          error: 'Путь должен быть относительным от корня проекта.',
        }
      }
      const relative = normalize(raw).split(sep).join('/').replace(/^\.\//, '')
      if (relative === '..' || relative.startsWith('../')) {
        return { ok: false, error: 'Путь выходит за пределы корня проекта.' }
      }
      if (relative.length === 0) {
        return { ok: false, error: 'Путь обязателен.' }
      }
      if (relative !== '.' && isProtectedPath(relative)) {
        return { ok: false, error: protectedPathError(relative) }
      }
      const absolute =
        relative === '.' ? absoluteRoot : resolve(absoluteRoot, relative)
      if (
        absolute !== absoluteRoot &&
        !absolute.startsWith(absoluteRoot + sep)
      ) {
        return { ok: false, error: 'Путь выходит за пределы корня проекта.' }
      }
      return { ok: true, absolute, relative }
    },
  }
}
