import { describe, expect, it } from 'vitest'
import { listMcpTools } from '../server/mcp.server'

describe('MCP connection', () => {
  it('connects over stdio and returns the registered tools', async () => {
    const result = await listMcpTools()

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      'echo',
      'now',
    ])

    const echo = result.tools.find((tool) => tool.name === 'echo')
    expect(echo?.description).toBeTruthy()
    expect(echo?.inputSchema).toMatchObject({ type: 'object' })
  }, 20_000)
})
