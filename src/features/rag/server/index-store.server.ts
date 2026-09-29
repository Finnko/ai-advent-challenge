import type { Chunk, ChunkingStrategyId } from '../domain/types'
import { resolveStorePath } from '../shared/store-path.server'

const DB_FILENAME = 'rag.sqlite'

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS rag_documents (
  doc_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  n_tokens INTEGER NOT NULL,
  indexed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rag_chunks (
  chunk_id TEXT PRIMARY KEY,
  strategy TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  section TEXT,
  section_path TEXT NOT NULL,
  position INTEGER NOT NULL,
  char_start INTEGER NOT NULL,
  char_end INTEGER NOT NULL,
  n_tokens INTEGER NOT NULL,
  crosses_section INTEGER NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB,
  dim INTEGER,
  model TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_strategy
  ON rag_chunks(strategy, doc_id, position);

CREATE TABLE IF NOT EXISTS rag_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

export type DocumentRecord = {
  id: string
  title: string
  source: string
  charCount: number
  nTokens: number
  indexedAt: string
}

export type StoredChunk = {
  chunk: Chunk
  embedding: Float32Array
}

type ChunkRow = {
  chunk_id: string
  strategy: string
  doc_id: string
  source: string
  title: string
  section: string | null
  section_path: string
  position: number
  char_start: number
  char_end: number
  n_tokens: number
  crosses_section: number
  text: string
  embedding: unknown
  dim: number | null
  model: string | null
}

type DocumentRow = {
  doc_id: string
  title: string
  source: string
  char_count: number
  n_tokens: number
  indexed_at: string
}

function toChunk(row: ChunkRow): Chunk {
  return {
    chunkId: row.chunk_id,
    strategy: row.strategy as ChunkingStrategyId,
    docId: row.doc_id,
    source: row.source,
    title: row.title,
    section: row.section,
    sectionPath: JSON.parse(row.section_path) as string[],
    position: row.position,
    charStart: row.char_start,
    charEnd: row.char_end,
    nTokens: row.n_tokens,
    crossesSection: row.crosses_section === 1,
    text: row.text,
  }
}

function fromBlob(raw: unknown): Float32Array | null {
  if (raw === null || raw === undefined) {
    return null
  }
  const bytes =
    raw instanceof Uint8Array
      ? new Uint8Array(raw)
      : new Uint8Array(raw as ArrayBufferLike)
  const length = Math.floor(bytes.byteLength / 4)
  if (length === 0) {
    return null
  }
  return new Float32Array(bytes.buffer, bytes.byteOffset, length)
}

export type RagIndexStore = {
  replaceIndex(input: {
    strategy: ChunkingStrategyId
    docs: DocumentRecord[]
    rows: StoredChunk[]
    model: string
    indexedAt: string
  }): void
  clearStrategy(strategy: ChunkingStrategyId): void
  listChunks(strategy: ChunkingStrategyId): Chunk[]
  listStoredChunks(strategy: ChunkingStrategyId): StoredChunk[]
  countChunks(strategy: ChunkingStrategyId): number
  listDocuments(): DocumentRecord[]
  getMeta(key: string): string | null
  setMeta(key: string, value: string): void
  close(): void
}

async function resolveDbPath(): Promise<string> {
  return resolveStorePath('RAG_DB_PATH', DB_FILENAME)
}

export async function createRagStore(
  pathOverride?: string,
): Promise<RagIndexStore> {
  const { DatabaseSync } = await import('node:sqlite')
  const nodePath = await import('node:path')
  const { mkdir, chmod } = await import('node:fs/promises')
  const dbPath = pathOverride
    ? nodePath.resolve(pathOverride)
    : await resolveDbPath()
  await mkdir(nodePath.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec(SCHEMA_SQL)
  try {
    await chmod(dbPath, 0o600)
  } catch {
    // best-effort permissions
  }

  const insertChunk = db.prepare(
    `INSERT INTO rag_chunks
       (chunk_id, strategy, doc_id, source, title, section, section_path, position,
        char_start, char_end, n_tokens, crosses_section, text, embedding, dim, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const upsertDocument = db.prepare(
    `INSERT INTO rag_documents (doc_id, title, source, char_count, n_tokens, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(doc_id) DO UPDATE SET
       title = excluded.title,
       source = excluded.source,
       char_count = excluded.char_count,
       n_tokens = excluded.n_tokens,
       indexed_at = excluded.indexed_at`,
  )
  const upsertMeta = db.prepare(
    'INSERT INTO rag_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )

  return {
    replaceIndex(input) {
      db.exec('BEGIN')
      try {
        db.prepare('DELETE FROM rag_chunks WHERE strategy = ?').run(input.strategy)
        for (const doc of input.docs) {
          upsertDocument.run(
            doc.id,
            doc.title,
            doc.source,
            doc.charCount,
            doc.nTokens,
            doc.indexedAt,
          )
        }
        for (const { chunk, embedding } of input.rows) {
          insertChunk.run(
            chunk.chunkId,
            chunk.strategy,
            chunk.docId,
            chunk.source,
            chunk.title,
            chunk.section,
            JSON.stringify(chunk.sectionPath),
            chunk.position,
            chunk.charStart,
            chunk.charEnd,
            chunk.nTokens,
            chunk.crossesSection ? 1 : 0,
            chunk.text,
            Buffer.from(
              embedding.buffer,
              embedding.byteOffset,
              embedding.byteLength,
            ),
            embedding.length,
            input.model,
          )
        }
        upsertMeta.run(`${input.strategy}.built_at`, input.indexedAt)
        upsertMeta.run(`${input.strategy}.model`, input.model)
        upsertMeta.run(
          `${input.strategy}.chunks`,
          String(input.rows.length),
        )
        upsertMeta.run(
          `${input.strategy}.dim`,
          String(input.rows[0]?.embedding.length ?? 0),
        )
        db.exec('COMMIT')
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    clearStrategy(strategy) {
      db.prepare('DELETE FROM rag_chunks WHERE strategy = ?').run(strategy)
      db.prepare('DELETE FROM rag_meta WHERE key LIKE ?').run(`${strategy}.%`)
    },
    listChunks(strategy) {
      const rows = db
        .prepare(
          'SELECT * FROM rag_chunks WHERE strategy = ? ORDER BY doc_id, position',
        )
        .all(strategy) as ChunkRow[]
      return rows.map(toChunk)
    },
    listStoredChunks(strategy) {
      const rows = db
        .prepare(
          'SELECT * FROM rag_chunks WHERE strategy = ? ORDER BY doc_id, position',
        )
        .all(strategy) as ChunkRow[]
      const stored: StoredChunk[] = []
      for (const row of rows) {
        const embedding = fromBlob(row.embedding)
        if (embedding) {
          stored.push({ chunk: toChunk(row), embedding })
        }
      }
      return stored
    },
    countChunks(strategy) {
      const row = db
        .prepare('SELECT COUNT(*) AS count FROM rag_chunks WHERE strategy = ?')
        .get(strategy) as { count: number }
      return row.count
    },
    listDocuments() {
      const rows = db
        .prepare('SELECT * FROM rag_documents ORDER BY title')
        .all() as DocumentRow[]
      return rows.map((row) => ({
        id: row.doc_id,
        title: row.title,
        source: row.source,
        charCount: row.char_count,
        nTokens: row.n_tokens,
        indexedAt: row.indexed_at,
      }))
    },
    getMeta(key) {
      const row = db
        .prepare('SELECT value FROM rag_meta WHERE key = ?')
        .get(key) as { value: string } | undefined
      return row?.value ?? null
    },
    setMeta(key, value) {
      upsertMeta.run(key, value)
    },
    close() {
      db.close()
    },
  }
}

let singleton: Promise<RagIndexStore> | null = null

export function getRagStore(): Promise<RagIndexStore> {
  if (!singleton) {
    singleton = createRagStore()
  }
  return singleton
}
