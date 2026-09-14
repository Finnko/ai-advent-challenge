import type {
  AgentIdentity,
  AgentRole,
  AgentStore,
  AgentTool,
  ToolArgs,
  ToolOutcome,
} from './agent'

function refCode(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export const ROOMS = [
  'Переговорка «Ладога»',
  'Переговорка «Байкал»',
  'Переговорка «Онега»',
  'Переговорка «Иртыш»',
  'Переговорка «Амур»',
  'Переговорка «Витим»',
  'Лаундж «Тайга»',
  'Комната «Метеор»',
]

export const ROOM_CAPACITY = 5

function roomKey(name: string): string {
  return normalizeName(name)
    .replace(/[«»]/g, '')
    .replace(/^(переговорка|лаундж|комната)\s+/i, '')
}

function roomStem(name: string): string {
  return roomKey(name).replace(/[аеёиоуыэюя]$/u, '')
}

function resolveRoom(arg: string): string | null {
  if (arg.trim().length === 0) {
    return null
  }
  const key = roomKey(arg)
  const exact = ROOMS.find((room) => roomKey(room) === key)
  if (exact) {
    return exact
  }
  const stem = roomStem(arg)
  if (stem.length < 4) {
    return null
  }
  return ROOMS.find((room) => roomStem(room) === stem) ?? null
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part) || 0)
  return hours * 60 + minutes
}

function formatMeetingTime(startMin: number, durationMin: number): string {
  const endMin = startMin + durationMin
  const fmt = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
  return `${fmt(startMin)}–${fmt(endMin)}`
}

function overlaps(
  time: string,
  durationMin: number,
  row: { time: string; durationMin: number },
): boolean {
  const start = timeToMinutes(time)
  const end = start + durationMin
  const rowStart = timeToMinutes(row.time)
  const rowEnd = rowStart + row.durationMin
  return start < rowEnd && end > rowStart
}

export function pickString(args: ToolArgs, key: string): string {
  return String(args[key] ?? '').trim()
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function validateRange(start: string, end: string): string | null {
  if (!start || !end) {
    return 'Укажи даты начала и конца периода.'
  }
  if (end < start) {
    return 'Дата конца раньше даты начала.'
  }
  return null
}

function isInvalidDate(value: string): boolean {
  return !/^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isInvalidTime(value: string): boolean {
  return !/^\d{2}:\d{2}$/.test(value)
}

type BookingPlan =
  | {
      ok: true
      room: string | null
      date: string
      time: string
      durationMin: number
      capacity: number
      title: string
      reference: string
    }
  | { ok: false; text: string; reference: null }

function planBooking(args: ToolArgs): BookingPlan {
  const date = pickString(args, 'date')
  const time = pickString(args, 'time')
  const capacity = ROOM_CAPACITY
  const durationMin = Math.max(
    15,
    Math.min(480, Math.round(Number(args.duration) || 60)),
  )
  const title = pickString(args, 'title')
  const requestedRoom = pickString(args, 'room')
  if (!date || !time) {
    return {
      ok: false,
      text: 'Не указаны дата и время встречи.',
      reference: null,
    }
  }
  if (isInvalidDate(date)) {
    return {
      ok: false,
      text: `Дата «${date}» не в формате YYYY-MM-DD.`,
      reference: null,
    }
  }
  if (isInvalidTime(time)) {
    return {
      ok: false,
      text: `Время «${time}» не в формате HH:MM.`,
      reference: null,
    }
  }
  let room: string | null = null
  if (requestedRoom.length > 0) {
    room = resolveRoom(requestedRoom)
    if (!room) {
      return {
        ok: false,
        text: `Нет такой переговорки: «${requestedRoom}». Доступны: ${ROOMS.join(', ')}.`,
        reference: null,
      }
    }
  }
  return {
    ok: true,
    room,
    date,
    time,
    durationMin,
    capacity,
    title: title || 'Встреча',
    reference: refCode('BOOK'),
  }
}

function toNameList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string')
  }
  if (typeof value === 'string') {
    return value.split(/[,;]| и /i)
  }
  return []
}

