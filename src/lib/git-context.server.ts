import { gitServerConfig } from '@/features/dev-assistant/server/mcp-registry.server'
import { callToolsFor } from './mcp/client.server'
import type { ToolArgs } from './mcp/types'
import type { GitContext, GitContextSection } from './git-context.types'

// One spawn, several read-only calls: the git MCP server is the only producer
// of local repository context. Day 32 will feed the same "context blocks" seam
// from a GitHub Action instead, without the core ever knowing about git.
const GIT_TOOLS: { name: string; title: string; args: ToolArgs }[] = [
  { name: 'git_branch', title: 'Ветка', args: {} },
  { name: 'git_status', title: 'Статус', args: {} },
  { name: 'git_log', title: 'Последние коммиты', args: { limit: 10 } },
  { name: 'git_changed_files', title: 'Изменённые файлы', args: {} },
  { name: 'git_diff', title: 'Дифф', args: { maxLines: 60 } },
]

function buildBlock(sections: GitContextSection[]): string {
  return sections
    .map((section) => `### ${section.title}\n${section.text}`)
    .join('\n\n')
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
  const results = await callToolsFor(
    config,
    GIT_TOOLS.map((tool) => ({ name: tool.name, args: tool.args })),
  )
  const sections: GitContextSection[] = []
  let branch: string | null = null
  let firstError: string | null = null
  results.forEach((result, index) => {
    const tool = GIT_TOOLS[index]
    if (result.ok) {
      sections.push({ tool: tool.name, title: tool.title, text: result.text })
      if (tool.name === 'git_branch') {
        branch = result.text.replace(/^Текущая ветка:\s*/, '').trim()
      }
      return
    }
    if (!firstError) {
      firstError = result.error
    }
  })
  return {
    available: sections.length > 0,
    error: sections.length > 0 ? null : firstError,
    branch,
    sections,
    block: sections.length > 0 ? buildBlock(sections) : null,
  }
}
