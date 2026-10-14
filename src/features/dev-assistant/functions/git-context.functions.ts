import { createServerFn } from '@tanstack/react-start'
import { collectGitContext } from '../server/service.server'

export const getGitContext = createServerFn({ method: 'GET' }).handler(
  async () => collectGitContext(),
)
