export const DEFAULT_STORE_DIR = '.ai-advent-challenge'

export async function resolveStorePath(
  envVar: string,
  filename: string,
): Promise<string> {
  const nodePath = await import('node:path')
  const override = process.env[envVar]?.trim()
  if (override) {
    const resolved = nodePath.resolve(override)
    const { stat } = await import('node:fs/promises')
    try {
      if ((await stat(resolved)).isDirectory()) {
        return nodePath.join(resolved, filename)
      }
    } catch {
      return resolved
    }
    return resolved
  }
  const os = await import('node:os')
  return nodePath.join(os.homedir(), DEFAULT_STORE_DIR, filename)
}
