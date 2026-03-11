import type { LoopState } from "./loop-state"

/**
 * Builds a loop-state system prompt string for the given session.
 * Returns empty string when the session is not active (not tracked or completed).
 */
export function buildLoopSystemPrompt(loopState: LoopState, sessionID: string): string {
  const session = loopState.getSession(sessionID)
  if (!session || session.status !== "active") return ""

  return [
    `[Tide Orchestration Loop]`,
    `Current iteration: ${session.iteration} / ${loopState.maxIterations}`,
    ``,
    `You are operating inside an automated orchestration loop.`,
    `Use the following tools to control the loop:`,
    `- tide_loop_status: Check current loop state (iteration, max, status)`,
    `- tide_loop_complete: Call this when all tasks are finished to stop the loop`,
    ``,
    `Continue working on pending tasks. When everything is done, call tide_loop_complete.`,
  ].join("\n")
}

type SystemTransformInput = {
  sessionID?: string
  model: string
}

type SystemTransformOutput = {
  system: string[]
}

/**
 * Creates the experimental.chat.system.transform hook that injects
 * loop state into the system prompt for active loop sessions.
 */
export function createSystemTransformHook(
  loopState: LoopState,
): (input: SystemTransformInput, output: SystemTransformOutput) => Promise<void> {
  return async (input, output) => {
    if (!input.sessionID) return

    const prompt = buildLoopSystemPrompt(loopState, input.sessionID)
    if (!prompt) return

    output.system.push(prompt)
  }
}
