import {
  type CheckResult,
  type DecidedToolArgs,
  type GuardVerdict,
  type JudgeVerdict,
  type LlmMessage,
  type LlmUsage,
  type LoopAction,
  type LoopConfig,
  type LoopRunResult,
  type LoopState,
  type LoopTraceStep,
  type TokenBreakdown,
  type ToolArgRef,
  type ToolArgs,
  type ToolOutcome,
  type ToolOutput,
} from './types'
import { estimateMessagesTokens, estimateTokens } from './tokens'

const DECIDE_TEMPERATURE = 0.2
const FINALIZE_TEMPERATURE = 0.7
const DEFAULT_MAX_INPUT_CHARS = 30_000
const DECIDE_MAX_TOKENS = 800
const FINALIZE_MAX_TOKENS = 700
const DEFAULT_MAX_ACTIONS = 10

function isToolArgRef(value: unknown): value is ToolArgRef {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const ref = (value as Record<string, unknown>).$ref
  return typeof ref === 'string' || Array.isArray(ref)
}

function refValue(ref: string, outputs: ToolOutput[]): string | null {
  if (ref === 'last') {
    const output = outputs.at(-1)
    return output ? (output.refText ?? output.text) : null
  }
  const output = outputs.find((entry) => String(entry.id) === ref)
  return output ? (output.refText ?? output.text) : null
}

export function resolveArgRefs(
  rawArgs: DecidedToolArgs,
  outputs: ToolOutput[],
): { ok: true; args: ToolArgs } | { ok: false; error: string } {
  const args: ToolArgs = {}
  for (const [key, value] of Object.entries(rawArgs)) {
    if (!isToolArgRef(value)) {
      args[key] = value
      continue
    }
    const refs = Array.isArray(value.$ref) ? value.$ref : [value.$ref]
    const parts: string[] = []
    for (const ref of refs) {
      const resolved = refValue(ref, outputs)
      if (resolved === null) {
        return {
          ok: false,
          error: `Ссылка $ref "${ref}" не найдена: вывода инструмента с таким номером нет. Передай {"$ref":"<номер>"} или {"$ref":"last"} из отчёта предыдущего инструмента.`,
        }
      }
      parts.push(resolved)
    }
    args[key] = parts.join('\n\n')
  }
  return { ok: true, args }
}

export function parseDecideJson(content: string): {
  tool: string | null
  args: DecidedToolArgs
} {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return { tool: null, args: {} }
  }
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as {
      tool?: unknown
      args?: unknown
    }
    if (!parsed || typeof parsed !== 'object') {
      return { tool: null, args: {} }
    }
    const tool =
      typeof parsed.tool === 'string' && parsed.tool.length > 0
        ? parsed.tool
        : null
    const args =
      parsed.args &&
      typeof parsed.args === 'object' &&
      !Array.isArray(parsed.args)
        ? (parsed.args as DecidedToolArgs)
        : {}
    return { tool, args }
  } catch {
    return { tool: null, args: {} }
  }
}

function traceOutcome(outcome: ToolOutcome): ToolOutcome {
  return {
    ok: outcome.ok,
    text: outcome.text,
    reference: outcome.reference,
  }
}

function repeatKey(tool: string, args: DecidedToolArgs): string {
  return `${tool}::${JSON.stringify(args)}`
}

function formatActionReport(action: LoopAction): string {
  const reference = action.outcome.reference
    ? `\nКод подтверждения: ${action.outcome.reference}`
    : ''
  return `ОТЧЁТ ИНСТРУМЕНТА (${action.tool}):\n${action.outcome.text}${reference}`
}

export function formatToolReport(actions: LoopAction[]): string {
  if (actions.length === 0) {
    return '(инструменты не вызывались)'
  }
  return actions.map(formatActionReport).join('\n\n')
}

