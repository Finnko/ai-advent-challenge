import { createServerFn } from '@tanstack/react-start'
import type { AgentRole } from '../agent'
import type { OrgPerson } from '../api'
import { listPeople } from '../store.server'

export const listOrg = createServerFn({ method: 'GET' }).handler(async () => {
  const rows = await listPeople()
  return rows.map((row): OrgPerson => ({
    token: row.token,
    name: row.name,
    role: row.role as AgentRole,
    title: row.title,
    managerToken: row.manager_token,
  }))
})
