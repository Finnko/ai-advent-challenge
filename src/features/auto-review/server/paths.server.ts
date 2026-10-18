import { resolveStorePath } from '@lib/rag-engine.server'

export function safeKey(key: string): string {
  const slug = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug.length > 0 ? slug : 'project'
}

export async function baseDir(): Promise<string> {
  const nodePath = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const dbPath = await resolveStorePath(
    'AUTO_REVIEW_DB_PATH',
    'auto-review.sqlite',
  )
  const dir = nodePath.join(nodePath.dirname(dbPath), 'auto-review')
  await mkdir(dir, { recursive: true })
  return dir
}

export async function reviewDir(reviewId: number): Promise<string> {
  const nodePath = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const dir = nodePath.join(await baseDir(), 'reviews', String(reviewId))
  await mkdir(dir, { recursive: true })
  return dir
}

export async function uploadPath(
  key: string,
  reviewId: number,
): Promise<string> {
  const nodePath = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const dir = nodePath.join(await baseDir(), 'uploads', safeKey(key))
  await mkdir(dir, { recursive: true })
  return nodePath.join(dir, `${reviewId}.zip`)
}

export async function projectPath(reviewId: number): Promise<string> {
  const nodePath = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const dir = nodePath.join(await reviewDir(reviewId), 'project')
  await mkdir(dir, { recursive: true })
  return dir
}

export async function artifactsPath(reviewId: number): Promise<string> {
  const nodePath = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const dir = nodePath.join(await reviewDir(reviewId), 'artifacts')
  await mkdir(dir, { recursive: true })
  return dir
}

export async function removePath(target: string): Promise<void> {
  const { rm } = await import('node:fs/promises')
  await rm(target, { recursive: true, force: true })
}
