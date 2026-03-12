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
      create: mock(async () => ({ data: { id: "child-session-1" } })),
      promptAsync: promptAsyncMock,
      status: mock(async (opts: { path: { id: string } }) => ({ data: { [opts.path.id]: { type: "idle" } } })),
      messages: mock(async () => ({
        data: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "done" }] }],
      })),
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
    it("returns the result from the delegated agent", async () => {
      const tools = createLoopTools({ loopState: new LoopState({}), client: makeClient() })
      const result = await tools.tide_delegate.execute(
        { agent: "worker", prompt: "Implement JWT auth in src/auth/index.ts" },
        makeContext("session-delegate-1"),
      )
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("passes the prompt to the child session", async () => {
      const promptAsync = mock(async () => {})
      const client: OpencodeClient = {
        session: {
          create: mock(async () => ({ data: { id: "child-1" } })),
          promptAsync,
          status: mock(async (opts: { path: { id: string } }) => ({ data: { [opts.path.id]: { type: "idle" } } })),
          messages: mock(async () => ({
            data: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "done" }] }],
          })),
        },
      } as unknown as OpencodeClient
      const tools = createLoopTools({ loopState: new LoopState({}), client })
      await tools.tide_delegate.execute(
        { agent: "worker", prompt: "do the thing" },
        makeContext("session-delegate-2"),
      )
      const call = (promptAsync.mock.calls as unknown as Array<[{ body: { agent: string; parts: Array<{ text: string }> } }]>)[0]![0]
      expect(call.body.agent).toBe("worker")
      expect(call.body.parts[0]!.text).toBe("do the thing")
    })

    it("returns error message when delegate fails", async () => {
      const create = mock(async () => { throw new Error("create failed") })
      const client: OpencodeClient = {
        session: {
          create,
          promptAsync: mock(async () => {}),
          status: mock(async () => ({ data: {} })),
          messages: mock(async () => ({ data: [] })),
        },
      } as unknown as OpencodeClient
      const tools = createLoopTools({ loopState: new LoopState({}), client })
      const result = await tools.tide_delegate.execute(
        { agent: "worker", prompt: "do something" },
        makeContext("session-delegate-3"),
      )
      expect(result).toContain("create failed")
    })

    it("does not throw when delegation fails", async () => {
      const create = mock(async () => { throw new Error("network error") })
      const client: OpencodeClient = {
        session: {
          create,
          promptAsync: mock(async () => {}),
          status: mock(async () => ({ data: {} })),
          messages: mock(async () => ({ data: [] })),
        },
      } as unknown as OpencodeClient
      const tools = createLoopTools({ loopState: new LoopState({}), client })
      await expect(
        tools.tide_delegate.execute(
          { agent: "worker", prompt: "do something" },
          makeContext("session-delegate-4"),
        ),
      ).resolves.toBeDefined()
    })
  })
})