function sumUsage(trace: LoopTraceStep[]): LlmUsage | null {
  let prompt = 0
  let completion = 0
  let cacheHit = 0
  let cacheMiss = 0
  let hasCacheBreakdown = false
  let any = false
  for (const step of trace) {
    if (
      step.stage === 'decide' ||
      step.stage === 'finalize' ||
      step.stage === 'invariant-guard'
    ) {
      if (step.usage) {
        prompt += step.usage.prompt_tokens
        completion += step.usage.completion_tokens
        if (
          step.usage.prompt_cache_hit_tokens !== undefined ||
          step.usage.prompt_cache_miss_tokens !== undefined
        ) {
          hasCacheBreakdown = true
          cacheHit += step.usage.prompt_cache_hit_tokens ?? 0
          cacheMiss += step.usage.prompt_cache_miss_tokens ?? 0
        }
        any = true
      }
    }
  }
  if (!any) {
    return null
  }
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    ...(hasCacheBreakdown
      ? {
          prompt_cache_hit_tokens: cacheHit,
          prompt_cache_miss_tokens: cacheMiss,
        }
      : {}),
  }
}

function sumLatency(trace: LoopTraceStep[]): number {
  let total = 0
  for (const step of trace) {
    if (
      step.stage === 'decide' ||
      step.stage === 'finalize' ||
      step.stage === 'invariant-guard'
    ) {
      total += step.latencyMs
    }
  }
  return total
}

function defaultBlockedReason(info: {
  answerCheck: CheckResult
  guardVerdict: GuardVerdict | null
  failing: { message: string }[]
}): string | null {
  if (!info.answerCheck.ok) {
    return info.answerCheck.reason
  }
  if (info.guardVerdict?.status === 'fail') {
    return info.guardVerdict.reason ?? 'Ответ нарушает правило.'
  }
  if (info.failing.length > 0) {
    return info.failing.map((verdict) => verdict.message).join(' ')
  }
  return null
}

