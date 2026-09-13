import { createServerFn } from '@tanstack/react-start'

export const readBrief = createServerFn({ method: 'GET' }).handler(async () => {
  const fs = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const filePath = nodePath.resolve(process.cwd(), 'md', 'design', 'brief.md')
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    throw new Error(
      'Файл md/design/brief.md не найден. Создай его рядом с дизайн-доком магазина.',
    )
  }
})
