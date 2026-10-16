import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { CorpusSource } from '@lib/rag-engine.types'
import type { CorpusFile } from '../data/corpus-manifest'
import { PROJECT_CORPUS } from '../data/corpus-manifest'
import { isCodeSource } from './code-chunker.server'
import { createProjectCorpus } from './project-corpus.server'

// Day-32: the review corpus is the docs corpus plus the project's own source,
// so the model can judge a diff against how the codebase is actually built.
export const CODE_CORPUS_ROOTS = [
  'src/lib',
  'src/features',
  'src/routes',
  'src/components',
]

const EXCLUDED_RE = [
  /(?:^|\/)tests?\//,
  /\.test\.(?:ts|tsx)$/i,
  /\.spec\.(?:ts|tsx)$/i,
  /(?:^|\/)__fixtures__\//,
  /\.d\.ts$/i,
]

export function isCorpusCodeFile(relative: string): boolean {
  return isCodeSource(relative) && !EXCLUDED_RE.some((re) => re.test(relative))
}

async function walk(
  root: string,
  relative: string,
  out: string[],
): Promise<void> {
  const entries = await readdir(join(root, ...relative.split('/')), {
    withFileTypes: true,
  })
  for (const entry of entries) {
    const next = `${relative}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue
      }
      await walk(root, next, out)
      continue
    }
    if (entry.isFile() && isCorpusCodeFile(next)) {
      out.push(next)
    }
  }
}

export async function listCodeCorpusFiles(root: string): Promise<CorpusFile[]> {
  const paths: string[] = []
  for (const dir of CODE_CORPUS_ROOTS) {
    try {
      await walk(root, dir, paths)
    } catch {
      // A missing tree only shrinks the corpus; the docs still answer.
    }
  }
  return paths
    .sort()
    .map((path) => ({ id: `code:${path}`, title: path, path, group: 'code' }))
}

export async function createReviewCorpus(options: {
  root: string
}): Promise<CorpusSource> {
  const codeFiles = await listCodeCorpusFiles(options.root)
  return createProjectCorpus({
    root: options.root,
    files: [...PROJECT_CORPUS, ...codeFiles],
  })
}
