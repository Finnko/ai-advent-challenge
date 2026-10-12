export type ApiChatRole = 'system' | 'user' | 'assistant'

export type ApiChatMessage = {
  role: ApiChatRole
  content: string
}

export type ChatCompletionsRequest = {
  model?: string
  messages: ApiChatMessage[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export type ApiErrorBody = {
  error: {
    message: string
    type: string
    code: string | null
  }
}

export type OpenAiModel = {
  id: string
  object: 'model'
  created: number
  owned_by: string
}

export type OpenAiModelList = {
  object: 'list'
  data: OpenAiModel[]
}

export type OpenAiUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export type OpenAiChatCompletion = {
  id: string
  object: 'chat.completion'
  created: number
  model: string
  choices: {
    index: number
    message: { role: 'assistant'; content: string }
    finish_reason: 'stop'
  }[]
  usage: OpenAiUsage
}

export type OpenAiChatChunk = {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: {
    index: number
    delta: { role?: 'assistant'; content?: string }
    finish_reason: 'stop' | null
  }[]
}
