import { tool } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { LoopState } from "./loop-state"
import { runDelegate } from "./delegate"

type CreateLoopToolsInput = {
  loopState: LoopState
  client: OpencodeClient
}

export function createLoopTools({
  loopState,
  client,
}: CreateLoopToolsInput): Record<string, ReturnType<typeof tool>> {
  const tide_loop_start = tool({
    description:
      "Start the Tide orchestration loop for this session. Call this to begin an iterative multi-step workflow. The loop will continue until you call tide_loop_complete or the max iteration limit is reached.",
    args: {},
    execute: async (_args, context) => {
      loopState.activate(context.sessionID)
      return `Loop started. Max iterations: ${loopState.maxIterations}. Call tide_loop_complete when all tasks are done.`
    },
  })

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

  const tide_delegate = tool({
    description:
      "Delegate a task to another agent. The specified agent will run in a child session and execute the given prompt. Blocks until the agent completes and returns its response.",
    args: {
      agent: tool.schema.string("Name of the agent to delegate to, as defined in tide.jsonc"),
      prompt: tool.schema.string("Full instructions for the agent to execute"),
    },
    execute: async (args, context) => {
      return runDelegate({
        client,
        sessionID: context.sessionID,
        agent: args.agent,
        prompt: args.prompt,
      })
    },
  })

  return { tide_loop_start, tide_loop_status, tide_loop_complete, tide_delegate }
}
