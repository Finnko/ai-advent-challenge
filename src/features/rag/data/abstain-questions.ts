export type AbstainQuestion = {
  id: string
  query: string
  note: string
}

export const ABSTAIN_QUESTIONS: AbstainQuestion[] = [
  {
    id: 'x1',
    query: 'Какая высота у телебашни в Урюпинске?',
    note: 'Города нет в корпусе — ожидается «не знаю».',
  },
  {
    id: 'x2',
    query: 'Сколько жителей было в Сиднее в 1900 году?',
    note: 'Зарубежный город, корпус только о городах России.',
  },
  {
    id: 'x3',
    query: 'Какой урожай пшеницы собрали в Казани в 1834 году?',
    note: 'Казань в корпусе есть, но такого факта в статье нет.',
  },
]
