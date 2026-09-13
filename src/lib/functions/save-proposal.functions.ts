import { createServerFn } from '@tanstack/react-start'
import type { Tier } from '../llm'
import { asObject, requireString, requireTier } from './validation'

export const saveProposal = createServerFn({ method: 'POST' })
  .validator(
    (input: { tier: Tier; model: string; content: string; runId: string }) => {
      const data = asObject(input)
      return {
        tier: requireTier(data.tier),
        model: requireString(data.model, 'Некорректные данные для сохранения'),
        content: requireString(
          data.content,
          'Некорректные данные для сохранения',
        ),
        runId: requireString(data.runId, 'Некорректные данные для сохранения'),
      }
    },
  )
  .handler(async ({ data }) => {
    const fs = await import('node:fs/promises')
    const nodePath = await import('node:path')
    const dir = nodePath.resolve(process.cwd(), 'md', 'design', 'proposals')
    await fs.mkdir(dir, { recursive: true })
    const safeModel = data.model.replace(/[^A-Za-z0-9._-]/g, '-')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    const fileName = `${safeModel}-${stamp}.md`
    const header = [
      `# ${data.model}`,
      '',
      `- tier: ${data.tier}`,
      `- runId: ${data.runId}`,
      `- сохранено: ${new Date().toISOString()}`,
      '',
      '---',
      '',
    ].join('\n')
    await fs.writeFile(
      nodePath.join(dir, fileName),
      header + data.content,
      'utf8',
    )
    return { path: `md/design/proposals/${fileName}` }
  })
