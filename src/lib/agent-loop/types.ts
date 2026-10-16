export type ToolArgValue = string | number | boolean | null | string[]

export type ToolArgs = Record<string, ToolArgValue>

export type ToolArgRef = { $ref: string | string[] }

export type DecidedToolArgs = Record<string, ToolArgValue | ToolArgRef>

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LlmUsage = {
  prompt_tokens: number
  completion_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

export type LlmParams = {
  temperature?: number
  response_format?: { type: 'json_object' }
  max_tokens?: number
}

export type LlmReply = {
  content: string
  usage: LlmUsage | null
  latencyMs: number
}

export type CallLLM = (
  params: LlmParams & { messages: LlmMessage[] },
) => Promise<LlmReply>

export type TokenBreakdown = {
  requestTokens: number
  historyTokens: number
  historyTokensSent: number
  contextTokens: number
  contextMessages: number
  responseTokens: number
  promptTokensActual: number
  cacheHitTokens: number
  cacheMissTokens: number
  costUsd: number
}

export type ToolOutcome = {
  ok: boolean
  text: string
  reference: string | null
  refText?: string
}

export type ToolOutput = {
  id: number
  tool: string
  text: string
  refText?: string
}

export type Tool<TContext = unknown> = {
  name: string
  description: string
  argsExample: string
  mutating?: boolean
  run: (args: ToolArgs, ctx: TContext) => ToolOutcome | Promise<ToolOutcome>
  screenArgs?: (args: ToolArgs, ctx: TContext) => ToolArgs | Promise<ToolArgs>
}

export type JudgeVerdict = {
  judge: string
  status: 'pass' | 'fail'
  message: string
}

export type LoopAction = {
  tool: string
  args: ToolArgs
  outcome: ToolOutcome
}

export type LoopTraceStep =
  | { stage: 'input'; accepted: boolean; charCount: number }
  | {
      stage: 'decide'
      raw: string
      tool: string | null
      args: DecidedToolArgs
      usage: LlmUsage | null
      latencyMs: number
    }
  | {
      stage: 'act'
      tool: string
      args: DecidedToolArgs
      outcome: ToolOutcome
      mutating: boolean
      invariantHits?: string[]
    }
  | {
      stage: 'finalize'
      answer: string
      usage: LlmUsage | null
      latencyMs: number
    }
  | {
      stage: 'invariant-guard'
      verdict: JudgeVerdict
      hits: string[]
      usage: LlmUsage | null
      latencyMs: number
      error?: string
    }
  | { stage: 'verdicts'; verdicts: JudgeVerdict[] }

export type LoopRunResult = {
  ok: boolean
  blocked: boolean
  reason: string | null
  answer: string
  trace: LoopTraceStep[]
  verdicts: JudgeVerdict[]
  usage: LlmUsage | null
  latencyMs: number
  model: string
  tokens: TokenBreakdown
  invariantHits: string[]
}

export type CheckResult = {
  ok: boolean
  hits: string[]
  reason: string | null
}

export type GuardVerdict = {
  status: 'pass' | 'fail'
  hits: string[]
  reason: string | null
  usage: LlmUsage | null
  latencyMs: number
}

export type LoopJudgeContext = {
  request: string
  actions: LoopAction[]
  answer: string
  allowedTools: string[]
}

export type LoopJudge = {
  name: string
  evaluate: (ctx: LoopJudgeContext) => JudgeVerdict
}

export type LoopState<TContext = unknown> = {
  request: string
  tools: Tool<TContext>[]
  allowedToolNames: string[]
  history: LlmMessage[]
  outputs: ToolOutput[]
  actions: LoopAction[]
  step: number
}

export type GuardInput = {
  answer: string
  report: string
}

export type BlockedInfo = {
  answerCheck: CheckResult
  actionHits: string[]
  guardVerdict: GuardVerdict | null
  failing: JudgeVerdict[]
  actRefusal: string | undefined
}

export type LoopPromptHooks<TContext = unknown> = {
  systemMessages(
    state: LoopState<TContext>,
    phase: 'decide' | 'finalize',
  ): LlmMessage[]
  decideUser(state: LoopState<TContext>): string
  finalizeUser(
    state: LoopState<TContext>,
    report: string,
    stoppedByPause: boolean,
  ): string
  decideParams?(state: LoopState<TContext>): LlmParams
  finalizeParams?(state: LoopState<TContext>): LlmParams
}

export type LoopPolicyHooks<TContext = unknown> = {
  gate?(
    state: LoopState<TContext>,
    tool: string,
  ): { allow: true } | { allow: false; reason: string }
  nudge?(state: LoopState<TContext>): string | null
  onRepeat?(
    state: LoopState<TContext>,
    call: { tool: string; args: DecidedToolArgs },
  ): string | null
  checkAction?(
    state: LoopState<TContext>,
    call: { tool: string; args: ToolArgs },
  ): CheckResult | null
  checkAnswer?(state: LoopState<TContext>, answer: string): CheckResult | null
  guard?(
    state: LoopState<TContext>,
    input: GuardInput,
  ): Promise<GuardVerdict | null>
  judges?(state: LoopState<TContext>, answer: string): LoopJudge[]
  onBlocked?(
    state: LoopState<TContext>,
    info: BlockedInfo,
  ): { answer: string; reason: string | null }
}

export type LoopHooks<TContext = unknown> = {
  prompts: LoopPromptHooks<TContext>
  policy?: LoopPolicyHooks<TContext>
  cost?(usage: LlmUsage | null): number
  isPaused?: () => boolean | Promise<boolean>
}

export type LoopConfig<TContext = unknown> = {
  request: string
  model: string
  callLLM: CallLLM
  toolContext: TContext
  tools: Tool<TContext>[]
  allowedToolNames: string[]
  history: LlmMessage[]
  systemTokens: number
  contextTokens: number
  contextMessages: number
  budgetTokens?: number | null
  maxInputChars?: number
  maxActions?: number
  hooks: LoopHooks<TContext>
}
