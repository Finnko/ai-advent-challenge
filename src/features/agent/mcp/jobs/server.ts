import { serve } from '../shared/serve.ts'
import { getJobsDb } from './db.ts'
import { registerJobsTools } from './register.ts'
import { createOpenMeteoSource } from './weather.ts'
import { createJobsToolkit } from './tools.ts'

await serve('agent-mcp-jobs', async (server) => {
  const store = await getJobsDb()
  const toolkit = createJobsToolkit({
    store,
    weather: createOpenMeteoSource(),
  })
  registerJobsTools(server, toolkit)
})