type ParticipantPlan =
  | { ok: true; names: string[] }
  | { ok: false; text: string }

function resolveParticipants(
  args: ToolArgs,
  identity: AgentIdentity,
): ParticipantPlan {
  const requested = toNameList(args.participants)
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
  if (requested.length === 0) {
    return {
      ok: false,
      text: 'Не указаны участники, которых нужно пригласить.',
    }
  }
  const names: string[] = []
  for (const candidate of requested) {
    const canonical = identity.colleagues.find(
      (name) => normalizeName(name) === normalizeName(candidate),
    )
    if (!canonical) {
      return {
        ok: false,
        text: `Неизвестный сотрудник: «${candidate}». Доступные: ${identity.colleagues.join(', ')}.`,
      }
    }
    if (normalizeName(canonical) === normalizeName(identity.name)) {
      continue
    }
    if (
      !names.some((name) => normalizeName(name) === normalizeName(canonical))
    ) {
      names.push(canonical)
    }
  }
  if (names.length === 0) {
    return {
      ok: false,
      text: 'Среди приглашённых нет других сотрудников, кроме вас.',
    }
  }
  return { ok: true, names }
}

type VacationPlan =
  | {
      ok: true
      employeeName: string
      start: string
      end: string
      reference: string
    }
  | { ok: false; text: string; reference: null }

type ApprovalPlan =
  | { ok: true; employeeName: string; start: string; end: string }
  | { ok: false; text: string; reference: null }

function planVacationRequest(
  args: ToolArgs,
  identity: AgentIdentity,
): VacationPlan {
  const start = pickString(args, 'start')
  const end = pickString(args, 'end')
  const invalid = validateRange(start, end)
  if (invalid) {
    return { ok: false, text: invalid, reference: null }
  }
  if (isInvalidDate(start) || isInvalidDate(end)) {
    return {
      ok: false,
      text: 'Даты должны быть в формате YYYY-MM-DD.',
      reference: null,
    }
  }
  return {
    ok: true,
    employeeName: identity.name,
    start,
    end,
    reference: refCode('VAC'),
  }
}

function planVacationApproval(
  args: ToolArgs,
  identity: AgentIdentity,
): ApprovalPlan {
  const employeeName = pickString(args, 'employeeName')
  const start = pickString(args, 'start')
  const end = pickString(args, 'end')
  if (!employeeName) {
    return {
      ok: false,
      text: 'Не указан сотрудник, чей отпуск согласуется.',
      reference: null,
    }
  }
  if (normalizeName(employeeName) === normalizeName(identity.name)) {
    return {
      ok: false,
      text: `Руководитель ${identity.name} не может согласовать отпуск самому себе.`,
      reference: null,
    }
  }
  const isSubordinate = identity.subordinates.some(
    (name) => normalizeName(name) === normalizeName(employeeName),
  )
  if (!isSubordinate) {
    return {
      ok: false,
      text: `${employeeName} не входит в команду руководителя ${identity.name} — согласовать отпуск нельзя.`,
      reference: null,
    }
  }
  const invalid = validateRange(start, end)
  if (invalid) {
    return { ok: false, text: invalid, reference: null }
  }
  if (isInvalidDate(start) || isInvalidDate(end)) {
    return {
      ok: false,
      text: 'Даты должны быть в формате YYYY-MM-DD.',
      reference: null,
    }
  }
  return { ok: true, employeeName, start, end }
}

function bookingOutcome(plan: BookingPlan, room: string): ToolOutcome {
  if (!plan.ok) {
    return { ok: false, text: plan.text, reference: null }
  }
  return {
    ok: true,
    text: `${room} забронирована на ${plan.date} ${plan.time} на ${plan.durationMin} мин (${plan.capacity} чел.) — ${plan.title}`,
    reference: plan.reference,
  }
}

