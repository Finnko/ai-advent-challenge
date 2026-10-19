const ABSTAIN_MARKERS = [
  'в базе знаний нет ответа',
  'в базе знаний ozon нет ответа',
  'в базе знаний нет информации',
  'в базе знаний ozon нет информации',
  'в базе знаний нет данных',
  'в базе знаний нет однозначного ответа',
  'в документации нет ответа',
  'в документации нет информации',
  'нет ответа на вопрос',
  'нет однозначного ответа',
  'недостаточно данных',
  'не удалось найти',
]

function docsSection(answer: string): string {
  const match = /###\s*По документации\s*\n([\s\S]*?)(?=\n###\s|$)/i.exec(
    answer,
  )
  return match ? match[1] : answer
}

export function looksAbstained(answer: string): boolean {
  const normalized = docsSection(answer).toLowerCase().replace(/ё/g, 'е')
  return ABSTAIN_MARKERS.some((marker) => normalized.includes(marker))
}
