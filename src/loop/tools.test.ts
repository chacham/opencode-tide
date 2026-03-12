import { describe, expect, it, mock } from "bun:test"
import { LoopState } from "./loop-state"
import { createLoopTools } from "./tools"
import type { OpencodeClient } from "@opencode-ai/sdk"

const makeContext = (sessionID: string) => ({
  sessionID,
  messageID: "msg-1",
  agent: "test-agent",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: mock(() => {}),
  ask: mock(async () => {}),
})

const makeClient = (promptAsyncMock = mock(async () => {})) =>
  ({
    session: {
      promptAsync: promptAsyncMock,
    },
  }) as unknown as OpencodeClient

describe("createLoopTools", () => {
  it("returns an object with tide_loop_start, tide_loop_complete, tide_loop_status and tide_delegate", () => {
    const loopState = new LoopState({})
    const tools = createLoopTools({ loopState, client: makeClient() })
    expect(tools).toHaveProperty("tide_loop_start")
    expect(tools).toHaveProperty("tide_loop_complete")
    expect(tools).toHaveProperty("tide_loop_status")
    expect(tools).toHaveProperty("tide_delegate")
  })

  describe("tide_loop_start", () => {
    it("activates the loop for the session", async () => {
      const loopState = new LoopState({})
      const tools = createLoopTools({ loopState, client: makeClient() })
      await tools.tide_loop_start.execute({}, makeContext("session-start-1"))
      expect(loopState.getSession("session-start-1")).toBeDefined()
      expect(loopState.getSession("session-start-1")?.status).toBe("active")
    })

    it("returns a confirmation message", async () => {
      const loopState = new LoopState({})
      const tools = createLoopTools({ loopState, client: makeClient() })
      const result = await tools.tide_loop_start.execute({}, makeContext("session-start-2"))
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("makes shouldContinue return true after activation", async () => {
      const loopState = new LoopState({})
      const tools = createLoopTools({ loopState, client: makeClient() })
      await tools.tide_loop_start.execute({}, makeContext("session-start-3"))
      expect(loopState.shouldContinue("session-start-3")).toBe(true)
    })

    it("resets iteration to 0 if loop is restarted", async () => {
      const loopState = new LoopState({})
      loopState.activate("session-start-4")
      loopState.increment("session-start-4")
      loopState.increment("session-start-4")
      const tools = createLoopTools({ loopState, client: makeClient() })
      await tools.tide_loop_start.execute({}, makeContext("session-start-4"))
      expect(loopState.getSession("session-start-4")?.iteration).toBe(0)
    })
  })

  describe("tide_loop_status", () => {
    it("returns not_tracked when session has no loop state", async () => {
      const loopState = new LoopState({})
      const tools = createLoopTools({ loopState, client: makeClient() })
      const result = await tools.tide_loop_status.execute({}, makeContext("session-1"))
      expect(result).toContain("not_tracked")
    })

    it("returns current iteration and max for active session", async () => {
      const loopState = new LoopState({ maxIterations: 15 })
      loopState.activate("session-2")
      loopState.increment("session-2")
      loopState.increment("session-2")
      const tools = createLoopTools({ loopState, client: makeClient() })
      const result = await tools.tide_loop_status.execute({}, makeContext("session-2"))
      expect(result).toContain("2")
      expect(result).toContain("15")
      expect(result).toContain("active")
    })

    it("returns completed status when session is done", async () => {
      const loopState = new LoopState({})
      loopState.activate("session-3")
      loopState.complete("session-3")
      const tools = createLoopTools({ loopState, client: makeClient() })
      const result = await tools.tide_loop_status.execute({}, makeContext("session-3"))
      expect(result).toContain("completed")
    })
  })

  describe("tide_loop_complete", () => {
    it("marks session as completed", async () => {
      const loopState = new LoopState({})
      loopState.activate("session-4")
      const tools = createLoopTools({ loopState, client: makeClient() })
      await tools.tide_loop_complete.execute({}, makeContext("session-4"))
      const session = loopState.getSession("session-4")
      expect(session?.status).toBe("completed")
    })

    it("returns a confirmation message", async () => {
      const loopState = new LoopState({})
      loopState.activate("session-5")
      const tools = createLoopTools({ loopState, client: makeClient() })
      const result = await tools.tide_loop_complete.execute({}, makeContext("session-5"))
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("does not throw when session is not tracked", async () => {
      const loopState = new LoopState({})
      const tools = createLoopTools({ loopState, client: makeClient() })
      expect(() =>
        tools.tide_loop_complete.execute({}, makeContext("session-untracked")),
      ).not.toThrow()
    })

    it("returns message even when session is already completed", async () => {
      const loopState = new LoopState({})
      loopState.activate("session-6")
      loopState.complete("session-6")
      const tools = createLoopTools({ loopState, client: makeClient() })
      const result = await tools.tide_loop_complete.execute({}, makeContext("session-6"))
      expect(typeof result).toBe("string")
    })
  })

  describe("tide_delegate", () => {
    it("calls promptAsync with a subtask part", async () => {
      const promptAsync = mock(async () => {})
      const tools = createLoopTools({ loopState: new LoopState({}), client: makeClient(promptAsync) })
      await tools.tide_delegate.execute(
        { agent: "worker", description: "Build auth module", prompt: "Implement JWT auth in src/auth/index.ts" },
        makeContext("session-delegate-1"),
      )
      expect(promptAsync).toHaveBeenCalledTimes(1)
      const call = (promptAsync.mock.calls as unknown as Array<[{ path: { id: string }; body: { parts: Array<{ type: string; agent: string; description: string; prompt: string }> } }]>)[0]![0]
      expect(call.path.id).toBe("session-delegate-1")
      expect(call.body.parts[0].type).toBe("subtask")
      expect(call.body.parts[0].agent).toBe("worker")
      expect(call.body.parts[0].description).toBe("Build auth module")
      expect(call.body.parts[0].prompt).toBe("Implement JWT auth in src/auth/index.ts")
    })

    it("returns a confirmation message with the agent name", async () => {
      const tools = createLoopTools({ loopState: new LoopState({}), client: makeClient() })
      const result = await tools.tide_delegate.execute(
        { agent: "worker", description: "Build auth module", prompt: "Implement JWT auth" },
        makeContext("session-delegate-2"),
      )
      expect(typeof result).toBe("string")
      expect(result).toContain("worker")
    })

    it("passes description and prompt correctly to the subtask part", async () => {
      const promptAsync = mock(async () => {})
      const tools = createLoopTools({ loopState: new LoopState({}), client: makeClient(promptAsync) })
      await tools.tide_delegate.execute(
        { agent: "researcher", description: "Research topic", prompt: "Find all papers on X" },
        makeContext("session-delegate-3"),
      )
      const part = (promptAsync.mock.calls as unknown as Array<[{ body: { parts: Array<{ description: string; prompt: string }> } }]>)[0]![0].body.parts[0]!
      expect(part.description).toBe("Research topic")
      expect(part.prompt).toBe("Find all papers on X")
    })

    it("does not throw when promptAsync rejects", async () => {
      const promptAsync = mock(async () => { throw new Error("network error") })
      const tools = createLoopTools({ loopState: new LoopState({}), client: makeClient(promptAsync) })
      await expect(
        tools.tide_delegate.execute(
          { agent: "worker", description: "task", prompt: "do something" },
          makeContext("session-delegate-4"),
        ),
      ).resolves.toBeDefined()
    })

    it("returns error message when promptAsync rejects", async () => {
      const promptAsync = mock(async () => { throw new Error("network error") })
      const tools = createLoopTools({ loopState: new LoopState({}), client: makeClient(promptAsync) })
      const result = await tools.tide_delegate.execute(
        { agent: "worker", description: "task", prompt: "do something" },
        makeContext("session-delegate-5"),
      )
      expect(result).toContain("network error")
    })
  })
})