export async function runToolLoop<TContext>(
  config: LoopConfig<TContext>,
): Promise<LoopRunResult> {
  const trace: LoopTraceStep[] = []
  const hooks = config.hooks
  const request = config.request.trim()
  const maxInputChars = config.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS
  const accepted = request.length > 0 && request.length <= maxInputChars
  trace.push({ stage: 'input', accepted, charCount: request.length })

  const history = config.history
  const requestTokens = estimateTokens(request)
  const historyTokens = estimateMessagesTokens(history)
  const contextTokens = config.contextTokens
  const contextMessages = config.contextMessages

  const emptyTokens = (
    overrides: Partial<TokenBreakdown> = {},
  ): TokenBreakdown => ({
    requestTokens,
    historyTokens,
    historyTokensSent: historyTokens,
    contextTokens,
    contextMessages,
    responseTokens: 0,
    promptTokensActual: 0,
    cacheHitTokens: 0,
    cacheMissTokens: 0,
    costUsd: 0,
    ...overrides,
  })

  const blockedRun = (
    reason: string,
    tokens: Partial<TokenBreakdown> = {},
  ): LoopRunResult => ({
    ok: false,
    blocked: true,
    reason,
    answer: `Сообщение отклонено полиси цикла: ${reason}`,
    trace,
    verdicts: [],
    usage: null,
    latencyMs: 0,
    model: config.model,
    tokens: emptyTokens(tokens),
    invariantHits: [],
  })

  if (!accepted) {
    const reason =
      request.length === 0
        ? 'Сообщение пустое.'
        : `Сообщение длиннее ${maxInputChars} символов.`
    return {
      ...blockedRun(reason),
      answer: `Сообщение отклонено input policy: ${reason}`,
    }
  }

  const systemTokens = config.systemTokens
  const budget = config.budgetTokens ?? null
  if (
    budget !== null &&
    systemTokens + contextTokens + requestTokens > budget
  ) {
    const reason =
      `Запрос (≈${requestTokens} ток.) вместе с системным промптом не влезает ` +
      `в контекстный бюджет (${budget} ток.). Сократи сообщение или начни новую сессию.`
    return {
      ...blockedRun(reason, { historyTokensSent: 0 }),
      answer: `Сообщение отклонено контекстной политикой: ${reason}`,
    }
  }

  const tools = config.tools
  const allowedToolNames = config.allowedToolNames
  const maxActions = Math.max(1, config.maxActions ?? DEFAULT_MAX_ACTIONS)

  const state: LoopState<TContext> = {
    request,
    tools,
    allowedToolNames,
    history,
    outputs: [],
    actions: [],
    step: 0,
  }

  const runDecide = async (nudge: string | null) => {
    const params = hooks.prompts.decideParams?.(state) ?? {
      temperature: DECIDE_TEMPERATURE,
      response_format: { type: 'json_object' as const },
      max_tokens: DECIDE_MAX_TOKENS,
    }
    const reply = await config.callLLM({
      messages: [
        ...hooks.prompts.systemMessages(state, 'decide'),
        { role: 'user', content: hooks.prompts.decideUser(state) },
        ...(nudge ? [{ role: 'user' as const, content: nudge }] : []),
      ],
      temperature: params.temperature ?? DECIDE_TEMPERATURE,
      response_format: params.response_format ?? { type: 'json_object' },
      max_tokens: params.max_tokens ?? DECIDE_MAX_TOKENS,
    })
    const parsed = parseDecideJson(reply.content)
    trace.push({
      stage: 'decide',
      raw: reply.content,
      tool: parsed.tool,
      args: parsed.args,
      usage: reply.usage,
      latencyMs: reply.latencyMs,
    })
    return parsed
  }

  const actionHits: string[] = []
  const loopMessages: LlmMessage[] = []
  const attempted = new Set<string>()
  const repeatNudged = new Set<string>()
  let actRefusal: string | undefined
  let nudgeUsed = false
  let stoppedByPause = false

  const runAction = async (
    tool: string,
    rawArgs: DecidedToolArgs,
  ): Promise<ToolOutcome> => {
    const requestedTool = tools.find((entry) => entry.name === tool) ?? null
    const gate = hooks.policy?.gate?.(state, tool)
    const denied = (text: string): ToolOutcome => {
      const outcome: ToolOutcome = { ok: false, text, reference: null }
      state.actions.push({ tool, args: {}, outcome })
      actRefusal = text
      trace.push({
        stage: 'act',
        tool,
        args: rawArgs,
        outcome,
        mutating: requestedTool?.mutating ?? true,
      })
      return outcome
    }
    if (!requestedTool || (gate && !gate.allow)) {
      const text =
        gate && !gate.allow ? gate.reason : `Инструмент ${tool} недоступен.`
      return denied(text)
    }
    const resolved = resolveArgRefs(rawArgs, state.outputs)
    if (!resolved.ok) {
      return denied(resolved.error)
    }
    let screenedArgs = resolved.args
    if (requestedTool.screenArgs) {
      try {
        screenedArgs = await requestedTool.screenArgs(
          resolved.args,
          config.toolContext,
        )
      } catch {
        screenedArgs = resolved.args
      }
    }
    const check = hooks.policy?.checkAction?.(state, {
      tool,
      args: screenedArgs,
    })
    if (check && !check.ok) {
      actionHits.push(...check.hits)
      const outcome: ToolOutcome = {
        ok: false,
        text: `Действие отклонено: ${check.reason}\nПредлагаю совместимый вариант без нарушения правила.`,
        reference: null,
      }
      state.actions.push({ tool, args: resolved.args, outcome })
      actRefusal = outcome.text
      trace.push({
        stage: 'act',
        tool,
        args: rawArgs,
        outcome,
        mutating: requestedTool.mutating ?? true,
        invariantHits: check.hits,
      })
      return outcome
    }
    const outcome = await requestedTool.run(resolved.args, config.toolContext)
    state.actions.push({ tool, args: resolved.args, outcome })
    trace.push({
      stage: 'act',
      tool,
      args: rawArgs,
      outcome: traceOutcome(outcome),
      mutating: requestedTool.mutating ?? true,
    })
    if (!outcome.ok) {
      actRefusal = outcome.text
    }
    return outcome
  }

  for (let step = 0; step < maxActions; step += 1) {
    state.step = step
    if (hooks.isPaused && (await hooks.isPaused())) {
      stoppedByPause = true
      break
    }
    let decided = await runDecide(null)
    if (!decided.tool && !nudgeUsed && state.actions.length === 0) {
      const nudge = hooks.policy?.nudge?.(state) ?? null
      if (nudge) {
        nudgeUsed = true
        decided = await runDecide(nudge)
      }
    }
    if (!decided.tool) {
      break
    }
    let key = repeatKey(decided.tool, decided.args)
    if (attempted.has(key)) {
      const repeatNudge =
        !repeatNudged.has(key) && hooks.policy?.onRepeat
          ? hooks.policy.onRepeat(state, {
              tool: decided.tool,
              args: decided.args,
            })
          : null
      if (!repeatNudge) {
        break
      }
      repeatNudged.add(key)
      decided = await runDecide(repeatNudge)
      if (!decided.tool) {
        break
      }
      key = repeatKey(decided.tool, decided.args)
      if (attempted.has(key)) {
        break
      }
    }
    attempted.add(key)
    if (hooks.isPaused && (await hooks.isPaused())) {
      stoppedByPause = true
      break
    }
    const outcome = await runAction(decided.tool, decided.args)
    if (!outcome.ok) {
      break
    }
    const output: ToolOutput = {
      id: state.outputs.length + 1,
      tool: decided.tool,
      text: outcome.text,
      refText: outcome.refText,
    }
    state.outputs.push(output)
    loopMessages.push({
      role: 'assistant',
      content: JSON.stringify({ tool: decided.tool, args: decided.args }),
    })
    loopMessages.push({
      role: 'user',
      content: [
        `ОТЧЁТ ИНСТРУМЕНТА (${decided.tool}) [output_id=${output.id}]:`,
        outcome.text,
        ...(outcome.reference
          ? [`Код подтверждения: ${outcome.reference}`]
          : []),
        '',
        `Чтобы передать этот вывод в следующий инструмент, укажи {"$ref": "${output.id}"} или {"$ref": "last"} в нужном аргументе вместо копирования текста.`,
        'Если текущий шаг ещё не завершён — верни следующий инструмент в его рамках. Если шаг выполнен — верни {"tool": null, "args": {}}.',
      ].join('\n'),
    })
  }

  const pauseProbe = hooks.isPaused
  const pausedNow = pauseProbe ? await pauseProbe() : false
  const actions = state.actions
  const silentPause = pausedNow && actions.length === 0

  const failed = actions.find((action) => !action.outcome.ok)
  let answer = ''
  let toolReport = ''
  if (failed) {
    answer = actions.map((action) => action.outcome.text).join('\n\n')
  } else if (!silentPause) {
    toolReport = formatToolReport(actions)
    const pauseNote = stoppedByPause
      ? '\n\nПользователь поставил задачу на паузу — не выполняй дальнейшие действия, коротко сообщи, что выполнение приостановлено.'
      : ''
    const params = hooks.prompts.finalizeParams?.(state) ?? {
      temperature: FINALIZE_TEMPERATURE,
      max_tokens: FINALIZE_MAX_TOKENS,
    }
    const finalizeReply = await config.callLLM({
      messages: [
        ...hooks.prompts.systemMessages(state, 'finalize'),
        {
          role: 'user',
          content: hooks.prompts.finalizeUser(
            state,
            toolReport + pauseNote,
            stoppedByPause,
          ),
        },
      ],
      temperature: params.temperature ?? FINALIZE_TEMPERATURE,
      max_tokens: params.max_tokens ?? FINALIZE_MAX_TOKENS,
    })
    answer = finalizeReply.content
    trace.push({
      stage: 'finalize',
      answer,
      usage: finalizeReply.usage,
      latencyMs: finalizeReply.latencyMs,
    })
  }

  let verdicts = silentPause
    ? []
    : (hooks.policy?.judges?.(state, answer) ?? []).map((judge) =>
        judge.evaluate({
          request,
          actions,
          answer,
          allowedTools: allowedToolNames,
        }),
      )
  const answerCheck: CheckResult = silentPause
    ? { ok: true, hits: [], reason: null }
    : (hooks.policy?.checkAnswer?.(state, answer) ?? {
        ok: true,
        hits: [],
        reason: null,
      })
  let invariantHits = [...new Set([...answerCheck.hits, ...actionHits])]
  let guardVerdict: GuardVerdict | null = null
  if (!silentPause && !failed && answerCheck.ok && hooks.policy?.guard) {
    try {
      guardVerdict = await hooks.policy.guard(state, {
        answer,
        report: toolReport,
      })
      if (guardVerdict) {
        const guardJudge: JudgeVerdict = {
          judge: 'invariant-guard',
          status: guardVerdict.status,
          message:
            guardVerdict.reason ??
            (guardVerdict.status === 'pass'
              ? 'Пользовательские инварианты не нарушены.'
              : 'Ответ нарушает пользовательский инвариант.'),
        }
        verdicts = [...verdicts, guardJudge]
        invariantHits = [...new Set([...invariantHits, ...guardVerdict.hits])]
        trace.push({
          stage: 'invariant-guard',
          verdict: guardJudge,
          hits: guardVerdict.hits,
          usage: guardVerdict.usage,
          latencyMs: guardVerdict.latencyMs,
        })
      }
    } catch (error) {
      trace.push({
        stage: 'invariant-guard',
        verdict: {
          judge: 'invariant-guard',
          status: 'pass',
          message:
            'LLM-проверка инвариантов недоступна; ответ не заблокирован.',
        },
        hits: [],
        usage: null,
        latencyMs: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  if (!silentPause) {
    trace.push({ stage: 'verdicts', verdicts })
  }

  const failing = verdicts.filter((verdict) => verdict.status === 'fail')
  const guardFailed = guardVerdict?.status === 'fail'
  const actionInvariantFailed = actionHits.length > 0
  const blocked =
    failing.length > 0 ||
    !answerCheck.ok ||
    actionInvariantFailed ||
    guardFailed
  const info = {
    answerCheck,
    actionHits,
    guardVerdict,
    failing,
    actRefusal,
  }
  let reason: string | null = null
  if (blocked) {
    const rendered = hooks.policy?.onBlocked?.(state, info)
    reason = rendered?.reason ?? defaultBlockedReason(info)
    answer =
      rendered?.answer ??
      `Ответ заблокирован политикой цикла: ${reason ?? 'нарушение правил'}`
  }

  const usage = sumUsage(trace)
  const latencyMs = sumLatency(trace)
  const promptTokensActual = usage?.prompt_tokens ?? 0
  const responseTokens = usage?.completion_tokens ?? 0
  const cacheHitTokens = usage?.prompt_cache_hit_tokens ?? 0
  const cacheMissTokens =
    usage?.prompt_cache_miss_tokens ??
    Math.max(0, promptTokensActual - cacheHitTokens)
  const tokens: TokenBreakdown = {
    requestTokens,
    historyTokens,
    historyTokensSent: historyTokens,
    contextTokens,
    contextMessages,
    responseTokens,
    promptTokensActual,
    cacheHitTokens,
    cacheMissTokens,
    costUsd: hooks.cost?.(usage) ?? 0,
  }
  return {
    ok: !blocked,
    blocked,
    reason,
    answer,
    trace,
    verdicts,
    usage,
    latencyMs,
    model: config.model,
    tokens,
    invariantHits,
  }
}
