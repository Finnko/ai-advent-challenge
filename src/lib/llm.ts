export type ChatUsage = {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

export type ChatResult = {
  content: string
  usage: ChatUsage | null
  model: string | null
  latencyMs?: number
}

export type Tier = 'weak' | 'medium' | 'strong'

export const TIER_IDS: Tier[] = ['weak', 'medium', 'strong']

export type DeepSeekParams = {
  max_tokens?: number
  stop?: string[]
  response_format?: { type: 'json_object' }
  temperature?: number
}

export type AskParams = DeepSeekParams

export type CompletionEndpoint = {
  baseUrl: string
  model: string
  withThinking: boolean
}

const DEEPSEEK_BASE = 'https://api.deepseek.com'
const HF_BASE = 'https://router.huggingface.co/v1'

export const DEEPSEEK_ENDPOINT: CompletionEndpoint = {
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
    model: 'deepseek-flash',
  },
  strong: {
    ...DEEPSEEK_ENDPOINT,
    model: 'deepseek-v4-pro',
  },
}
