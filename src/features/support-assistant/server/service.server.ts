import type { Catalog } from '../domain/types'
import { createOzonSource, resolveFixturesRoot } from '../mcp/ozon/source'
import {
  getSupportHealth,
  warmUpSupport,
  type SupportHealth,
} from './warmup.server'

export async function getSupportCatalog(): Promise<Catalog> {
  return createOzonSource(resolveFixturesRoot()).catalog()
}

export async function getSupportStatus(): Promise<SupportHealth> {
  const health = await getSupportHealth()
  if (!health.warming && !health.ready) {
    void warmUpSupport().catch(() => undefined)
  }
  return health
}

export { askSupport } from './ask.server'
