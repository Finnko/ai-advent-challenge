import { describe, expect, it } from 'vitest'
import type { AgentTool } from './agent'
import { ROOMS, ROOM_CAPACITY, createAgentTools } from './agent-tools'
import {
  createBooking,
  createFakeStore,
  createIdentity,
  createManagerIdentity,
  createVacation,
  type FakeStore,
} from './agent-testkit'

function getTool(store: FakeStore, name: string): AgentTool {
  const tool = createAgentTools(store).find((item) => item.name === name)
  if (!tool) {
    throw new Error(`Инструмент ${name} не найден`)
  }
  return tool
}

describe('bookMeetingRoom', () => {
  it('бронирует указанную комнату с фиксированной вместимостью', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'bookMeetingRoom').run(
      {
        room: 'Иртыш',
        date: '2026-09-11',
        time: '16:00',
        duration: 60,
        title: 'Синк',
      },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.reference).toMatch(/^BOOK-/)
    expect(outcome.text).toContain('Переговорка «Иртыш»')
    expect(outcome.text).toContain(`(${ROOM_CAPACITY} чел.)`)
    expect(store.bookings).toHaveLength(1)
    expect(store.bookings[0].capacity).toBe(ROOM_CAPACITY)
    expect(store.bookings[0].bookedBy).toBe('Пётр')
  })

  it('понимает короткое имя комнаты без слова «Переговорка»', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'bookMeetingRoom').run(
      { room: 'Ладогу', date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0].room).toBe('Переговорка «Ладога»')
  })

  it('отказывает на неизвестной комнате', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'bookMeetingRoom').run(
      { room: 'Марс', date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Нет такой переговорки')
  })

  it('отказывает при пересечении по времени', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ room: 'Переговорка «Иртыш»' })],
    })
    const outcome = await getTool(store, 'bookMeetingRoom').run(
      { room: 'Иртыш', date: '2026-09-11', time: '16:30' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('занята')
  })

  it('без комнаты выбирает первую свободную', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ room: ROOMS[0] })],
    })
    const outcome = await getTool(store, 'bookMeetingRoom').run(
      { date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings.at(-1)?.room).toBe(ROOMS[1])
  })

  it('отказывает, когда все комнаты заняты', async () => {
    const store = createFakeStore({
      bookings: ROOMS.map((room) => createBooking({ room })),
    })
    const outcome = await getTool(store, 'bookMeetingRoom').run(
      { date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Все переговорки заняты')
  })

  it('валидирует дату и время', async () => {
    const store = createFakeStore()
    const tool = getTool(store, 'bookMeetingRoom')
    expect(
      (await tool.run({ date: '11.09.2026', time: '16:00' }, createIdentity()))
        .text,
    ).toContain('не в формате YYYY-MM-DD')
    expect(
      (await tool.run({ date: '2026-09-11', time: '4pm' }, createIdentity()))
        .text,
    ).toContain('не в формате HH:MM')
    expect((await tool.run({}, createIdentity())).text).toContain(
      'Не указаны дата и время',
    )
  })
})

describe('listAvailableRooms', () => {
  it('разделяет свободные и занятые комнаты', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ room: ROOMS[0] })],
    })
    const outcome = await getTool(store, 'listAvailableRooms').run(
      { date: '2026-09-11', time: '16:00', duration: 60 },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.text).toContain('Свободны')
    expect(outcome.text).toContain(ROOMS[1])
    expect(outcome.text).toContain('Занято')
    expect(outcome.text).toContain(ROOMS[0])
  })

  it('сообщает, когда свободных комнат нет', async () => {
    const store = createFakeStore({
      bookings: ROOMS.map((room) => createBooking({ room })),
    })
    const outcome = await getTool(store, 'listAvailableRooms').run(
      { date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.text).toContain('Свободных переговорок')
    expect(outcome.text).toContain('нет')
  })

  it('требует дату и время', async () => {
    const outcome = await getTool(
      createFakeStore(),
      'listAvailableRooms',
    ).run({}, createIdentity())
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Укажи дату и время')
  })
})

