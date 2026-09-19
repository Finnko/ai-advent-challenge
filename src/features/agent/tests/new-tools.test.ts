import { describe, expect, it } from 'vitest'
import type { AgentTool } from '../domain/agent'
import { createAgentTools } from '../domain/agent-tools'
import {
  TEST_NOW,
  createBooking,
  createFakeStore,
  createIdentity,
  createManagerIdentity,
  createVacation,
} from './agent-testkit'

function tool(name: string, store = createFakeStore()): { tool: AgentTool; store: ReturnType<typeof createFakeStore> } {
  const found = createAgentTools(store, TEST_NOW).find((item) => item.name === name)
  if (!found) {
    throw new Error(`missing tool ${name}`)
  }
  return { tool: found, store }
}

describe('Day 14 tools', () => {
  it('N1 cancels only the employee own pending vacation', async () => {
    const { tool: cancel, store } = tool('cancelVacation', createFakeStore({ vacations: [createVacation()] }))
    const outcome = await cancel.run({}, createIdentity())
    expect(outcome.ok).toBe(true)
    expect(store.vacations[0].status).toBe('cancelled')
  })

  it('N2 rejects a subordinate vacation with a reason', async () => {
    const { tool: reject, store } = tool('rejectVacation', createFakeStore({ vacations: [createVacation()] }))
    const outcome = await reject.run({ employeeName: 'Пётр', reason: 'Командировка' }, createManagerIdentity())
    expect(outcome.ok).toBe(true)
    expect(store.vacations[0].status).toBe('rejected')
  })

  it('N3 reschedules a managed booking and preserves its reference', async () => {
    const { tool: reschedule, store } = tool('rescheduleBooking', createFakeStore({ bookings: [createBooking()] }))
    const outcome = await reschedule.run({ room: 'Ладога', date: '2026-09-11', time: '16:00', newRoom: 'Байкал', newDate: '2026-09-12', newTime: '10:00' }, createIdentity())
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0]).toMatchObject({ room: 'Переговорка «Байкал»', date: '2026-09-12', time: '10:00', reference: 'BOOK-TEST01' })
  })

  it('N4 reads one room schedule', async () => {
    const { tool: schedule } = tool('getRoomSchedule', createFakeStore({ bookings: [createBooking()] }))
    const outcome = await schedule.run({ room: 'Ладога', date: '2026-09-11' }, createIdentity())
    expect(outcome.ok).toBe(true)
    expect(outcome.text).toContain('Переговорка «Ладога»')
  })

  it('N5 updates a managed booking', async () => {
    const { tool: update, store } = tool('updateBooking', createFakeStore({ bookings: [createBooking()] }))
    const outcome = await update.run({ room: 'Ладога', date: '2026-09-11', time: '16:00', title: 'Новая тема', duration: 90 }, createIdentity())
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0]).toMatchObject({ title: 'Новая тема', durationMin: 90 })
  })

  it('N6 removes the current user from invitees', async () => {
    const booking = createBooking({ participants: ['Пётр', 'Иван'] })
    const { tool: decline, store } = tool('declineInvite', createFakeStore({ bookings: [booking] }))
    const outcome = await decline.run({ room: 'Ладога', date: '2026-09-11', time: '16:00' }, createIdentity())
    expect(outcome.ok).toBe(true)
    expect(store.bookings[0].participants).toEqual(['Иван'])
  })
})
