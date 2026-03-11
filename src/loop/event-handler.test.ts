import { beforeEach, describe, expect, mock, test } from "bun:test"
import { LoopState } from "./loop-state"
import { handleSessionEvent } from "./event-handler"
import type { Event } from "@opencode-ai/sdk"

function makeClient() {
  return {
    session: {
      promptAsync: mock(() => Promise.resolve({})),
    },
  }
}

describe("handleSessionEvent", () => {
  let loopState: LoopState
  let client: ReturnType<typeof makeClient>

  beforeEach(() => {
    loopState = new LoopState({ maxIterations: 5 })
    client = makeClient()
  })

  test("ignores non-session.idle events", async () => {
    const event: Event = {
      type: "message.updated",
      properties: { info: {} as any },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(client.session.promptAsync).not.toHaveBeenCalled()
  })

  test("ignores session.idle when session is not tracked", async () => {
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_unknown" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(client.session.promptAsync).not.toHaveBeenCalled()
  })

  test("calls client.session.promptAsync when session is active and under max", async () => {
    loopState.activate("ses_1")
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_1" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(client.session.promptAsync).toHaveBeenCalledTimes(1)
    const callArgs = (client.session.promptAsync as any).mock.calls[0][0]
    expect(callArgs.path.id).toBe("ses_1")
    expect(callArgs.body.parts).toBeDefined()
    expect(callArgs.body.parts.length).toBeGreaterThan(0)
    expect(callArgs.body.parts[0].type).toBe("text")
  })

  test("increments iteration after prompting", async () => {
    loopState.activate("ses_1")
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_1" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(loopState.getSession("ses_1")!.iteration).toBe(1)
  })

  test("does not prompt when session is completed", async () => {
    loopState.activate("ses_1")
    loopState.complete("ses_1")
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_1" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(client.session.promptAsync).not.toHaveBeenCalled()
  })

  test("does not prompt when max iterations reached", async () => {
    loopState = new LoopState({ maxIterations: 2 })
    loopState.activate("ses_1")
    loopState.increment("ses_1")
    loopState.increment("ses_1")
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_1" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(client.session.promptAsync).not.toHaveBeenCalled()
  })

  test("includes iteration info in the continuation message", async () => {
    loopState.activate("ses_1")
    loopState.increment("ses_1")
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_1" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    const callArgs = (client.session.promptAsync as any).mock.calls[0][0]
    const textPart = callArgs.body.parts[0]
    expect(textPart.text).toContain("2")
    expect(textPart.text).toContain("5")
  })

  test("catches and swallows prompt errors without throwing", async () => {
    loopState.activate("ses_1")
    client.session.promptAsync = mock(() => Promise.reject(new Error("network error")))
    const event: Event = {
      type: "session.idle",
      properties: { sessionID: "ses_1" },
    }
    await handleSessionEvent({ event, loopState, client: client as any })
    expect(loopState.getSession("ses_1")!.iteration).toBe(0)
  })
})
