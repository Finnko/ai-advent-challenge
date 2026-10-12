import {
  getLocalLlmStatus,
  runLocalChat,
  streamLocalChat,
} from '@lib/local-llm.server'
import type { ChatStreamChunk } from '@lib/llm.server'
import type {
  ChatResult,
  CompletionEndpoint,
  DeepSeekParams,
  LocalLlmStatus,
} from '@lib/llm'
import type { ApiChatMessage } from '../domain/types'

export type Upstream = {
  chat: (
    messages: ApiChatMessage[],
    params: DeepSeekParams,
  ) => Promise<ChatResult>
  stream: (
    messages: ApiChatMessage[],
    params: DeepSeekParams,
  ) => AsyncGenerator<ChatStreamChunk, void, void>
  status: () => Promise<LocalLlmStatus>
}

export function createUpstream(endpoint: CompletionEndpoint): Upstream {
  return {
    chat: (messages, params) => runLocalChat(messages, params, { endpoint }),
    stream: (messages, params) =>
      streamLocalChat(messages, params, { endpoint }),
    status: () => getLocalLlmStatus({ endpoint }),
  }
}
