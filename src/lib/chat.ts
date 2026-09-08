import { createServerFn } from '@tanstack/react-start'
import { AGENT_JUDGES, AGENT_TOOLS, Agent } from './agent'
import type { AgentCapabilities, AgentRole, CallLLM } from './agent'

export type ChatMode = 'free' | 'constrained'

export type ChatUsage = {
  prompt_tokens: number
  completion_tokens: number
}

export type ChatResult = {
  content: string
  usage: ChatUsage | null
  model: string | null
  latencyMs?: number
}

export type Tier = 'weak' | 'medium' | 'strong'

export const TIER_IDS: Tier[] = ['weak', 'medium', 'strong']

type DeepSeekResponse = {
  choices?: { message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

type DeepSeekParams = {
  max_tokens?: number
  stop?: string[]
  response_format?: { type: 'json_object' }
  temperature?: number
}

export type AskParams = DeepSeekParams

type CompletionEndpoint = {
  baseUrl: string
  model: string
  withThinking: boolean
}

const DEEPSEEK_BASE = 'https://api.deepseek.com'
const HF_BASE = 'https://router.huggingface.co/v1'

const DEEPSEEK_ENDPOINT: CompletionEndpoint = {
  baseUrl: DEEPSEEK_BASE,
  model: '',
  withThinking: true,
}

export const TIER_ENDPOINTS: Record<Tier, CompletionEndpoint> = {
  weak: {
    baseUrl: HF_BASE,
    model: 'Qwen/Qwen3-8B',
    withThinking: false,
  },
  medium: {
    ...DEEPSEEK_ENDPOINT,
    model: 'deepseek-v4-flash',
  },
  strong: {
    ...DEEPSEEK_ENDPOINT,
    model: 'deepseek-v4-pro',
  },
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value) {
    return value
  }
  const hint =
    name === 'DEEPSEEK_API_KEY'
      ? 'Скопируй .env.example в .env и впиши свой ключ.'
      : name === 'HUGGING_FACE_TOKEN'
        ? 'Добавь HUGGING_FACE_TOKEN в .env (см. .env.example).'
        : 'Проверь .env.'
  throw new Error(`${name} не задан. ${hint}`)
}

function apiKeyFor(name: string): string {
  return requireEnv(name)
}

async function callCompletions(
  endpoint: CompletionEndpoint,
  apiKey: string,
  messages: { role: 'system' | 'user'; content: string }[],
  params: DeepSeekParams = {},
): Promise<ChatResult> {
  const startedAt = Date.now()

  const res = await fetch(`${endpoint.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      ...(endpoint.withThinking ? { thinking: { type: 'disabled' } } : {}),
      ...params,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ошибка API (${res.status}): ${body}`)
  }

  const dataJson = (await res.json()) as DeepSeekResponse

  const latencyMs = Date.now() - startedAt

  const content = dataJson.choices?.[0]?.message?.content ?? ''

  const usage =
    typeof dataJson.usage?.prompt_tokens === 'number' &&
    typeof dataJson.usage?.completion_tokens === 'number'
      ? {
          prompt_tokens: dataJson.usage.prompt_tokens,
          completion_tokens: dataJson.usage.completion_tokens,
        }
      : null

  return {
    content,
    usage,
    model: endpoint.model,
    latencyMs,
  } satisfies ChatResult
}

const FREE_SYSTEM = 'Ты — полезный ассистент.'

const CONSTRAINED_SYSTEM = [
  'Ответь ровно одним json-объектом и ничем больше. Без markdown и код-фенсов: ничего до "{" и ничего после "}".',
  'Обязательные ключи:',
  '- "title": string, короткий заголовок темы',
  '- "summary": string, краткое резюме не длиннее 150 слов',
  '- "keywords": string[], от 3 до 5 коротких тегов',
  'Пример вывода:',
  '{ "title": "Почему небо голубое", "summary": "Небо выглядит голубым, потому что молекулы воздуха рассеивают коротковолновый свет сильнее, чем длинноволновый.", "keywords": ["рассеяние", "свет", "атмосфера"] }',
  'После закрывающей "}" json-объекта выведи дословный маркер END и остановись. Больше ничего не выводи.',
].join('\n')