describe('inviteToMeeting', () => {
  it('приглашает участника в свою встречу', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      {
        room: 'Ладога',
        date: '2026-09-11',
        time: '16:00',
        participants: ['Иван'],
      },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.text).toContain('Иван')
    expect(store.bookings[0].participants).toEqual(['Иван'])
    expect(outcome.reference).toBe('BOOK-TEST01')
  })

  it('берёт последнюю бронь, если комната/дата/время не указаны', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      { participants: ['Иван'] },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0].participants).toEqual(['Иван'])
  })

  it('понимает участников строкой', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      { participants: 'Мария и Иван' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0].participants).toEqual(['Мария', 'Иван'])
  })

  it('отказывает на неизвестном сотруднике', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      { participants: ['Семён'] },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Неизвестный сотрудник')
  })

  it('не приглашает самого себя', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      { participants: ['Пётр'] },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('нет других сотрудников')
  })

  it('не дублирует уже приглашённых', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ participants: ['Иван'] })],
    })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      { participants: ['Иван'] },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.text).toContain('уже приглашены')
    expect(store.bookings[0].participants).toEqual(['Иван'])
  })

  it('отказывает при превышении вместимости', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const identity = createIdentity({
      colleagues: ['Пётр', 'Мария', 'Иван', 'Анна', 'Олег', 'Света'],
    })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      { participants: ['Мария', 'Иван', 'Анна', 'Олег', 'Света'] },
      identity,
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain(`вместимости комнаты (${ROOM_CAPACITY}`)
  })

  it('отказывает, если встреча не найдена', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'inviteToMeeting').run(
      {
        room: 'Ладога',
        date: '2026-09-11',
        time: '16:00',
        participants: ['Иван'],
      },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Встреча не найдена')
  })

  it('запрещает приглашать в чужую встречу', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Анна' })],
    })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      {
        room: 'Ладога',
        date: '2026-09-11',
        time: '16:00',
        participants: ['Иван'],
      },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('организовал')
  })

  it('руководитель приглашает в встречу подчинённого', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Пётр' })],
    })
    const outcome = await getTool(store, 'inviteToMeeting').run(
      {
        room: 'Ладога',
        date: '2026-09-11',
        time: '16:00',
        participants: ['Иван'],
      },
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0].participants).toEqual(['Иван'])
  })
})

describe('listBookings', () => {
  it('показывает свои встречи с участниками', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ participants: ['Иван'] })],
    })
    const outcome = await getTool(store, 'listBookings').run(
      {},
      createIdentity(),
    )
    expect(outcome.text).toContain('Ладога')
    expect(outcome.text).toContain('участники: Иван')
    expect(outcome.text).toContain('(моя)')
  })

  it('показывает встречи, куда пользователя пригласили', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Пётр', participants: ['Мария'] })],
    })
    const outcome = await getTool(store, 'listBookings').run(
      {},
      createIdentity({ name: 'Мария' }),
    )
    expect(outcome.text).toContain('Ладога')
    expect(outcome.text).toContain('Пётр')
  })

  it('руководитель видит встречи команды', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Пётр' })],
    })
    const outcome = await getTool(store, 'listBookings').run(
      {},
      createManagerIdentity(),
    )
    expect(outcome.text).toContain('Пётр')
  })

  it('сообщает об отсутствии встреч', async () => {
    const outcome = await getTool(
      createFakeStore(),
      'listBookings',
    ).run({}, createIdentity())
    expect(outcome.text).toContain('Записанных встреч нет')
  })
})

