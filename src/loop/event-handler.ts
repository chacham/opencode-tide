import type { Event, OpencodeClient } from "@opencode-ai/sdk"
import type { LoopState } from "./loop-state"

type HandleSessionEventInput = {
  event: Event
  loopState: LoopState
  client: OpencodeClient
}

export async function handleSessionEvent(input: HandleSessionEventInput): Promise<void> {
  const { event, loopState, client } = input

  if (event.type !== "session.idle") return

  const sessionID = event.properties.sessionID
  if (!loopState.shouldContinue(sessionID)) return

  const session = loopState.getSession(sessionID)!
  const nextIteration = session.iteration + 1

  try {
    await client.session.promptAsync({
      path: { id: sessionID },
      body: {
        parts: [
          {
            type: "text" as const,
            text: `[Tide Loop] Continue working. Iteration ${nextIteration}/${loopState.maxIterations}. Check your todo list and continue with the next pending task. If all tasks are complete, call tide_loop_complete.`,
          },
        ],
      },
    })
    loopState.increment(sessionID)
  } catch {
    // Empty catch: session may be aborted; skip increment so next idle retries
  }
}
