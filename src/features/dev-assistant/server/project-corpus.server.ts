import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  CorpusDocStatus,
  CorpusRef,
  CorpusSource,
} from '@lib/rag-engine.types'
import type { CorpusFile } from '../data/corpus-manifest'
import { PROJECT_CORPUS } from '../data/corpus-manifest'

export type ProjectCorpusOptions = {
  root: string
  files?: CorpusFile[]
}

// Dev/local only: the corpus is the repository's own docs, read straight from
// disk so the assistant describes the project as it is right now. There is no
// bundled snapshot to go stale.
export function resolveRepoRoot(): string {
  return process.env.DEV_ASSISTANT_REPO_DIR?.trim() || process.cwd()
}

export function createProjectCorpus(
  options: ProjectCorpusOptions,
): CorpusSource {
  const files = options.files ?? PROJECT_CORPUS
  const pathFor = (relative: string): string =>
    join(options.root, ...relative.split('/'))

  const refs: CorpusRef[] = files.map((file) => ({
    id: file.id,
    title: file.title,
    source: file.path,
  }))

  return {
    async list() {
      return refs
    },
    async load(ref) {
      const file = files.find((entry) => entry.id === ref.id)
      if (!file) {
        throw new Error(`Неизвестный документ корпуса: ${ref.id}`)
      }
      const text = await readFile(pathFor(file.path), 'utf8')
      return {
        id: file.id,
        title: file.title,
        source: file.path,
        text,
      }
    },
    async status(refsToInspect) {
      const targets = refsToInspect ?? refs
      const statuses: CorpusDocStatus[] = []
      for (const ref of targets) {
        try {
          const text = await readFile(pathFor(ref.source), 'utf8')
          statuses.push({
            id: ref.id,
            title: ref.title,
            source: ref.source,
            cached: true,
            charCount: text.length,
          })
        } catch {
          statuses.push({
            id: ref.id,
            title: ref.title,
            source: ref.source,
            cached: false,
            charCount: null,
          })
        }
      }
      return statuses
    },
  }
}
