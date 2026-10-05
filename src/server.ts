import './lib/agent-rag.server'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import type { RequestHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'

type ServerEntry = { fetch: RequestHandler<Register> }

function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args)
    },
  }
}

const fetch = createStartHandler(defaultStreamHandler)

export default createServerEntry({ fetch })
