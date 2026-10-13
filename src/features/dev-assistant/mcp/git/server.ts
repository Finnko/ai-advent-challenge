import { serve } from '@lib/mcp/serve.ts'
import { createGitRunner, createGitSource } from './git.ts'
import { registerGitTools } from './register.ts'
import { createGitToolkit } from './tools.ts'

const cwd = process.env.GIT_REPO_DIR?.trim() || process.cwd()

await serve('dev-assistant-mcp-git', (server) => {
  const toolkit = createGitToolkit({
    git: createGitSource({ run: createGitRunner(cwd) }),
  })
  registerGitTools(server, toolkit)
})
