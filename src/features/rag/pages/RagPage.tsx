import ComparisonPanel from '../components/ComparisonPanel'
import IndexPanel from '../components/IndexPanel'
import SearchPanel from '../components/SearchPanel'
import AnswerPanel from '../components/AnswerPanel'
import ControlPanel from '../components/ControlPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

export default function RagPage() {
  return (
    <div className="page-wrap flex flex-col gap-4 px-4 pb-8 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">
          RAG · индексация, реранкинг, rewrite
        </p>
        <h1 className="demo-title mb-2">Индекс документов</h1>
        <p className="demo-muted m-0 max-w-[70ch] text-sm">
          15 статей Википедии о городах России разбиваются на чанки двумя
          стратегиями, считаются эмбеддинги, всё складывается в локальный
          SQLite. Второй этап после поиска — cross-encoder реранкер с порогом
          отсечения, а также LLM-переформулировка запроса. Сравни структуру
          чанков, метрики поиска по режимам и ответы модели с RAG и без.
        </p>
      </header>

      <Tabs defaultValue="index" className="flex flex-col gap-3">
        <TabsList>
          <TabsTrigger value="index">Индекс</TabsTrigger>
          <TabsTrigger value="search">Поиск</TabsTrigger>
          <TabsTrigger value="answer">Ответ</TabsTrigger>
          <TabsTrigger value="control">Контроль</TabsTrigger>
          <TabsTrigger value="compare">Сравнение</TabsTrigger>
        </TabsList>
        <TabsContent value="index">
          <IndexPanel />
        </TabsContent>
        <TabsContent value="search">
          <SearchPanel />
        </TabsContent>
        <TabsContent value="answer">
          <AnswerPanel />
        </TabsContent>
        <TabsContent value="control">
          <ControlPanel />
        </TabsContent>
        <TabsContent value="compare">
          <ComparisonPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
