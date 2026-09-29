import ComparisonPanel from '../components/ComparisonPanel'
import IndexPanel from '../components/IndexPanel'
import SearchPanel from '../components/SearchPanel'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'

export default function RagPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pb-6 pt-6">
      <header className="mb-1">
        <p className="island-kicker mb-2">RAG · индексация документов</p>
        <h1 className="demo-title mb-2">Индекс документов</h1>
        <p className="demo-muted m-0 max-w-4xl text-sm">
          15 статей Википедии о городах России разбиваются на чанки двумя
          стратегиями, считаются эмбеддинги, всё складывается в локальный SQLite.
          Сравни структуру чанков и качество поиска между стратегиями.
        </p>
      </header>

      <Tabs defaultValue="index" className="flex flex-col gap-3">
        <TabsList>
          <TabsTrigger value="index">Индекс</TabsTrigger>
          <TabsTrigger value="search">Поиск</TabsTrigger>
          <TabsTrigger value="compare">Сравнение</TabsTrigger>
        </TabsList>
        <TabsContent value="index">
          <IndexPanel />
        </TabsContent>
        <TabsContent value="search">
          <SearchPanel />
        </TabsContent>
        <TabsContent value="compare">
          <ComparisonPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
