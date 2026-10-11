import { useMemo } from 'react'
import type { FieldId } from '../domain/extraction'
import {
  pickWinner,
  type GroupSummary,
  type StoredRun,
} from '../domain/results'
import ConfigTable from './ConfigTable'
import FindingsList from './FindingsList'
import QuantCards from './QuantCards'
import RawResultsTable from './RawResultsTable'
import RecommendationCard from './RecommendationCard'
import SummaryTiles from './SummaryTiles'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

type ResultsViewProps = {
  summaries: GroupSummary[]
  runs: StoredRun[]
  defaultConfigId: string
  fields: FieldId[]
  fieldLabels: Record<FieldId, string>
}

export default function ResultsView({
  summaries,
  runs,
  defaultConfigId,
  fields,
  fieldLabels,
}: ResultsViewProps) {
  const winnerKeys = useMemo(() => {
    const models = [...new Set(summaries.map((summary) => summary.model))]
    return models.flatMap((model) => {
      const winner = pickWinner(
        summaries.filter((summary) => summary.model === model),
      )
      return winner ? [`${model}::${winner.configId}`] : []
    })
  }, [summaries])

  return (
    <Tabs defaultValue="summary">
      <TabsList aria-label="Результаты оптимизации">
        <TabsTrigger value="summary">Итог</TabsTrigger>
        <TabsTrigger value="models">Модели</TabsTrigger>
        <TabsTrigger value="configs">Конфигурации</TabsTrigger>
        <TabsTrigger value="raw">Как есть</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="flex flex-col gap-4">
        <RecommendationCard
          summaries={summaries}
          defaultConfigId={defaultConfigId}
        />
        <SummaryTiles
          summaries={summaries}
          runs={runs}
          defaultConfigId={defaultConfigId}
        />
        <p className="demo-muted m-0 text-xs">
          <span className="font-semibold text-[var(--ink-soft)]">Точность</span>{' '}
          — доля верных полей (год, площадь, округ).{' '}
          <span className="font-semibold text-[var(--ink-soft)]">
            Полный JSON
          </span>{' '}
          — доля документов, где верны все три поля.{' '}
          <span className="font-semibold text-[var(--ink-soft)]">
            Валидный JSON
          </span>{' '}
          — доля ответов, успешно распарсенных как JSON.
        </p>
        <FindingsList summaries={summaries} defaultConfigId={defaultConfigId} />
      </TabsContent>

      <TabsContent value="models">
        <QuantCards summaries={summaries} defaultConfigId={defaultConfigId} />
      </TabsContent>

      <TabsContent value="configs">
        <ConfigTable summaries={summaries} defaultConfigId={defaultConfigId} />
      </TabsContent>

      <TabsContent value="raw">
        <RawResultsTable
          summaries={summaries}
          winnerKeys={winnerKeys}
          defaultConfigId={defaultConfigId}
          fields={fields}
          fieldLabels={fieldLabels}
        />
      </TabsContent>
    </Tabs>
  )
}
