import { callToolsFor } from '@lib/mcp/client.server'
import { filesServerConfig } from './mcp-registry.server'
import {
  collectRepoChanges,
  REPO_DIFF_MAX_LINES,
  type RepoChanges,
} from './repo-diff.server'

const DOC_GLOB = '*.md'
const DOC_MATCH_LIMIT = 20

export type DocDigest = {
  block: string
  docs: string[]
}

function docQueries(changes: RepoChanges): string[] {
  const queries = new Set<string>()
  for (const file of changes.changedFiles) {
    const name = file.path.split('/').at(-1) ?? file.path
    if (name.length > 0) {
      queries.add(name)
    }
  }
  return [...queries]
}

async function findDocs(queries: string[]): Promise<string[]> {
  const config = filesServerConfig()
  if (!config || queries.length === 0) {
    return []
  }
  const results = await callToolsFor(
    config,
    queries.map((query) => ({
      name: 'search_text',
      args: { query, glob: DOC_GLOB, maxResults: DOC_MATCH_LIMIT },
    })),
  )
  const docs = new Set<string>()
  for (const result of results) {
    const matches = result.ok ? result.structured?.matches : null
    if (!Array.isArray(matches)) {
      continue
    }
    for (const match of matches) {
      const path = (match as { path?: unknown }).path
      if (typeof path === 'string' && path.trim().length > 0) {
        docs.add(path.trim())
      }
    }
  }
  return [...docs]
}

export async function collectDocDigest(
  maxLines = REPO_DIFF_MAX_LINES,
): Promise<DocDigest> {
  const changes = await collectRepoChanges(maxLines)
  if (changes.changedFiles.length === 0) {
    return {
      block: 'Изменённых файлов нет — синхронизировать документацию не с чем.',
      docs: [],
    }
  }
  const docs = await findDocs(docQueries(changes))
  const lines = [
    'ИЗМЕНЕНИЯ В КОДЕ (для синхронизации документации):',
    `- Изменённые файлы: ${changes.changedFiles.map((file) => file.path).join(', ')}`,
    docs.length > 0
      ? `- Документы, которые упоминают эти файлы: ${docs.join(', ')}`
      : '- Документы, которые упоминают эти файлы: не найдено — определи их поиском.',
  ]
  if (changes.diff.trim().length > 0) {
    lines.push('', 'Дифф изменений:', changes.diff)
  }
  return { block: lines.join('\n'), docs }
}
