import type {
  AgentCapabilities,
  AgentIdentity,
  AgentStore,
  BookingRecord,
  VacationRecord,
} from './agent'
import { normalizeName } from './agent-tools'

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part) || 0)
  return hours * 60 + minutes
}

function intervalsOverlap(
  time: string,
  durationMin: number,
  otherTime: string,
  otherDurationMin: number,
): boolean {
  const start = timeToMinutes(time)
  const end = start + durationMin
  const otherStart = timeToMinutes(otherTime)
  const otherEnd = otherStart + otherDurationMin
  return start < otherEnd && end > otherStart
}

export type FakeStore = AgentStore & {
  bookings: BookingRecord[]
  vacations: VacationRecord[]
}

export function createFakeStore(
  seed: { bookings?: BookingRecord[]; vacations?: VacationRecord[] } = {},
): FakeStore {
  const bookings = [...(seed.bookings ?? [])]
  const vacations = [...(seed.vacations ?? [])]
  return {
    bookings,
    vacations,
    async insertBooking(record) {
      bookings.push({ ...record, participants: [...record.participants] })
    },
    async listBookings(bookedBy, subordinateNames) {
      const owners = new Set(
        [bookedBy, ...subordinateNames].map((name) => normalizeName(name)),
      )
      const self = normalizeName(bookedBy)
      return bookings.filter(
        (booking) =>
          owners.has(normalizeName(booking.bookedBy)) ||
          booking.participants.some((name) => normalizeName(name) === self),
      )
    },
    async listBookingsOnDate(date) {
      return bookings.filter((booking) => booking.date === date)
    },
    async latestManagedBookingFor(bookedBy, subordinateNames) {
      const owners = new Set(
        [bookedBy, ...subordinateNames].map((name) => normalizeName(name)),
      )
      const own = bookings
        .filter((booking) => owners.has(normalizeName(booking.bookedBy)))
        .sort((a, b) =>
          `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`),
        )
      return own[0] ?? null
    },
    async findBooking(room, date, time) {
      return (
        bookings.find(
          (booking) =>
            booking.room === room &&
            booking.date === date &&
            booking.time === time,
        ) ?? null
      )
    },
    async updateBookingParticipants(room, date, time, participants) {
      const booking = bookings.find(
        (row) => row.room === room && row.date === date && row.time === time,
      )
      if (booking) {
        booking.participants = [...participants]
      }
    },
    async deleteBooking(room, date, time) {
      const index = bookings.findIndex(
        (booking) =>
          booking.room === room &&
          booking.date === date &&
          booking.time === time,
      )
      if (index >= 0) {
        bookings.splice(index, 1)
      }
    },
    async findOverlap(room, date, time, durationMin) {
      return bookings.filter(
        (booking) =>
          booking.room === room &&
          booking.date === date &&
          intervalsOverlap(
            time,
            durationMin,
            booking.time,
            booking.durationMin,
          ),
      )
    },
    async insertVacation(record) {
      vacations.push({ ...record })
    },
    async listVacations(approverName, subordinateNames) {
      const subordinates = new Set(subordinateNames.map(normalizeName))
      return vacations.filter(
        (vacation) =>
          (vacation.status === 'approved' &&
            normalizeName(vacation.approverName ?? '') ===
              normalizeName(approverName)) ||
          (vacation.status === 'pending' &&
            subordinates.has(normalizeName(vacation.employeeName))),
      )
    },
    async findPendingVacation(employeeName, start, end) {
      return (
        vacations.find(
          (vacation) =>
            normalizeName(vacation.employeeName) ===
              normalizeName(employeeName) &&
            vacation.start === start &&
            vacation.end === end &&
            vacation.status === 'pending',
        ) ?? null
      )
    },
    async latestPendingVacation(subordinateNames) {
      const subordinates = new Set(subordinateNames.map(normalizeName))
      const pending = vacations.filter(
        (vacation) =>
          vacation.status === 'pending' &&
          subordinates.has(normalizeName(vacation.employeeName)),
      )
      return pending.at(-1) ?? null
    },
    async markVacationApproved(reference, approverName) {
      const vacation = vacations.find(
        (row) => row.reference === reference && row.status === 'pending',
      )
      if (vacation) {
        vacation.status = 'approved'
        vacation.approverName = approverName
      }
    },
  }
}

export function createIdentity(
  overrides: Partial<AgentIdentity> = {},
): AgentIdentity {
  return {
    name: 'Пётр',
    role: 'employee',
    title: 'Линейный сотрудник',
    subordinates: [],
    colleagues: ['Анна', 'Пётр', 'Мария', 'Иван'],
    ...overrides,
  }
}

export function createManagerIdentity(
  overrides: Partial<AgentIdentity> = {},
): AgentIdentity {
  return createIdentity({
    name: 'Анна',
    role: 'manager',
    title: 'Руководитель команды',
    subordinates: ['Пётр', 'Мария', 'Иван'],
    ...overrides,
  })
}

export function createCapabilities(
  identity: AgentIdentity,
  allowedTools: string[],
): AgentCapabilities {
  return { identity, allowedTools }
}

export function createBooking(
  overrides: Partial<BookingRecord> = {},
): BookingRecord {
  return {
    room: 'Переговорка «Ладога»',
    date: '2026-09-11',
    time: '16:00',
    durationMin: 60,
    capacity: 5,
    title: 'Встреча',
    reference: 'BOOK-TEST01',
    bookedBy: 'Пётр',
    participants: [],
    ...overrides,
  }
}

export function createVacation(
  overrides: Partial<VacationRecord> = {},
): VacationRecord {
  return {
    employeeName: 'Пётр',
    approverName: null,
    start: '2026-09-01',
    end: '2026-09-12',
    reference: 'VAC-TEST01',
    status: 'pending',
    ...overrides,
  }
}
