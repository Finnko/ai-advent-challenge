import type { RoundState } from './types'

export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000

export class RoundStore {
  private readonly rounds = new Map<number, RoundState>()
  private readonly ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  get(chatId: number): RoundState | undefined {
    this.purge()
    return this.rounds.get(chatId)
  }

  set(state: RoundState): RoundState {
    this.rounds.set(state.chatId, state)
    return state
  }

  delete(chatId: number): void {
    this.rounds.delete(chatId)
  }

  private purge(): void {
    if (this.ttlMs <= 0) {
      return
    }
    const cutoff = Date.now() - this.ttlMs
    for (const [chatId, state] of this.rounds) {
      if (state.updatedAt < cutoff) {
        this.rounds.delete(chatId)
      }
    }
  }
}
