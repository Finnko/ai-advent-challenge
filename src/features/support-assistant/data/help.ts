export type SupportScenario = {
  id: string
  label: string
  question: string
  sellerId: string
  ticketId: string
}

export const SUPPORT_SCENARIOS: SupportScenario[] = [
  {
    id: 'login',
    label: 'Не пускает в кабинет',
    question: 'Почему у меня ограничен доступ в личный кабинет и что сделать?',
    sellerId: 'seller_1042',
    ticketId: 'ticket_501',
  },
  {
    id: 'orders',
    label: 'Не приходят заказы',
    question:
      'Почему по отправлению нет движения и что делать со сроком сборки?',
    sellerId: 'seller_1042',
    ticketId: 'ticket_502',
  },
  {
    id: 'payout',
    label: 'Когда выплата',
    question: 'Когда будет следующая выплата и от чего зависит сумма?',
    sellerId: 'seller_2087',
    ticketId: 'ticket_503',
  },
  {
    id: 'card',
    label: 'Отклонили карточку',
    question: 'Где посмотреть ошибки в карточке товара и как их исправить?',
    sellerId: 'seller_3310',
    ticketId: 'ticket_504',
  },
  {
    id: 'unknown',
    label: 'Вопрос не из базы',
    question: 'Какая погода в Москве завтра?',
    sellerId: 'seller_1042',
    ticketId: 'ticket_501',
  },
]