function bookingTitle(row: { time: string; durationMin: number }): string {
  return formatMeetingTime(timeToMinutes(row.time), row.durationMin)
}

function vacationOutcome(plan: VacationPlan): ToolOutcome {
  if (!plan.ok) {
    return { ok: false, text: plan.text, reference: null }
  }
  return {
    ok: true,
    text: `Заявка на отпуск с ${plan.start} по ${plan.end} создана, статус: ожидает согласования руководителя.`,
    reference: plan.reference,
  }
}

type AgentToolName =
  | 'bookMeetingRoom'
  | 'listBookings'
  | 'listAvailableRooms'
  | 'inviteToMeeting'
  | 'cancelBooking'
  | 'requestVacation'
  | 'approveVacation'
  | 'listVacations'

export type ToolDefinition = {
  name: AgentToolName
  description: string
  argsExample: string
  roles: AgentRole[]
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'bookMeetingRoom',
    description:
      'забронировать переговорку под встречу (с проверкой пересечений)',
    argsExample:
      '{ "room": "название комнаты", "date": "YYYY-MM-DD", "time": "HH:MM", "duration": минуты, "title": "тема" }',
    roles: ['employee', 'manager'],
  },
  {
    name: 'listBookings',
    description:
      'показать встречи: свои, встречи, куда вас пригласили, а для руководителя — ещё и команды',
    argsExample: '{}',
    roles: ['employee', 'manager'],
  },
  {
    name: 'listAvailableRooms',
    description:
      'показать, какие переговорки свободны на дату и время (и какие заняты)',
    argsExample:
      '{ "date": "YYYY-MM-DD", "time": "HH:MM", "duration": минуты }',
    roles: ['employee', 'manager'],
  },
  {
    name: 'inviteToMeeting',
    description:
      'пригласить сотрудников на существующую встречу (комната, дата, время)',
    argsExample:
      '{ "room": "название комнаты", "date": "YYYY-MM-DD", "time": "HH:MM", "participants": ["имя", "имя"] }',
    roles: ['employee', 'manager'],
  },
  {
    name: 'cancelBooking',
    description:
      'отменить встречу (свою; руководитель — ещё и встречу подчинённого)',
    argsExample:
      '{ "room": "название комнаты", "date": "YYYY-MM-DD", "time": "HH:MM" }',
    roles: ['employee', 'manager'],
  },
  {
    name: 'requestVacation',
    description: 'подать заявку на отпуск',
    argsExample: '{ "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }',
    roles: ['employee', 'manager'],
  },
  {
    name: 'approveVacation',
    description:
      'согласовать существующую заявку на отпуск сотрудника из своей команды',
    argsExample:
      '{ "employeeName": "имя сотрудника", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }',
    roles: ['manager'],
  },
  {
    name: 'listVacations',
    description: 'показать отпуска команды: согласованные и ожидающие',
    argsExample: '{}',
    roles: ['manager'],
  },
]

export const TOOLS_BY_ROLE: Record<AgentRole, string[]> = {
  employee: TOOL_DEFINITIONS.filter((tool) =>
    tool.roles.includes('employee'),
  ).map((tool) => tool.name),
  manager: TOOL_DEFINITIONS.filter((tool) =>
    tool.roles.includes('manager'),
  ).map((tool) => tool.name),
}

const TOOL_RUNNERS: Record<
  AgentToolName,
  (store: AgentStore) => AgentTool['run']
