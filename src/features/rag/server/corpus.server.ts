import type { CityEntry } from '../data/cities'
import { WIKI_CITIES } from '../data/cities'
import type { CorpusRef, CorpusSource } from '../domain/corpus'
import type { RawDoc } from '../domain/types'

const DEFAULT_DIR_NAME = '.ai-advent-challenge'
const CORPUS_DIR_NAME = 'rag-corpus'
const DEFAULT_CONTACT = 'https://github.com/Finnko/ai-advent-challenge'
const RETRYABLE_STATUS = new Set([429, 503])
const MAX_ATTEMPTS = 4
const FALLBACK_RETRY_DELAY_MS = 5000
const MAX_RETRY_DELAY_MS = 60000

const SNAPSHOT_LOADERS = import.meta.glob('../data/corpus/*.txt', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

const SNAPSHOT_BY_ID = new Map<string, () => Promise<string>>()
for (const [key, loader] of Object.entries(SNAPSHOT_LOADERS)) {
  const match = /([^/]+)\.txt$/.exec(key)
  if (match) {
    SNAPSHOT_BY_ID.set(match[1], loader)
  }
}

export function wikiSourceUrl(title: string, lang = 'ru'): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

export function wikiUserAgent(): string {
  const contact = process.env.RAG_WIKI_CONTACT?.trim() || DEFAULT_CONTACT
  return `ai-advent-challenge-rag/1.0 (${contact})`
}

export async function resolveCorpusDir(): Promise<string> {
  const nodePath = await import('node:path')
  const override = process.env.RAG_CORPUS_DIR?.trim()
  if (override) {
    return nodePath.resolve(override)
  }
  const os = await import('node:os')
  return nodePath.join(os.homedir(), DEFAULT_DIR_NAME, CORPUS_DIR_NAME)
}

export type WikiCorpusOptions = {
  cities?: CityEntry[]
  dir: string
  lang?: string
  fetchImpl?: typeof fetch
}

type WikiResponse = {
  query?: { pages?: { extract?: string; title?: string }[] }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null
  }
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }
  const date = Date.parse(value)
  if (Number.isFinite(date)) {
    return Math.max(0, date - Date.now())
  }
  return null
}

function retryDelayMs(res: Response, attempt: number): number {
  const header = parseRetryAfter(res.headers.get('retry-after'))
  const base = header ?? FALLBACK_RETRY_DELAY_MS * 2 ** attempt
  return Math.min(base, MAX_RETRY_DELAY_MS) + Math.random() * 250
}

function parseExtract(json: WikiResponse, title: string): string {
  const page = json.query?.pages?.[0]
  if (!page || typeof page.extract !== 'string' || page.extract.trim() === '') {
    throw new Error(`Wikipedia не вернула текст для «${title}»`)
  }
  return page.extract
}

async function loadSnapshot(id: string): Promise<string | null> {
  const loader = SNAPSHOT_BY_ID.get(id)
  if (!loader) {
    return null
  }
  return loader()
}

async function readCache(path: string): Promise<string | null> {
  const fs = await import('node:fs/promises')
  try {
    return await fs.readFile(path, 'utf8')
  } catch {
    return null
  }
}

export function createWikiCorpusSource(
  options: WikiCorpusOptions,
): CorpusSource {
  const cities = options.cities ?? WIKI_CITIES
  const lang = options.lang ?? 'ru'
  const doFetch = options.fetchImpl ?? fetch
  const refs: CorpusRef[] = cities.map((city) => ({
    id: city.id,
    title: city.title,
    source: wikiSourceUrl(city.title, lang),
  }))

  const cachePath = async (id: string): Promise<string> => {
    const nodePath = await import('node:path')
    return nodePath.join(options.dir, `${id}.txt`)
  }

  const fetchDoc = async (ref: CorpusRef): Promise<string> => {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      prop: 'extracts',
      explaintext: '1',
      redirects: '1',
      titles: ref.title,
    })
    const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`
    for (let attempt = 0; ; attempt += 1) {
      const res = await doFetch(url, {
        headers: {
          'User-Agent': wikiUserAgent(),
        },
      })
      if (res.ok) {
        return parseExtract((await res.json()) as WikiResponse, ref.title)
      }
      const isLast = attempt >= MAX_ATTEMPTS - 1
      if (!isLast && RETRYABLE_STATUS.has(res.status)) {
        await sleep(retryDelayMs(res, attempt))
        continue
      }
      throw new Error(`Wikipedia API ${res.status} для «${ref.title}»`)
    }
  }

  return {
    async list() {
      return refs
    },
    async load(ref) {
      const path = await cachePath(ref.id)
      let text = await readCache(path)
      if (text === null) {
        text = await loadSnapshot(ref.id)
      }
      if (text === null) {
        const fs = await import('node:fs/promises')
        const nodePath = await import('node:path')
        text = await fetchDoc(ref)
        await fs.mkdir(nodePath.dirname(path), { recursive: true })
        await fs.writeFile(path, text, 'utf8')
      }
      const doc: RawDoc = {
        id: ref.id,
        title: ref.title,
        source: ref.source,
        text,
      }
      return doc
    },
  }
}

export type CorpusDocStatus = {
  id: string
  title: string
  source: string
  cached: boolean
  charCount: number | null
}

export async function listCorpusStatus(
  dir?: string,
  cities: CityEntry[] = WIKI_CITIES,
): Promise<CorpusDocStatus[]> {
  const nodePath = await import('node:path')
  const baseDir = dir ?? (await resolveCorpusDir())
  const statuses: CorpusDocStatus[] = []
  for (const city of cities) {
    const path = nodePath.join(baseDir, `${city.id}.txt`)
    const cached = await readCache(path)
    const text = cached ?? (await loadSnapshot(city.id))
    statuses.push({
      id: city.id,
      title: city.title,
      source: wikiSourceUrl(city.title),
      cached: text !== null,
      charCount: text?.length ?? null,
    })
  }
  return statuses
}
