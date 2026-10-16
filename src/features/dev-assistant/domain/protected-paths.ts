export const PROTECTED_DIRS = ['.git', '.github', 'node_modules', 'dist']

const PROTECTED_FILES = [/^\.env(\.|$)/i, /\.sqlite$/i]

export function pathSegments(relative: string): string[] {
  return relative.split(/[\\/]+/).filter((part) => part.length > 0)
}

export function isProtectedPath(relative: string): boolean {
  const parts = pathSegments(relative)
  if (parts.some((part) => PROTECTED_DIRS.includes(part))) {
    return true
  }
  const base = parts.at(-1) ?? ''
  return PROTECTED_FILES.some((pattern) => pattern.test(base))
}

export function protectedPathError(relative: string): string {
  return `Путь «${relative}» в запрещённой зоне (${PROTECTED_DIRS.join(', ')}, .env*, *.sqlite).`
}
