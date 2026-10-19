import {
  createRagStore,
  resolveStorePath,
  type RagIndexStore,
} from '@lib/rag-engine.server'

const DB_FILENAME = 'support.sqlite'

let singleton: Promise<RagIndexStore> | null = null

export function getSupportStore(): Promise<RagIndexStore> {
  if (!singleton) {
    singleton = resolveStorePath('SUPPORT_DB_PATH', DB_FILENAME).then((path) =>
      createRagStore(path),
    )
  }
  return singleton
}
