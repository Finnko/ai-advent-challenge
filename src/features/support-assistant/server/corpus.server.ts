import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import type {
  CorpusDocStatus,
  CorpusRef,
  CorpusSource,
  RawDoc,
} from '@lib/rag-engine.types'

export type Frontmatter = {
  fields: Record<string, string>
  body: string
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function parseFrontmatter(text: string): Frontmatter {
  const normalized = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---\n')) {
    return { fields: {}, body: normalized }
  }
  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    return { fields: {}, body: normalized }
  }
  const fields: Record<string, string> = {}
  for (const line of normalized.slice(4, end).split('\n')) {
    const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line)
    if (match) {
      fields[match[1]] = unquote(match[2])
    }
  }
  const body = normalized.slice(end + 4).replace(/^\n+/, '')
  return { fields, body }
}

async function listMarkdown(dir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const files: string[] = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdown(path)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path)
    }
  }
  return files
}

export function resolveCorpusRoot(): string {
  return (
    process.env.SUPPORT_CORPUS_DIR?.trim() ||
    join(process.cwd(), '.cache', 'ozon-corpus')
  )
}

function isGuide(relativePath: string): boolean {
  return relativePath.includes('/api/seller/guides/')
}

function docId(relativePath: string, fields: Record<string, string>): string {
  const numeric = fields.doc_id?.trim()
  if (numeric) {
    return `kb-${numeric}`
  }
  return relativePath
    .replace(/\.md$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function docTitle(
  relativePath: string,
  fields: Record<string, string>,
): string {
  const title =
    fields.title?.trim() ||
    relativePath.split('/').pop()?.replace(/\.md$/, '') ||
    relativePath
  const updated = fields.updated?.trim()
  return updated ? `${title} · обновлено ${updated.slice(0, 10)}` : title
}

export type OzonCorpusOptions = {
  root: string
  includeSections?: boolean
}

export function createOzonCorpus(options: OzonCorpusOptions): CorpusSource {
  const root = resolve(options.root)
  let cache: Promise<RawDoc[]> | null = null

  async function scan(): Promise<RawDoc[]> {
    const kbDir = join(root, 'ozon', 'kb')
    const guidesDir = join(root, 'ozon', 'api', 'seller', 'guides')
    const files = [
      ...(await listMarkdown(kbDir)),
      ...(await listMarkdown(guidesDir)),
    ]
    const selected = new Map<string, { doc: RawDoc; updated: string }>()
    for (const file of files) {
      const relativePath = relative(root, file).split('\\').join('/')
      const text = await readFile(file, 'utf8')
      const { fields, body } = parseFrontmatter(text)
      const guide = isGuide(relativePath)
      if (!guide && !options.includeSections && fields.kind === 'section') {
        continue
      }
      const id = docId(relativePath, fields)
      const updated = fields.updated?.trim() ?? ''
      const existing = selected.get(id)
      if (existing && existing.updated >= updated) {
        continue
      }
      selected.set(id, {
        doc: {
          id,
          title: docTitle(relativePath, fields),
          source: fields.source?.trim() || relativePath,
          text: body,
        },
        updated,
      })
    }
    return [...selected.values()].map((entry) => entry.doc)
  }

  async function docs(): Promise<RawDoc[]> {
    if (!cache) {
      cache = scan()
    }
    return cache
  }

  return {
    async list(): Promise<CorpusRef[]> {
      const all = await docs()
      if (all.length === 0) {
        throw new Error(`Корпус Ozon не найден: ${root}`)
      }
      return all.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source,
      }))
    },
    async load(ref): Promise<RawDoc> {
      const doc = (await docs()).find((entry) => entry.id === ref.id)
      if (!doc) {
        throw new Error(`Неизвестный документ корпуса: ${ref.id}`)
      }
      return doc
    },
    async status(refs): Promise<CorpusDocStatus[]> {
      const targets = refs ? new Set(refs.map((ref) => ref.id)) : null
      return (await docs())
        .filter((doc) => !targets || targets.has(doc.id))
        .map((doc) => ({
          id: doc.id,
          title: doc.title,
          source: doc.source,
          cached: true,
          charCount: doc.text.length,
        }))
    },
  }
}
