export type PersonaKind = 'employee' | 'manager'

export type ToolInfo = {
  name: string
  label: string
  description: string
  roles: PersonaKind[]
}

export const TOOL_INFO: ToolInfo[] = [
  {
    name: 'bookMeetingRoom',
    label: 'bookMeetingRoom',
    description:
      'Забронировать переговорку под встречу: комната, дата, время, длительность, тема (вместимость комнаты — 5). Проверяет пересечения.',
    roles: ['employee', 'manager'],
  },
  {
    name: 'listBookings',
    label: 'listBookings',
    description:
      'Показать встречи: свои, встречи, куда вас пригласили, а руководителю — ещё и встречи команды.',
    roles: ['employee', 'manager'],
  },
  {
    name: 'listAvailableRooms',
    label: 'listAvailableRooms',
    description:
      'Показать, какие переговорки свободны на дату и время, а какие заняты (с временем брони).',
    roles: ['employee', 'manager'],
  },
  {
    name: 'inviteToMeeting',
    label: 'inviteToMeeting',
    description:
      'Пригласить сотрудников на существующую встречу по комнате/дате/времени. Свою — любой; руководитель — и во встречу подчинённого.',
    roles: ['employee', 'manager'],
  },
  {
    name: 'cancelBooking',
    label: 'cancelBooking',
    description:
      'Отменить встречу по комнате/дате/времени. Свою — любой; руководитель может отменять и встречи подчинённых.',
    roles: ['employee', 'manager'],
  },
  {
    name: 'requestVacation',
    label: 'requestVacation',
    description:
      'Подать заявку на отпуск (статус — ожидает согласования руководителя).',
    roles: ['employee', 'manager'],
  },
  {
    name: 'approveVacation',
    label: 'approveVacation',
    description:
      'Согласовать отпуск своего подчинённого. Доступен только руководителю.',
    roles: ['manager'],
  },
  {
    name: 'listVacations',
    label: 'listVacations',
    description:
      'Показать отпуска команды: согласованные руководителем и ожидающие от подчинённых. Только руководитель.',
    roles: ['manager'],
  },
]
