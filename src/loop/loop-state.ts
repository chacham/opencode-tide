export type SessionLoopState = {
  iteration: number
  status: "active" | "completed"
}

const DEFAULT_MAX_ITERATIONS = 20

export class LoopState {
  readonly maxIterations: number
  private readonly sessions = new Map<string, SessionLoopState>()

  constructor(opts: { maxIterations?: number }) {
    this.maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS
  }

  getSession(sessionID: string): SessionLoopState | undefined {
    return this.sessions.get(sessionID)
  }

  activate(sessionID: string): void {
    this.sessions.set(sessionID, { iteration: 0, status: "active" })
  }

  increment(sessionID: string): void {
    const session = this.sessions.get(sessionID)
    if (!session || session.status !== "active") return
    session.iteration++
  }

  complete(sessionID: string): void {
    const session = this.sessions.get(sessionID)
    if (!session) return
    session.status = "completed"
  }

  shouldContinue(sessionID: string): boolean {
    const session = this.sessions.get(sessionID)
    if (!session) return false
    if (session.status !== "active") return false
    return session.iteration < this.maxIterations
  }

  remove(sessionID: string): void {
    this.sessions.delete(sessionID)
  }
}
