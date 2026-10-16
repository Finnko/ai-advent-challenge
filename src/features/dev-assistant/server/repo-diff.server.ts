import { callToolsFor } from '@lib/mcp/client.server'
import type { GitChangedFile } from '../domain/git/types'
import { gitServerConfig } from './mcp-registry.server'

export const REPO_DIFF_MAX_LINES = 400

export type RepoChanges = {
  changedFiles: GitChangedFile[]
  diff: string
}

function parseChangedFiles(value: unknown): GitChangedFile[] {
  if (!Array.isArray(value)) {
    return []
  }
  const files: GitChangedFile[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const { status, path } = entry as { status?: unknown; path?: unknown }
    if (typeof path === 'string' && path.trim().length > 0) {
      files.push({
        status: typeof status === 'string' ? status : '',
        path: path.trim(),
      })
    }
  }
  return files
}

export async function collectRepoChanges(
  maxLines = REPO_DIFF_MAX_LINES,
): Promise<RepoChanges> {
  const config = gitServerConfig()
  if (!config) {
    return { changedFiles: [], diff: '' }
  }
  const [listed] = await callToolsFor(config, [
    { name: 'git_changed_files', args: {} },
  ])
  const changedFiles =
    listed && listed.ok ? parseChangedFiles(listed.structured?.files) : []
  if (changedFiles.length === 0) {
    return { changedFiles, diff: '' }
  }
  const results = await callToolsFor(
    config,
    changedFiles.map((file) => ({
      name: 'git_diff',
      args: { path: file.path, maxLines },
    })),
  )
  const diff = results
    .map((result) => (result.ok ? result.text : ''))
    .filter((text) => text.trim().length > 0)
    .join('\n\n')
  return { changedFiles, diff }
}

export function formatRepoChanges(changes: RepoChanges): string {
  if (changes.changedFiles.length === 0) {
    return 'Изменённых файлов нет — рабочее дерево чистое.'
  }
  return [
    `Изменённые файлы (${changes.changedFiles.length}):`,
    ...changes.changedFiles.map((file) => `- ${file.status} ${file.path}`),
  ].join('\n')
}
