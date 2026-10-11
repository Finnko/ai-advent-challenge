import { describe, expect, it } from 'vitest'
import { getLocalLlmStatus } from '@lib/local-llm.server'
import { SWEEP_CONFIGS, type ExperimentConfig } from '../data/configs'
import { OPT_DOC_IDS } from '../data/dataset'
import { pickWinner, summarizeRuns } from '../domain/results'
import { upsertRun } from '../server/results.server'
import { runExtraction } from '../server/run.server'

const enabled = process.env.RUN_MODEL_TESTS === '1'

function byEnv(value: string | undefined, all: string[]): string[] {
  if (!value) {
    return all
  }
  const ids = value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return all.filter((id) => ids.includes(id))
}

function selectedConfigs(): ExperimentConfig[] {
  const ids = byEnv(
    process.env.LLM_OPT_SWEEP,
    SWEEP_CONFIGS.map((config) => config.id),
  )
  return SWEEP_CONFIGS.filter((config) => ids.includes(config.id))
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

describe.skipIf(!enabled)('llm-opt sweep on a real model', () => {
  it(
    'прогоняет sweep, пишет результаты и печатает таблицу',
    async () => {
      const status = await getLocalLlmStatus()
      expect(
        status.available,
        status.error ?? 'локальный сервер недоступен',
      ).toBe(true)

      const configs = selectedConfigs()
      const docs = byEnv(process.env.LLM_OPT_DOCS, OPT_DOC_IDS)
      const collected = []

      for (const config of configs) {
        for (const docId of docs) {
          for (let repeat = 0; repeat < config.repeats; repeat += 1) {
            const run = await runExtraction(config, docId, repeat)
            upsertRun(run)
            collected.push(run)
            console.log(
              `${config.id} · ${docId} · repeat ${repeat} · score ${run.score} · ${run.latencyMs} мс · ${run.format}`,
            )
          }
        }
      }

      const summaries = summarizeRuns(collected)
      const lines = [
        '| configuration | model | fields | full | json | latency | tok/s | rss |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ]
      for (const summary of summaries) {
        lines.push(
          `| ${summary.label} | ${summary.model} | ${percent(summary.overallAccuracy)} | ${percent(summary.fullMatchRate)} | ${percent(summary.jsonRate)} | ${Math.round(summary.avgLatencyMs ?? 0)} мс | ${summary.avgTokensPerSecond?.toFixed(1) ?? '—'} | ${summary.peakMemMb ?? '—'} МБ |`,
        )
      }
      console.log(`\n${lines.join('\n')}\n`)
      console.log(
        'winner:',
        pickWinner(summaries)?.configId ?? '—',
        'по модели',
      )

      expect(collected.length).toBeGreaterThan(0)
    },
    1000 * 60 * 180,
  )
})
