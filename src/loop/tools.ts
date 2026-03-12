import { tool } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { LoopState } from "./loop-state"

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
      "Delegate a task to another agent. The specified agent will run as a subtask inside this session and execute the given prompt. Use this to hand off specialized work to worker agents.",
    args: {
      agent: tool.schema.string("Name of the agent to delegate to, as defined in tide.jsonc"),
      description: tool.schema.string("Short description of the task being delegated"),
      prompt: tool.schema.string("Full instructions for the agent to execute"),
    },
    execute: async (args, context) => {
      try {
        await client.session.promptAsync({
          path: { id: context.sessionID },
          body: {
            parts: [
              {
                type: "subtask",
                agent: args.agent,
                description: args.description,
                prompt: args.prompt,
              },
            ],
          },
        })
        return `Delegated to agent "${args.agent}": ${args.description}`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return `Failed to delegate to agent "${args.agent}": ${message}`
      }
    },
  })

  return { tide_loop_start, tide_loop_status, tide_loop_complete, tide_delegate }
}