> = {
  bookMeetingRoom: (store) => async (args, identity) => {
    const plan = planBooking(args)
    if (!plan.ok) {
      return bookingOutcome(plan, '')
    }
    let room = plan.room
    if (!room) {
      const dayBookings = await store.listBookingsOnDate(plan.date)
      room =
        ROOMS.find(
          (candidate) =>
            !dayBookings.some(
              (booking) =>
                booking.room === candidate &&
                overlaps(plan.time, plan.durationMin, booking),
            ),
        ) ?? null
      if (!room) {
        return {
          ok: false,
          text: `Все переговорки заняты на ${plan.date} ${plan.time} (${plan.durationMin} мин). Выбери другое время или сократи встречу.`,
          reference: null,
        }
      }
    }
    const conflicts = await store.findOverlap(
      room,
      plan.date,
      plan.time,
      plan.durationMin,
    )
    if (conflicts.length > 0) {
      const busy = conflicts[0]
      return {
        ok: false,
        text: `${room} занята на ${plan.date} с ${bookingTitle(busy)} (${busy.title}, бронь: ${busy.bookedBy}). Выбери другое время, комнату или сократи встречу.`,
        reference: null,
      }
    }
    await store.insertBooking({
      room,
      date: plan.date,
      time: plan.time,
      durationMin: plan.durationMin,
      capacity: plan.capacity,
      title: plan.title,
      reference: plan.reference,
      bookedBy: identity.name,
      participants: [],
    })
    return bookingOutcome(plan, room)
  },
  listBookings: (store) => async (_args, identity) => {
    const rows = await store.listBookings(identity.name, identity.subordinates)
    if (rows.length === 0) {
      return { ok: true, text: 'Записанных встреч нет.', reference: null }
    }
    const lines = rows.map((row) => {
      const owner =
        normalizeName(row.bookedBy) === normalizeName(identity.name)
          ? 'моя'
          : row.bookedBy
      const guests =
        row.participants.length > 0
          ? ` · участники: ${row.participants.join(', ')}`
          : ''
      return `- ${row.date} ${bookingTitle(row)} · ${row.room} — ${row.title} (${owner})${guests}`
    })
    return {
      ok: true,
      text: `Встречи:\n${lines.join('\n')}`,
      reference: null,
    }
  },
  listAvailableRooms: (store) => async (args) => {
    const date = pickString(args, 'date')
    const time = pickString(args, 'time')
    const durationMin = Math.max(
      15,
      Math.min(480, Math.round(Number(args.duration) || 60)),
    )
    if (!date || !time) {
      return {
        ok: false,
        text: 'Укажи дату и время, чтобы проверить доступность переговорок.',
        reference: null,
      }
    }
    if (isInvalidDate(date)) {
      return {
        ok: false,
        text: `Дата «${date}» не в формате YYYY-MM-DD.`,
        reference: null,
      }
    }
    if (isInvalidTime(time)) {
      return {
        ok: false,
        text: `Время «${time}» не в формате HH:MM.`,
        reference: null,
      }
    }
    const dayBookings = await store.listBookingsOnDate(date)
    const free: string[] = []
    const busy: string[] = []
    for (const room of ROOMS) {
      const conflict = dayBookings.find(
        (booking) =>
          booking.room === room &&
          overlaps(time, durationMin, booking),
      )
      if (conflict) {
        busy.push(
          `${room} — занята ${bookingTitle(conflict)} (${conflict.title})`,
        )
      } else {
        free.push(room)
      }
    }
    if (free.length === 0) {
      return {
        ok: true,
        text: `Свободных переговорок на ${date} ${time} (${durationMin} мин) нет.\nЗанято:\n${busy
          .map((line) => `- ${line}`)
          .join('\n')}`,
        reference: null,
      }
    }
    const lines = [
      `Свободны на ${date} ${time} (${durationMin} мин):`,
      ...free.map((room) => `- ${room}`),
    ]
    if (busy.length > 0) {
      lines.push('', 'Занято:', ...busy.map((line) => `- ${line}`))
    }
    return { ok: true, text: lines.join('\n'), reference: null }
  },
  inviteToMeeting: (store) => async (args, identity) => {
    const requestedRoom = pickString(args, 'room')
    let room: string | null = null
    if (requestedRoom.length > 0) {
      room = resolveRoom(requestedRoom)
      if (!room) {
        return {
          ok: false,
          text: `Нет такой переговорки: «${requestedRoom}». Доступны: ${ROOMS.join(', ')}.`,
          reference: null,
        }
      }
    }
    let date = pickString(args, 'date')
    let time = pickString(args, 'time')
    if (!room || !date || !time) {
      const latest = await store.latestManagedBookingFor(
        identity.name,
        identity.subordinates,
      )
      if (latest) {
        room = room ?? latest.room
        date = date || latest.date
        time = time || latest.time
      }
    }
    if (!room) {
      return {
        ok: false,
        text: 'Укажи комнату из доступных, чтобы пригласить участников.',
        reference: null,
      }
    }
    if (!date || !time) {
      return {
        ok: false,
        text: 'Укажи дату и время встречи, чтобы пригласить участников.',
        reference: null,
      }
    }
    if (isInvalidDate(date)) {
      return {
        ok: false,
        text: `Дата «${date}» не в формате YYYY-MM-DD.`,
        reference: null,
      }
    }
    if (isInvalidTime(time)) {
      return {
        ok: false,
        text: `Время «${time}» не в формате HH:MM.`,
        reference: null,
      }
    }
    const participants = resolveParticipants(args, identity)
    if (!participants.ok) {
      return { ok: false, text: participants.text, reference: null }
    }
    const booking = await store.findBooking(room, date, time)
    if (!booking) {
      return {
        ok: false,
        text: `Встреча не найдена: ${room}, ${date} ${time}. Сначала забронируй переговорку.`,
        reference: null,
      }
    }
    const isOwn =
      normalizeName(booking.bookedBy) === normalizeName(identity.name)
    const canManage = identity.subordinates.some(
      (name) => normalizeName(name) === normalizeName(booking.bookedBy),
    )
    if (!isOwn && !canManage) {
      return {
        ok: false,
        text: `Эту встречу организовал(а) ${booking.bookedBy} — приглашать можно только в свою или во встречу подчинённого.`,
        reference: null,
      }
    }
    const merged = [...booking.participants]
    const added: string[] = []
    for (const name of participants.names) {
      if (
        !merged.some((existing) => normalizeName(existing) === normalizeName(name))
      ) {
        merged.push(name)
        added.push(name)
      }
    }
    if (added.length === 0) {
      return {
        ok: true,
        text: `Все указанные участники уже приглашены на ${room}, ${date} ${time}. Участники: ${merged.join(', ')}.`,
        reference: booking.reference,
      }
    }
    if (merged.length + 1 > ROOM_CAPACITY) {
      return {
        ok: false,
        text: `Участников (${merged.length + 1} вместе с организатором) больше вместимости комнаты (${ROOM_CAPACITY} чел.). Сократи список.`,
        reference: null,
      }
    }
    await store.updateBookingParticipants(room, date, time, merged)
    return {
      ok: true,
      text: `Встреча ${room}, ${date} ${time} — приглашены: ${added.join(', ')}. Всего участников: ${merged.length + 1} вместе с организатором.`,
      reference: booking.reference,
    }
  },
  cancelBooking: (store) => async (args, identity) => {
    const requestedRoom = pickString(args, 'room')
    let room: string | null = null
    if (requestedRoom.length > 0) {
      room = resolveRoom(requestedRoom)
      if (!room) {
        return {
          ok: false,
          text: `Нет такой переговорки: «${requestedRoom}». Доступны: ${ROOMS.join(', ')}.`,
          reference: null,
        }
      }
    }
    let date = pickString(args, 'date')
    let time = pickString(args, 'time')
    if (!room || !date || !time) {
      const latest = await store.latestManagedBookingFor(
        identity.name,
        identity.subordinates,
      )
      if (latest) {
        room = room ?? latest.room
        date = date || latest.date
        time = time || latest.time
      }
    }
    if (!room) {
      return {
        ok: false,
        text: 'Укажи комнату из доступных.',
        reference: null,
      }
    }
    if (!date || !time) {
      return {
        ok: false,
        text: 'Укажи дату и время встречи.',
        reference: null,
      }
    }
    if (isInvalidDate(date)) {
      return {
        ok: false,
        text: `Дата «${date}» не в формате YYYY-MM-DD.`,
        reference: null,
      }
    }
    if (isInvalidTime(time)) {
      return {
        ok: false,
        text: `Время «${time}» не в формате HH:MM.`,
        reference: null,
      }
    }
    const existing = await store.findBooking(room, date, time)
    if (!existing) {
      return {
        ok: false,
        text: `Встреча не найдена: ${room}, ${date} ${time}. Проверь список через listBookings.`,
        reference: null,
      }
    }
    const isOwn =
      normalizeName(existing.bookedBy) === normalizeName(identity.name)
    const canManage = identity.subordinates.some(
      (name) => normalizeName(name) === normalizeName(existing.bookedBy),
    )
    if (!isOwn && !canManage) {
      return {
        ok: false,
        text: `Эту встречу бронировал(а) ${existing.bookedBy} — отменить можно только свою или встречу подчинённого.`,
        reference: null,
      }
    }
    await store.deleteBooking(room, date, time)
    return {
      ok: true,
      text: `Встреча отменена: ${existing.room}, ${existing.date} ${bookingTitle(existing)} — ${existing.title}.`,
      reference: existing.reference,
    }
  },
  requestVacation: (store) => async (args, identity) => {
    const plan = planVacationRequest(args, identity)
    if (plan.ok) {
      await store.insertVacation({
        employeeName: plan.employeeName,
        approverName: null,
        start: plan.start,
        end: plan.end,
        status: 'pending',
        reference: plan.reference,
      })
    }
    return vacationOutcome(plan)
  },
  approveVacation: (store) => async (args, identity) => {
    let employeeName = pickString(args, 'employeeName')
    let start = pickString(args, 'start')
    let end = pickString(args, 'end')
    if (!employeeName || !start || !end) {
      const latest = await store.latestPendingVacation(identity.subordinates)
      if (latest) {
        employeeName = employeeName || latest.employeeName
        start = start || latest.start
        end = end || latest.end
      }
    }
    const plan = planVacationApproval(
      { ...args, employeeName, start, end },
      identity,
    )
    if (!plan.ok) {
      return { ok: false, text: plan.text, reference: null }
    }
    const pending = await store.findPendingVacation(
      plan.employeeName,
      plan.start,
      plan.end,
    )
    if (!pending) {
      return {
        ok: false,
        text: `Заявка на отпуск ${plan.employeeName} с ${plan.start} по ${plan.end} не найдена: сначала сотрудник должен подать заявку (requestVacation).`,
        reference: null,
      }
    }
    await store.markVacationApproved(pending.reference, identity.name)
    return {
      ok: true,
      text: `Отпуск сотрудника ${plan.employeeName} с ${plan.start} по ${plan.end} согласован.`,
      reference: pending.reference,
    }
  },
  listVacations: (store) => async (_args, identity) => {
    const records = await store.listVacations(
      identity.name,
      identity.subordinates,
    )
    if (records.length === 0) {
      return {
        ok: true,
        text: 'Согласованных отпусков и ожидающих заявок нет.',
        reference: null,
      }
    }
    const lines = records.map((record) => {
      const state =
        record.status === 'approved' ? 'согласован' : 'ожидает согласования'
      return `- ${record.employeeName}: с ${record.start} по ${record.end} — ${state}`
    })
    return { ok: true, text: lines.join('\n'), reference: null }
  },
}

export function createAgentTools(store: AgentStore): AgentTool[] {
  return TOOL_DEFINITIONS.map((definition) => ({
    ...definition,
    run: TOOL_RUNNERS[definition.name](store),
  }))
}
