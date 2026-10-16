import type { LoopTraceStep } from '@lib/agent-loop/types'
import { findFileScenario, FILE_SCENARIOS } from '../data/file-scenarios'
import {
  approveFileTask,
  runFileGoal,
  type FileTaskOutcome,
} from '../server/file-task.server'

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index === -1 ? null : (process.argv[index + 1] ?? null)
}

function env(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

function printTrace(trace: LoopTraceStep[]): void {
  for (const step of trace) {
    if (step.stage === 'decide') {
      console.log(`  decide → ${step.tool ?? 'ответ без инструмента'}`)
    } else if (step.stage === 'act') {
      console.log(`  act → ${step.tool}`)
    }
  }
}

function printOutcome(outcome: FileTaskOutcome): void {
  if (outcome.kind === 'read') {
    console.log('Режим: чтение (без Задачи)')
    console.log(`Шагов в trace: ${outcome.trace.length}`)
    printTrace(outcome.trace)
    console.log('\nОтвет:\n' + outcome.answer)
    if (outcome.diff && outcome.diff.trim().length > 0) {
      console.log('\nDiff:\n' + outcome.diff)
    }
    return
  }
  if (outcome.kind === 'plan') {
    console.log(`План «${outcome.state.title}» (задача #${outcome.taskId}):`)
    outcome.state.steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step}`)
    })
    return
  }
  if (outcome.kind === 'done') {
    console.log(`Изменённые файлы (${outcome.touched.length}):`)
    outcome.touched.forEach((path) => console.log(`  ${path}`))
    printTrace(outcome.trace)
    if (outcome.diff.trim().length > 0) {
      console.log('\nDiff:\n' + outcome.diff)
    }
    console.log('\nОтвет:\n' + outcome.answer)
    if (outcome.unfinished.length > 0) {
      console.log(
        `\n[file-assistant] не выполнено (${outcome.unfinished.length}): ${outcome.unfinished.join('; ')}`,
      )
    } else if (outcome.notChanged) {
      console.log('\n[file-assistant] файлы не изменены.')
    }
    if (outcome.retried) {
      console.log('\n[file-assistant] понадобилась одна повторная попытка.')
    }
  }
}

async function main(): Promise<void> {
  const scenarioId = argValue('--scenario')
  const goalArg = argValue('--goal')
  const scenario = scenarioId ? findFileScenario(scenarioId) : null
  if (scenarioId && !scenario) {
    console.log(
      `Неизвестный сценарий «${scenarioId}». Доступные: ${FILE_SCENARIOS.map((item) => item.id).join(', ')}.`,
    )
    return
  }
  const goal = goalArg ?? scenario?.goal
  if (!goal) {
    console.log('Укажите --goal "<цель>" или --scenario <id>.')
    return
  }

  const generator =
    env('FILE_ASSISTANT_GENERATOR') === 'local' ? 'local' : 'cloud'
  const apply = process.argv.includes('--apply')
  const planOnly =
    process.argv.includes('--plan-only') ||
    (!apply && (scenario?.mode ?? 'write') === 'write')

  const first = await runFileGoal({
    goal,
    generator,
    scenario: scenario?.id ?? null,
  })
  if (first.kind === 'docs') {
    console.log(
      'Запрос не похож на файловую задачу — вопросы по докам задавайте на странице /dev-assistant.',
    )
    return
  }
  if (first.kind !== 'plan') {
    printOutcome(first)
    return
  }

  printOutcome(first)
  if (planOnly) {
    console.log('\n[plan-only] повторный запуск с --apply выполнит план.')
    return
  }

  const done = await approveFileTask({ taskId: first.taskId, generator })
  printOutcome(done)
}

await main()
