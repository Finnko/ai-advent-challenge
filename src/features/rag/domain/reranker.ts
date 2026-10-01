export type RerankInput = {
  query: string
  documents: string[]
}

export type Reranker = {
  id: string
  rerank(input: RerankInput): Promise<number[]>
}

export function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

function terms(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

export function lexicalRelevance(query: string, document: string): number {
  const queryTerms = [...new Set(terms(query))]
  if (queryTerms.length === 0) {
    return 0
  }
  const documentTerms = new Set(terms(document))
  let hits = 0
  for (const term of queryTerms) {
    if (documentTerms.has(term)) {
      hits += 1
    }
  }
  return hits / queryTerms.length
}

export function createLexicalReranker(): Reranker {
  return {
    id: 'lexical',
    async rerank({ query, documents }) {
      return documents.map((document) => lexicalRelevance(query, document))
    },
  }
}
