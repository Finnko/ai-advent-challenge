import type {
  AgentStore,
  BookingRecord,
  VacationRecord,
} from '../../domain/agent'
import { normalizeName } from '../../domain/agent-tools'
import { getDb, nowIso } from './db.server'

type VacationRow = {
  employee_name: string
  approver_name: string | null
  start_date: string
  end_date: string
  reference: string
  status: string
  created_at: string
}

type BookingRow = {
  room: string
  date: string
  time: string
  duration_min: number
  capacity: number
  title: string
  reference: string
  booked_by: string
  participants: string
  created_at: string
}

const VACATION_STATUS_BY_ROW: Record<string, VacationRecord['status']> = {
  approved: 'approved',
  cancelled: 'cancelled',
  rejected: 'rejected',
}

function vacationFromRow(row: VacationRow): VacationRecord {
  const status = VACATION_STATUS_BY_ROW[row.status] ?? 'pending'
  return {
    employeeName: row.employee_name,
    approverName: row.approver_name,
    start: row.start_date,
    end: row.end_date,
    reference: row.reference,
    status,
    createdAt: row.created_at,
  }
}

function parseParticipants(value: string | null): string[] {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((name): name is string => typeof name === 'string')
    }
  } catch {
    return []
  }
  return []
}

function bookingFromRow(row: BookingRow): BookingRecord {
  return {
    room: row.room,
    date: row.date,
    time: row.time,
    durationMin: Number(row.duration_min),
    capacity: Number(row.capacity),
    title: row.title,
    reference: row.reference,
    bookedBy: row.booked_by,
    participants: parseParticipants(row.participants),
    createdAt: row.created_at,
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((part) => Number(part) || 0)
  return hours * 60 + minutes
}

export function createAgentStore(): AgentStore {
  return {
    async insertVacation(record: VacationRecord) {
      const db = await getDb()
      db.prepare(
        'INSERT INTO vacations (employee_name, approver_name, start_date, end_date, reference, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(
        record.employeeName,
        record.approverName,
        record.start,
        record.end,
        record.reference,
        record.status,
        nowIso(),
      )
    },
    async listVacations(approverName: string, subordinateNames: string[]) {
      const db = await getDb()
      const placeholders = subordinateNames.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
          FROM vacations
          WHERE (status = 'approved' AND approver_name = ?)
             OR (status = 'pending' AND employee_name IN (${placeholders}))
          ORDER BY id DESC`,
        )
        .all(approverName, ...subordinateNames) as VacationRow[]
      return rows.map(vacationFromRow)
    },
    async findPendingVacation(
      employeeName: string,
      start: string,
      end: string,
    ) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
          FROM vacations
          WHERE employee_name = ? AND start_date = ? AND end_date = ? AND status = 'pending'
          ORDER BY id DESC
          LIMIT 1`,
        )
        .all(employeeName, start, end) as VacationRow[]
      return rows.length > 0 ? vacationFromRow(rows[0]) : null
    },
    async latestPendingVacation(subordinateNames: string[]) {
      if (subordinateNames.length === 0) {
        return null
      }
      const db = await getDb()
      const placeholders = subordinateNames.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
          FROM vacations
          WHERE status = 'pending' AND employee_name IN (${placeholders})
          ORDER BY id DESC
          LIMIT 1`,
        )
        .all(...subordinateNames) as VacationRow[]
      return rows.length > 0 ? vacationFromRow(rows[0]) : null
    },
    async markVacationApproved(reference: string, approverName: string) {
      const db = await getDb()
      db.prepare(
        "UPDATE vacations SET status = 'approved', approver_name = ? WHERE reference = ? AND status = 'pending'",
      ).run(approverName, reference)
    },
    async findOwnVacation(employeeName: string, reference?: string) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT employee_name, approver_name, start_date, end_date, reference, status, created_at
           FROM vacations
           WHERE employee_name = ? AND status = 'pending' AND (? IS NULL OR reference = ?)
           ORDER BY id DESC LIMIT 1`,
        )
        .all(employeeName, reference ?? null, reference ?? null) as VacationRow[]
      return rows.length > 0 ? vacationFromRow(rows[0]) : null
    },
    async setVacationStatus(reference: string, status: 'cancelled' | 'rejected', approverName?: string) {
      const db = await getDb()
      db.prepare(
        'UPDATE vacations SET status = ?, approver_name = COALESCE(?, approver_name) WHERE reference = ? AND status = \'pending\'',
      ).run(status, approverName ?? null, reference)
    },
    async insertBooking(record: BookingRecord) {
      const db = await getDb()
      db.prepare(
        `INSERT INTO bookings (room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        record.room,
        record.date,
        record.time,
        record.durationMin,
        record.capacity,
        record.title,
        record.reference,
        record.bookedBy,
        JSON.stringify(record.participants ?? []),
        nowIso(),
      )
    },
    async listBookings(bookedBy: string, subordinateNames: string[]) {
      const db = await getDb()
      const owners = new Set(
        [bookedBy, ...subordinateNames].map((name) => normalizeName(name)),
      )
      const self = normalizeName(bookedBy)
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          ORDER BY date, time, id`,
        )
        .all() as BookingRow[]
      return rows
        .map(bookingFromRow)
        .filter(
          (booking) =>
            owners.has(normalizeName(booking.bookedBy)) ||
            booking.participants.some((name) => normalizeName(name) === self),
        )
    },
    async listBookingsOnDate(date: string) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE date = ?
          ORDER BY time, id`,
        )
        .all(date) as BookingRow[]
      return rows.map(bookingFromRow)
    },
    async latestManagedBookingFor(
      bookedBy: string,
      subordinateNames: string[],
    ) {
      const db = await getDb()
      const names = [bookedBy, ...subordinateNames]
      const placeholders = names.map(() => '?').join(', ')
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE booked_by IN (${placeholders})
          ORDER BY date DESC, time DESC, id DESC
          LIMIT 1`,
        )
        .all(...names) as BookingRow[]
      return rows.length > 0 ? bookingFromRow(rows[0]) : null
    },
    async findBooking(room: string, date: string, time: string) {
      const db = await getDb()
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE room = ? AND date = ? AND time = ?
          LIMIT 1`,
        )
        .all(room, date, time) as BookingRow[]
      return rows.length > 0 ? bookingFromRow(rows[0]) : null
    },
    async updateBookingParticipants(
      room: string,
      date: string,
      time: string,
      participants: string[],
    ) {
      const db = await getDb()
      db.prepare(
        'UPDATE bookings SET participants = ? WHERE room = ? AND date = ? AND time = ?',
      ).run(JSON.stringify(participants), room, date, time)
    },
    async deleteBooking(room: string, date: string, time: string) {
      const db = await getDb()
      db.prepare(
        'DELETE FROM bookings WHERE room = ? AND date = ? AND time = ?',
      ).run(room, date, time)
    },
    async updateBooking(room: string, date: string, time: string, patch: { title?: string; durationMin?: number }) {
      const db = await getDb()
      const assignments: string[] = []
      const values: (string | number)[] = []
      if (patch.title !== undefined) {
        assignments.push('title = ?')
        values.push(patch.title)
      }
      if (patch.durationMin !== undefined) {
        assignments.push('duration_min = ?')
        values.push(patch.durationMin)
      }
      if (assignments.length === 0) {
        return
      }
      db.prepare(`UPDATE bookings SET ${assignments.join(', ')} WHERE room = ? AND date = ? AND time = ?`).run(...values, room, date, time)
    },
    async findOwnBooking(bookedBy: string, room?: string, date?: string, time?: string) {
      const db = await getDb()
      const rows = db.prepare(
        `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
         FROM bookings WHERE booked_by = ? AND (? IS NULL OR room = ?) AND (? IS NULL OR date = ?) AND (? IS NULL OR time = ?)
         ORDER BY date DESC, time DESC, id DESC LIMIT 1`,
      ).all(bookedBy, room ?? null, room ?? null, date ?? null, date ?? null, time ?? null, time ?? null) as BookingRow[]
      return rows.length > 0 ? bookingFromRow(rows[0]) : null
    },
    async findOverlap(
      room: string,
      date: string,
      time: string,
      durationMin: number,
    ) {
      const db = await getDb()
      const minutes = timeToMinutes(time)
      const rows = db
        .prepare(
          `SELECT room, date, time, duration_min, capacity, title, reference, booked_by, participants, created_at
          FROM bookings
          WHERE room = ? AND date = ?
            AND (CAST(substr(time, 1, 2) AS INTEGER) * 60 + CAST(substr(time, 4, 2) AS INTEGER)) < ?
            AND (CAST(substr(time, 1, 2) AS INTEGER) * 60 + CAST(substr(time, 4, 2) AS INTEGER) + duration_min) > ?
          ORDER BY time`,
        )
        .all(room, date, minutes + durationMin, minutes) as BookingRow[]
      return rows.map(bookingFromRow)
    },
  }
}
