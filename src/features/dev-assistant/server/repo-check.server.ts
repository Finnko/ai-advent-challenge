import { callToolsFor } from '@lib/mcp/client.server'
import type { InvariantRecord } from '@lib/invariants/types'
import {
  checkInvariants,
  formatInvariantReport,
  type InvariantCheckFile,
} from '../domain/invariant-report'
import { filesServerConfig } from './mcp-registry.server'
import { collectRepoChanges } from './repo-diff.server'

const READ_MAX_LINES = 2000

async function readContents(
  paths: string[],
): Promise<Map<string, string | null>> {
  const contents = new Map<string, string | null>()
  const config = filesServerConfig()
  if (!config || paths.length === 0) {
    return contents
  }
  const results = await callToolsFor(
    config,
    paths.map((path) => ({
      name: 'read_file',
      args: { path, maxLines: READ_MAX_LINES },
    })),
  )
  paths.forEach((path, index) => {
    const result = results[index]
    contents.set(path, result && result.ok ? result.text : null)
  })
  return contents
}

export async function collectInvariantReport(
  invariants: InvariantRecord[],
): Promise<string> {
  const changes = await collectRepoChanges()
  const contents = await readContents(
    changes.changedFiles.map((file) => file.path),
  )
  const files: InvariantCheckFile[] = changes.changedFiles.map((file) => ({
    path: file.path,
    content: contents.get(file.path) ?? null,
  }))
  return formatInvariantReport(
    checkInvariants({ invariants, files }),
    files.length,
  )
}
