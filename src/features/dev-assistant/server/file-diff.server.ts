import { callToolsFor } from '@lib/mcp/client.server'
import { gitServerConfig } from './mcp-registry.server'

export const DEFAULT_DIFF_MAX_LINES = 400

export async function collectTouchedDiff(
  paths: string[],
  maxLines = DEFAULT_DIFF_MAX_LINES,
): Promise<string> {
  if (paths.length === 0) {
    return ''
  }
  const config = gitServerConfig()
  if (!config) {
    return ''
  }
  const results = await callToolsFor(config, [
    { name: 'git_status', args: {} },
    ...paths.map((path) => ({ name: 'git_diff', args: { path, maxLines } })),
  ])
  return results
    .filter((result) => result.ok)
    .map((result) => (result.ok ? result.text : ''))
    .filter((text) => text.length > 0)
    .join('\n\n')
}
