import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

export type Sandbox = {
  pathFor: (name: string) => string
  readFile: (name: string) => Promise<string>
  readJson: <T>(name: string) => Promise<T>
}

export function createSandbox(root: string): Sandbox {
  const absoluteRoot = resolve(root)

  function pathFor(name: string): string {
    const path = resolve(absoluteRoot, name)
    if (path !== absoluteRoot && !path.startsWith(`${absoluteRoot}${sep}`)) {
      throw new Error('Путь вне каталога фикстур.')
    }
    return path
  }

  return {
    pathFor,
    readFile: (name) => readFile(pathFor(name), 'utf8'),
    async readJson<T>(name: string): Promise<T> {
      return JSON.parse(await readFile(pathFor(name), 'utf8')) as T
    },
  }
}
