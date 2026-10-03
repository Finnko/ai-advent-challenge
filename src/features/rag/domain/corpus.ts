import type { RawDoc } from './types'

export type CorpusRef = {
  id: string
  title: string
  source: string
}

export type CorpusDocStatus = {
  id: string
  title: string
  source: string
  cached: boolean
  charCount: number | null
}

export type CorpusSource = {
  list(): Promise<CorpusRef[]>
  load(ref: CorpusRef): Promise<RawDoc>
  status(refs?: CorpusRef[]): Promise<CorpusDocStatus[]>
}