export const CHAT_CONFIGS: Record<
  ChatMode,
  {
    label: string
    description: string
    system: string
    params: {
      max_tokens?: number
      stop?: string[]
      response_format?: { type: 'json_object' }
    }
  }
> = {
  free: {
    label: 'Свободная форма',
    description: 'Без ограничений формата, длины и завершения.',
    system: FREE_SYSTEM,
    params: {},
  },
  constrained: {
    label: 'С ограничениями',
    description: 'Явный JSON-формат, бюджет max_tokens, стоп-маркер END.',
    system: CONSTRAINED_SYSTEM,
    params: {
      max_tokens: 400,
      stop: ['END'],
      response_format: { type: 'json_object' },
    },
  },
}

export const chat = createServerFn({ method: 'POST' })
  .validator((input: { prompt: string; mode: ChatMode }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    const { prompt, mode } = input
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Промпт обязателен')
    }
    if (mode !== 'free' && mode !== 'constrained') {
      throw new Error('Неизвестный режим')
    }
    return { prompt: prompt.trim(), mode }
  })
  .handler(async ({ data }) => {
    const { prompt, mode } = data
    const config = CHAT_CONFIGS[mode]
    const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
    const endpoint = {
      ...DEEPSEEK_ENDPOINT,
      model: requireEnv('DEEPSEEK_MODEL'),
    }
    return callCompletions(
      endpoint,
      apiKey,
      [
        { role: 'system', content: config.system },
        { role: 'user', content: prompt },
      ],
      config.params,
    )
  })

export const ask = createServerFn({ method: 'POST' })
  .validator((input: { system: string; user: string; params?: AskParams }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    const { system, user, params } = input
    if (typeof system !== 'string' || system.trim().length === 0) {
      throw new Error('Системный промпт обязателен')
    }
    if (typeof user !== 'string' || user.trim().length === 0) {
      throw new Error('Пользовательский промпт обязателен')
    }
    if (
      params !== undefined &&
      params.temperature !== undefined &&
      (typeof params.temperature !== 'number' ||
        !Number.isFinite(params.temperature) ||
        params.temperature < 0 ||
        params.temperature > 2)
    ) {
      throw new Error('temperature должна быть числом от 0 до 2')
    }
    return {
      system: system.trim(),
      user: user.trim(),
      params: params ?? {},
    }
  })
  .handler(async ({ data }) => {
    const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
    const endpoint = {
      ...DEEPSEEK_ENDPOINT,
      model: requireEnv('DEEPSEEK_MODEL'),
    }
    return callCompletions(
      endpoint,
      apiKey,
      [
        { role: 'system', content: data.system },
        { role: 'user', content: data.user },
      ],
      data.params,
    )
  })

export const askModel = createServerFn({ method: 'POST' })
  .validator((input: { tier: Tier; system: string; user: string }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    const { tier, system, user } = input
    if (!TIER_IDS.includes(tier)) {
      throw new Error('Неизвестная ступень модели')
    }
    if (typeof system !== 'string' || system.trim().length === 0) {
      throw new Error('Системный промпт обязателен')
    }
    if (typeof user !== 'string' || user.trim().length === 0) {
      throw new Error('Пользовательский промпт обязателен')
    }
    return { tier, system: system.trim(), user: user.trim() }
  })
  .handler(async ({ data }) => {
    const endpoint = TIER_ENDPOINTS[data.tier]
    const apiKeyEnv =
      data.tier === 'weak' ? 'HUGGING_FACE_TOKEN' : 'DEEPSEEK_API_KEY'
    const apiKey = apiKeyFor(apiKeyEnv)
    return callCompletions(
      endpoint,
      apiKey,
      [
        { role: 'system', content: data.system },
        { role: 'user', content: data.user },
      ],
      {},
    )
  })

