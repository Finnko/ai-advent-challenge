import type { RawDoc } from './types'

export type CorpusRef = {
  id: string
  title: string
  source: string
}

export type CorpusSource = {
  list(): Promise<CorpusRef[]>
  load(ref: CorpusRef): Promise<RawDoc>
}
