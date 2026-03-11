import { tool } from "@opencode-ai/plugin"
import type { LoopState } from "./loop-state"

export function createLoopTools(loopState: LoopState): Record<string, ReturnType<typeof tool>> {
  const tide_loop_status = tool({
    description:
      "Check the current Tide orchestration loop state: iteration number, max iterations, and completion status.",
    args: {},
    execute: async (_args, context) => {
      const session = loopState.getSession(context.sessionID)
      if (!session) {
        return `Loop status: not_tracked (this session is not running inside a Tide loop)`
      }
      return `Loop status: ${session.status} | iteration: ${session.iteration} / ${loopState.maxIterations}`
    },
  })

  const tide_loop_complete = tool({
    description:
      "Signal that all tasks are complete and the Tide orchestration loop should stop. Call this when you have finished all work.",
    args: {},
    execute: async (_args, context) => {
      loopState.complete(context.sessionID)
      return `Loop marked as complete. No further iterations will be triggered for this session.`
    },
  })

  return { tide_loop_status, tide_loop_complete }
}
