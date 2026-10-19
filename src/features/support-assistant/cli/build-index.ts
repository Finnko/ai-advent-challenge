import { buildSupportIndex, getSupportIndexStats } from '../server/index.server'

async function main() {
  const startedAt = Date.now()
  const result = await buildSupportIndex()
  const stats = await getSupportIndexStats()
  console.log(
    [
      `Индекс поддержки Ozon собран за ${Date.now() - startedAt} мс.`,
      `Документов: ${result.documents}, чанков: ${result.chunks}.`,
      `Модель: ${result.model}, размерность: ${result.dim}.`,
      `Дата сборки: ${result.builtAt}.`,
      `Стратегия: ${result.strategy}, документов в БД: ${stats.documents.length}.`,
    ].join('\n'),
  )
}

await main()
