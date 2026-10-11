import type { PromptVariantId } from './prompts'

export type ContextMode = 'lead' | 'extended'

export type AxisId =
  'baseline' | 'prompt' | 'temperature' | 'max_tokens' | 'context' | 'json'

export type ExperimentConfig = {
  id: string
  label: string
  axis: AxisId
  promptId: PromptVariantId
  temperature: number
  maxTokens: number
  contextMode: ContextMode
  jsonMode: boolean
  repeats: number
}

export const AXIS_LABELS: Record<AxisId, string> = {
  baseline: 'Базовая конфигурация',
  prompt: 'Prompt-шаблон',
  temperature: 'Temperature',
  max_tokens: 'max_tokens',
  context: 'Размер контекста',
  json: 'JSON-режим',
}

type ConfigSeed = {
  label: string
  axis: AxisId
  promptId: PromptVariantId
  temperature: number
  maxTokens: number
  contextMode: ContextMode
  jsonMode: boolean
}

function configId(seed: ConfigSeed): string {
  return [
    seed.promptId,
    `t${seed.temperature}`,
    `mt${seed.maxTokens}`,
    seed.contextMode,
    seed.jsonMode ? 'json' : 'raw',
  ].join('-')
}

function makeConfig(seed: ConfigSeed): ExperimentConfig {
  return {
    ...seed,
    id: configId(seed),
    repeats: seed.temperature > 0 ? 3 : 1,
  }
}

function base(overrides: Partial<ConfigSeed>): ExperimentConfig {
  return makeConfig({
    label: 'P0 · t0 · 256 · лид · JSON',
    axis: 'baseline',
    promptId: 'p0',
    temperature: 0,
    maxTokens: 256,
    contextMode: 'lead',
    jsonMode: true,
    ...overrides,
  })
}

const DEFAULT_CONFIG = base({
  label: 'P1 · схема',
  axis: 'prompt',
  promptId: 'p1',
})

export const DEFAULT_CONFIG_ID = DEFAULT_CONFIG.id

export const SWEEP_CONFIGS: ExperimentConfig[] = [
  base({ label: 'База · P0 · t0 · 256 · лид · JSON', axis: 'baseline' }),
  DEFAULT_CONFIG,
  base({
    label: 'P2 · схема + пример',
    axis: 'prompt',
    promptId: 'p2',
  }),
  base({
    label: 't0.3 · P1',
    axis: 'temperature',
    promptId: 'p1',
    temperature: 0.3,
  }),
  base({
    label: 't0.7 · P1',
    axis: 'temperature',
    promptId: 'p1',
    temperature: 0.7,
  }),
  base({
    label: 'max_tokens 512 · P1',
    axis: 'max_tokens',
    promptId: 'p1',
    maxTokens: 512,
  }),
  base({
    label: 'Контекст: расширенная выдержка · P1',
    axis: 'context',
    promptId: 'p1',
    contextMode: 'extended',
  }),
  base({
    label: 'JSON-режим выключен · P1',
    axis: 'json',
    promptId: 'p1',
    jsonMode: false,
  }),
]

export function resolveConfig(id: string): ExperimentConfig {
  const config = SWEEP_CONFIGS.find((candidate) => candidate.id === id)
  if (!config) {
    throw new Error(`Неизвестная конфигурация: ${id}`)
  }
  return config
}