export const readBrief = createServerFn({ method: 'GET' }).handler(async () => {
  const fs = await import('node:fs/promises')
  const nodePath = await import('node:path')
  const filePath = nodePath.resolve(process.cwd(), 'md', 'design', 'brief.md')
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    throw new Error(
      'Файл md/design/brief.md не найден. Создай его рядом с дизайн-доком магазина.',
    )
  }
})

export const saveProposal = createServerFn({ method: 'POST' })
  .validator(
    (input: { tier: Tier; model: string; content: string; runId: string }) => {
      if (typeof input !== 'object' || input === null) {
        throw new Error('Некорректный запрос')
      }
      const { tier, model, content, runId } = input
      if (!TIER_IDS.includes(tier)) {
        throw new Error('Неизвестная ступень модели')
      }
      if (
        typeof model !== 'string' ||
        typeof content !== 'string' ||
        typeof runId !== 'string'
      ) {
        throw new Error('Некорректные данные для сохранения')
      }
      return { tier, model, content, runId }
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

export const MOCK_TOKENS = {
  employee: 'tok-employee-demo',
  manager: 'tok-manager-demo',
} as const

type MockUser = {
  token: string
  identity: { name: string; role: AgentRole; title: string }
  allowedTools: string[]
}

const MOCK_USERS: Record<AgentRole, MockUser> = {
  employee: {
    token: MOCK_TOKENS.employee,
    identity: { name: 'Пётр', role: 'employee', title: 'Линейный сотрудник' },
    allowedTools: ['bookMeetingRoom', 'requestVacation'],
  },
  manager: {
    token: MOCK_TOKENS.manager,
    identity: { name: 'Анна', role: 'manager', title: 'Руководитель команды' },
    allowedTools: ['bookMeetingRoom', 'requestVacation', 'approveVacation'],
  },
}

function resolveCapabilitiesByToken(token: string): AgentCapabilities {
  const user = Object.values(MOCK_USERS).find((u) => u.token === token)
  if (!user) {
    throw new Error('Неизвестный токен: профиль способностей не найден.')
  }
  return { identity: user.identity, allowedTools: user.allowedTools }
}

export const resolveCapabilities = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    if (typeof input.token !== 'string' || input.token.trim().length === 0) {
      throw new Error('Токен обязателен')
    }
    return { token: input.token.trim() }
  })
  .handler(async ({ data }) => resolveCapabilitiesByToken(data.token))

const callFlash: CallLLM = async ({
  messages,
  temperature,
  response_format,
  max_tokens,
}) => {
  const apiKey = apiKeyFor('DEEPSEEK_API_KEY')
  const reply = await callCompletions(TIER_ENDPOINTS.medium, apiKey, messages, {
    temperature,
    response_format,
    max_tokens,
  })
  return {
    content: reply.content,
    usage: reply.usage,
    latencyMs: reply.latencyMs ?? 0,
  }
}

export const runAgent = createServerFn({ method: 'POST' })
  .validator((input: { token: string; user: string }) => {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Некорректный запрос')
    }
    if (typeof input.token !== 'string' || input.token.trim().length === 0) {
      throw new Error('Токен обязателен')
    }
    if (typeof input.user !== 'string' || input.user.trim().length === 0) {
      throw new Error('Сообщение обязательно')
    }
    return { token: input.token.trim(), user: input.user.trim() }
  })
  .handler(async ({ data }) => {
    const capabilities = resolveCapabilitiesByToken(data.token)
    const agent = new Agent({
      capabilities,
      tools: AGENT_TOOLS,
      judges: AGENT_JUDGES,
      callLLM: callFlash,
      model: TIER_ENDPOINTS.medium.model,
      today: todayIso(),
    })
    return agent.run(data.user)
  })

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}
