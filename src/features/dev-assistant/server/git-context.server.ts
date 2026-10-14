import {
  collectMcpContext,
  type McpContextCall,
  type McpContextSection,
} from '@lib/mcp/context.server'
import type { StructuredContent } from '@lib/mcp/types'
import type { GitContext, GitContextSection } from '../domain/git/context'
import { gitServerConfig } from './mcp-registry.server'

// One spawn, several read-only calls: the git MCP server is the only producer
// of local repository context. Day 32 will feed the same "context blocks" seam
// from a GitHub Action instead, without the core ever knowing about git.
export const GIT_CONTEXT_CALLS: McpContextCall[] = [
  { name: 'git_branch', title: 'Ветка', args: {} },
  { name: 'git_status', title: 'Статус', args: {} },
  { name: 'git_log', title: 'Последние коммиты', args: { limit: 10 } },
  { name: 'git_changed_files', title: 'Изменённые файлы', args: {} },
  { name: 'git_diff', title: 'Дифф', args: { maxLines: 60 } },
]

function readString(
  payload: StructuredContent | undefined,
  key: string,
): string | null {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    return null
  }
  const value = payload[key]
  return typeof value === 'string' ? value : null
}

function branchOf(sections: McpContextSection[]): string | null {
  const branch = sections.find((section) => section.tool === 'git_branch')
  return readString(branch?.structured, 'branch')
}

function toSection(section: McpContextSection): GitContextSection {
  return { tool: section.tool, title: section.title, text: section.text }
}

export async function collectGitContext(): Promise<GitContext> {
  const config = gitServerConfig()
  if (!config) {
    return {
      available: false,
      error: 'git MCP-сервер не сконфигурирован',
      branch: null,
      sections: [],
      block: null,
    }
  }
  const context = await collectMcpContext({
    config,
    calls: GIT_CONTEXT_CALLS,
  })
  return {
    available: context.available,
    error: context.error,
    branch: branchOf(context.sections),
    sections: context.sections.map(toSection),
    block: context.block,
  }
}
