import { execFile } from 'node:child_process'
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  mkdir,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ARCHIVE_URL =
  'https://codeload.github.com/Livingbeside/mp-docs-mirror/tar.gz/master'
const COMMIT_URL =
  'https://api.github.com/repos/Livingbeside/mp-docs-mirror/commits/master'
const CACHE_DIR = join(process.cwd(), '.cache', 'ozon-corpus')
const MARKER = join(CACHE_DIR, '.fetched')

async function resolveCommit() {
  try {
    const response = await fetch(COMMIT_URL, {
      headers: { 'User-Agent': 'ai-advent-challenge' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) {
      return 'master'
    }
    const payload = await response.json()
    return typeof payload.sha === 'string' ? payload.sha : 'master'
  } catch {
    return 'master'
  }
}

async function downloadArchive(target) {
  const response = await fetch(ARCHIVE_URL, {
    signal: AbortSignal.timeout(180_000),
  })
  if (!response.ok) {
    throw new Error(`Не удалось скачать зеркало: HTTP ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(target, buffer)
}

async function extract(archive) {
  const work = await mkdtemp(join(tmpdir(), 'ozon-corpus-'))
  await run('tar', ['-xzf', archive, '-C', work])
  const [top] = await readdir(work)
  if (!top) {
    throw new Error('Архив зеркала пуст.')
  }
  await mkdir(join(CACHE_DIR, 'ozon', 'api', 'seller'), { recursive: true })
  await cp(join(work, top, 'ozon', 'kb'), join(CACHE_DIR, 'ozon', 'kb'), {
    recursive: true,
  })
  await cp(
    join(work, top, 'ozon', 'api', 'seller', 'guides'),
    join(CACHE_DIR, 'ozon', 'api', 'seller', 'guides'),
    { recursive: true },
  )
  await rm(work, { recursive: true, force: true })
}

async function main() {
  const force = process.argv.includes('--force')
  if (!force) {
    try {
      const marker = await readFile(MARKER, 'utf8')
      console.log(`Корпус уже скачан: ${marker.trim()}. Используйте --force.`)
      return
    } catch {
      console.log('Маркер корпуса не найден, скачиваю заново.')
    }
  }

  console.log('Скачиваю зеркало mp-docs-mirror…')
  const commit = await resolveCommit()
  const archive = join(tmpdir(), `ozon-corpus-${process.pid}.tar.gz`)
  try {
    await downloadArchive(archive)
    await rm(CACHE_DIR, { recursive: true, force: true })
    await mkdir(CACHE_DIR, { recursive: true })
    await extract(archive)
    await writeFile(MARKER, `${commit}\n`)
    console.log(`Корпус готов: ${CACHE_DIR} (${commit})`)
  } finally {
    await rm(archive, { force: true })
  }
}

await main()
