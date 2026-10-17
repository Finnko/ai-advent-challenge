export type SourceFile = {
  path: string
  content: string
}

export function isCodeFile(path: string): boolean {
  return /\.tsx?$/.test(path) && !path.endsWith('.d.ts')
}

export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(path)
}

export function isComponentFile(path: string): boolean {
  return path.endsWith('.tsx') && !isTestFile(path)
}

export function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

export function dirName(path: string): string {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

export function lineOf(content: string, index: number): number {
  let line = 1
  for (let cursor = 0; cursor < index && cursor < content.length; cursor += 1) {
    if (content[cursor] === '\n') {
      line += 1
    }
  }
  return line
}

export function location(file: SourceFile, index: number): string {
  return `${file.path}:${lineOf(file.content, index)}`
}
