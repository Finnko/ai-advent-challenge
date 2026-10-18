import { spawn } from 'node:child_process'
import { ReviewCancelledError } from './cancel.server'

export type RunResult = {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  aborted: boolean
}

export type CommandOptions = {
  cwd: string
  timeoutMs?: number
  env?: Record<string, string>
  maxOutput?: number
  onLine?: (line: string) => void
  signal?: AbortSignal
}

const DEFAULT_MAX_OUTPUT = 200_000
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

export function stripAnsi(value: string): string {
  return value.replace(ANSI, '')
}

function capped(store: { value: string }, text: string, max: number): void {
  if (store.value.length >= max) {
    return
  }
  store.value += text
  if (store.value.length > max) {
    store.value = store.value.slice(0, max)
  }
}

export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const maxOutput = options.maxOutput ?? DEFAULT_MAX_OUTPUT
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const stdout = { value: '' }
    const stderr = { value: '' }
    let timedOut = false
    let aborted = false
    let pending = ''

    const onAbort = () => {
      aborted = true
      killTree(child.pid)
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const handleLine = (chunk: string, target: { value: string }) => {
      capped(target, chunk, maxOutput)
      if (!options.onLine) {
        return
      }
      pending += chunk
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        options.onLine(stripAnsi(line))
      }
    }

    child.stdout?.on('data', (data: Buffer) => handleLine(String(data), stdout))
    child.stderr?.on('data', (data: Buffer) => handleLine(String(data), stderr))

    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true
          killTree(child.pid)
        }, options.timeoutMs)
      : null

    const finish = (code: number | null, extra: string) => {
      if (timer) {
        clearTimeout(timer)
      }
      options.signal?.removeEventListener('abort', onAbort)
      resolve({
        code,
        stdout: stripAnsi(stdout.value),
        stderr: `${stripAnsi(stderr.value)}${extra}`,
        timedOut: timedOut || aborted,
        aborted,
      })
    }

    child.on('close', (code) => {
      if (options.onLine && pending.trim().length > 0) {
        options.onLine(stripAnsi(pending))
      }
      finish(code, '')
    })

    child.on('error', (error) => {
      finish(null, `\n${String(error)}`)
    })
  })
}

export function killTree(pid: number | undefined): void {
  if (!pid) {
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      return
    }
  }
}

const LOCAL_URL = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+\/?/

export type ServerHandle = {
  url: string
  stop: () => void
}

export function startServer(
  command: string,
  args: string[],
  options: CommandOptions & { urlTimeoutMs: number },
): Promise<ServerHandle> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let resolved = false
    let pending = ''
    const log = { value: '' }

    const onAbort = () => {
      if (resolved) {
        return
      }
      resolved = true
      clearTimeout(timer)
      killTree(child.pid)
      reject(new ReviewCancelledError())
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    const settle = (): void => {
      options.signal?.removeEventListener('abort', onAbort)
    }

    const scan = (chunk: string) => {
      capped(log, chunk, options.maxOutput ?? DEFAULT_MAX_OUTPUT)
      if (resolved) {
        return
      }
      pending += stripAnsi(chunk)
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) {
        options.onLine?.(line)
        const match = line.match(LOCAL_URL)
        if (match) {
          resolved = true
          clearTimeout(timer)
          settle()
          resolve({
            url: match[0].replace(/\/$/, ''),
            stop: () => killTree(child.pid),
          })
          return
        }
      }
    }

    child.stdout?.on('data', (data: Buffer) => scan(String(data)))
    child.stderr?.on('data', (data: Buffer) => scan(String(data)))

    const timer = setTimeout(() => {
      if (resolved) {
        return
      }
      resolved = true
      killTree(child.pid)
      settle()
      reject(new Error('Дев-сервер не сообщил адрес за отведённое время'))
    }, options.urlTimeoutMs)

    child.on('close', () => {
      if (resolved) {
        return
      }
      resolved = true
      clearTimeout(timer)
      settle()
      reject(new Error('Дев-сервер завершился до старта'))
    })

    child.on('error', (error) => {
      if (resolved) {
        return
      }
      resolved = true
      clearTimeout(timer)
      settle()
      reject(error)
    })
  })
}
