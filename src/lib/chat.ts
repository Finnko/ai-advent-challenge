import { createServerFn } from '@tanstack/react-start'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export const sendPrompt = createServerFn({ method: 'POST' })
  .validator((prompt: string) => {
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Prompt is required')
    }
    return prompt.trim()
  })
  .handler(async ({ data: prompt }) => {
    const apiKey = process.env.DEEPSEEK_API_KEY
    const model = process.env.DEEPSEEK_MODEL

    if (!apiKey) {
      throw new Error(
        'DEEPSEEK_API_KEY is not set. Copy .env.example to .env and fill in your key.',
      )
    }
    if (!model) {
      throw new Error('DEEPSEEK_MODEL is not set.')
    }

    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`DeepSeek API error (${res.status}): ${body}`)
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('DeepSeek API returned an empty response')
    }

    return content
  })
