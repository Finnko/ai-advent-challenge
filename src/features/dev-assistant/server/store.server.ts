import {
  createRagStore,
  resolveStorePath,
  type RagIndexStore,
} from '@lib/rag-engine.server'

// Own SQLite file: the dev-assistant index is isolated from the RAG feature's
// wiki index, so neither can clobber the other.
const DB_FILENAME = 'dev-assistant.sqlite'

let singleton: Promise<RagIndexStore> | null = null

export function getDevAssistantStore(): Promise<RagIndexStore> {
  if (!singleton) {
    singleton = resolveStorePath('DEV_ASSISTANT_DB_PATH', DB_FILENAME).then(
      (path) => createRagStore(path),
    )
  }
  return singleton
}