describe('cancelBooking', () => {
  it('отменяет свою встречу', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'cancelBooking').run(
      { room: 'Ладога', date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings).toHaveLength(0)
  })

  it('руководитель отменяет встречу подчинённого', async () => {
    const store = createFakeStore({ bookings: [createBooking()] })
    const outcome = await getTool(store, 'cancelBooking').run(
      { room: 'Ладога', date: '2026-09-11', time: '16:00' },
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.bookings).toHaveLength(0)
  })

  it('отменяет последнюю доступную встречу без явных аргументов', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Иван' })],
    })
    const outcome = await getTool(store, 'cancelBooking').run(
      {},
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.text).toContain('отменена')
    expect(store.bookings).toHaveLength(0)
  })

  it('запрещает отменять чужую встречу', async () => {
    const store = createFakeStore({
      bookings: [createBooking({ bookedBy: 'Анна' })],
    })
    const outcome = await getTool(store, 'cancelBooking').run(
      { room: 'Ладога', date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('бронировал')
  })

  it('сообщает, если встреча не найдена', async () => {
    const outcome = await getTool(createFakeStore(), 'cancelBooking').run(
      { room: 'Ладога', date: '2026-09-11', time: '16:00' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Встреча не найдена')
  })
})

describe('отпуска', () => {
  it('requestVacation создаёт заявку в ожидании', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'requestVacation').run(
      { start: '2026-09-01', end: '2026-09-12' },
      createIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.reference).toMatch(/^VAC-/)
    expect(store.vacations[0].status).toBe('pending')
  })

  it('approveVacation согласует заявку подчинённого', async () => {
    const store = createFakeStore({ vacations: [createVacation()] })
    const outcome = await getTool(store, 'approveVacation').run(
      { employeeName: 'Пётр', start: '2026-09-01', end: '2026-09-12' },
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(store.vacations[0].status).toBe('approved')
  })

  it('approveVacation берёт последнюю заявку, если аргументы не указаны', async () => {
    const store = createFakeStore({
      vacations: [
        createVacation(),
        createVacation({
          employeeName: 'Мария',
          reference: 'VAC-TEST02',
        }),
      ],
    })
    const outcome = await getTool(store, 'approveVacation').run(
      {},
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(true)
    expect(outcome.reference).toBe('VAC-TEST02')
    expect(
      store.vacations.find((item) => item.reference === 'VAC-TEST02')?.status,
    ).toBe('approved')
  })

  it('approveVacation сообщает, когда заявок нет', async () => {
    const outcome = await getTool(createFakeStore(), 'approveVacation').run(
      {},
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('Не указан сотрудник')
  })

  it('запрещает согласовать отпуск самому себе', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'approveVacation').run(
      { employeeName: 'Анна', start: '2026-09-01', end: '2026-09-12' },
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('самому себе')
  })

  it('запрещает согласовать отпуск не из команды', async () => {
    const store = createFakeStore()
    const outcome = await getTool(store, 'approveVacation').run(
      { employeeName: 'Олег', start: '2026-09-01', end: '2026-09-12' },
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('не входит в команду')
  })

  it('сообщает, если заявка не найдена', async () => {
    const outcome = await getTool(createFakeStore(), 'approveVacation').run(
      { employeeName: 'Пётр', start: '2026-09-01', end: '2026-09-12' },
      createManagerIdentity(),
    )
    expect(outcome.ok).toBe(false)
    expect(outcome.text).toContain('не найдена')
  })

  it('listVacations показывает ожидающие и согласованные', async () => {
    const store = createFakeStore({
      vacations: [
        createVacation(),
        createVacation({
          employeeName: 'Мария',
          status: 'approved',
          approverName: 'Анна',
          reference: 'VAC-TEST02',
        }),
      ],
    })
    const outcome = await getTool(store, 'listVacations').run(
      {},
      createManagerIdentity(),
    )
    expect(outcome.text).toContain('Пётр')
    expect(outcome.text).toContain('ожидает согласования')
    expect(outcome.text).toContain('Мария')
    expect(outcome.text).toContain('согласован')
  })
})
