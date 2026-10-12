// Нагрузочный прогон приватного LLM-сервиса: N одновременных клиентов × M запросов.
// Показывает success-rate, распределение статусов и p50/p95 латентности.
// Запуск: npm run llm-service:load   (env: LLM_SERVICE_URL, LLM_SERVICE_LOAD_KEY, LLM_SERVICE_KEYS)

const baseUrl = (
  process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8088'
).replace(/\/$/, '')
const concurrency = Number(process.env.LOAD_CONCURRENCY || 5)
const total = Number(process.env.LOAD_REQUESTS || 20)
const prompt =
  process.env.LOAD_PROMPT ||
  'Ответь одним коротким предложением: что такое локальная LLM?'

function firstKey(raw) {
  if (!raw) {
    return ''
  }
  const first = raw.split(',')[0].trim()
  const separator = first.indexOf(':')
  return separator === -1 ? first : first.slice(separator + 1).trim()
}

const key =
  process.env.LLM_SERVICE_LOAD_KEY || firstKey(process.env.LLM_SERVICE_KEYS)
if (!key) {
  console.error('Задай LLM_SERVICE_LOAD_KEY или LLM_SERVICE_KEYS.')
  process.exit(1)
}

async function one() {
  const startedAt = performance.now()
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    })
    await res.text()
    return { status: res.status, ms: performance.now() - startedAt }
  } catch (error) {
    return {
      status: 0,
      ms: performance.now() - startedAt,
      error: String(error),
    }
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) {
    return 0
  }
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  )
  return sorted[index]
}

function round(value) {
  return Math.round(value)
}

let next = 0
const results = []

async function worker() {
  while (true) {
    const index = next
    next += 1
    if (index >= total) {
      return
    }
    results.push(await one())
  }
}

console.log(`Прогон: ${total} запросов, ${concurrency} параллельно, ${baseUrl}`)
const startedAt = performance.now()
await Promise.all(Array.from({ length: concurrency }, () => worker()))
const wallMs = performance.now() - startedAt

const byStatus = new Map()
for (const result of results) {
  byStatus.set(result.status, (byStatus.get(result.status) ?? 0) + 1)
}

const ok = byStatus.get(200) ?? 0
const latencies = results
  .filter((result) => result.status === 200)
  .map((result) => result.ms)
  .sort((a, b) => a - b)

console.log('')
console.log(`стена:            ${round(wallMs)} мс`)
console.log(`успешно (200):    ${ok}/${total} (${round((ok / total) * 100)}%)`)
console.log(
  'статусы:          ' +
    [...byStatus.entries()].map(([s, n]) => `${s || 'сеть'}=${n}`).join(', '),
)
console.log(`латентность p50:  ${round(percentile(latencies, 50))} мс`)
console.log(`латентность p95:  ${round(percentile(latencies, 95))} мс`)
