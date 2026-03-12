import { describe, expect, it, mock } from "bun:test"
import { runDelegate } from "./delegate"
import type { OpencodeClient } from "@opencode-ai/sdk"

type MockFn = ReturnType<typeof mock>

const makeClient = (overrides: {
  create?: MockFn
  promptAsync?: MockFn
  statusSequence?: Array<{ type: string }>
  messages?: MockFn
} = {}): OpencodeClient => {
  const statusCalls = { count: 0 }
  const sequence = overrides.statusSequence ?? [{ type: "idle" }]

  return {
    session: {
      create: overrides.create ?? mock(async () => ({ data: { id: "child-session-1" } })),
      promptAsync: overrides.promptAsync ?? mock(async () => {}),
      status: mock(async (opts: { path: { id: string } }) => {
        const idx = Math.min(statusCalls.count++, sequence.length - 1)
        return { data: { [opts.path.id]: sequence[idx] } }
      }),
      messages: overrides.messages ?? mock(async () => ({
        data: [
          {
            info: { role: "assistant" },
            parts: [{ type: "text", text: "Task completed successfully." }],
          },
        ],
      })),
    },
  } as unknown as OpencodeClient
}

describe("runDelegate", () => {
  describe("#session creation", () => {
    it("creates a child session with the parent session ID", async () => {
      const create = mock(async () => ({ data: { id: "child-1" } }))
      const client = makeClient({ create })
      await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work" })
      expect(create).toHaveBeenCalledTimes(1)
      const call = (create.mock.calls as unknown as Array<[{ body: { parentID: string } }]>)[0]![0]
      expect(call.body.parentID).toBe("parent-1")
    })

    it("returns error message when session creation fails", async () => {
      const create = mock(async () => { throw new Error("create failed") })
      const client = makeClient({ create })
      const result = await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work" })
      expect(result).toContain("create failed")
    })
  })

  describe("#prompt dispatch", () => {
    it("sends promptAsync to the child session with the specified agent", async () => {
      const promptAsync = mock(async () => {})
      const client = makeClient({ promptAsync })
      await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work" })
      expect(promptAsync).toHaveBeenCalledTimes(1)
      const call = (promptAsync.mock.calls as unknown as Array<[{ path: { id: string }; body: { agent: string; parts: Array<{ type: string; text: string }> } }]>)[0]![0]
      expect(call.path.id).toBe("child-session-1")
      expect(call.body.agent).toBe("worker")
      expect(call.body.parts[0]!.type).toBe("text")
      expect(call.body.parts[0]!.text).toBe("do work")
    })

    it("returns error message when promptAsync fails", async () => {
      const promptAsync = mock(async () => { throw new Error("prompt failed") })
      const client = makeClient({ promptAsync })
      const result = await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work" })
      expect(result).toContain("prompt failed")
    })
  })

  describe("#polling for completion", () => {
    it("polls until the child session is idle", async () => {
      const statusSequence = [{ type: "busy" }, { type: "busy" }, { type: "idle" }]
      const client = makeClient({ statusSequence })
      const result = await runDelegate({
        client, sessionID: "parent-1", agent: "worker", prompt: "do work",
        pollIntervalMs: 0,
      })
      expect(typeof result).toBe("string")
    })

    it("returns timeout message when session never becomes idle", async () => {
      const statusSequence = Array(100).fill({ type: "busy" })
      const client = makeClient({ statusSequence })
      const result = await runDelegate({
        client, sessionID: "parent-1", agent: "worker", prompt: "do work",
        pollIntervalMs: 0, timeoutMs: 0,
      })
      expect(result).toContain("timed out")
    })
  })

  describe("#result extraction", () => {
    it("returns the text from the last assistant message", async () => {
      const messages = mock(async () => ({
        data: [
          {
            info: { role: "user" },
            parts: [{ type: "text", text: "do work" }],
          },
          {
            info: { role: "assistant" },
            parts: [{ type: "text", text: "Work is done." }],
          },
        ],
      }))
      const client = makeClient({ messages })
      const result = await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work", pollIntervalMs: 0 })
      expect(result).toBe("Work is done.")
    })

    it("concatenates multiple text parts from the last assistant message", async () => {
      const messages = mock(async () => ({
        data: [
          {
            info: { role: "assistant" },
            parts: [
              { type: "text", text: "Part one. " },
              { type: "reasoning", text: "thinking..." },
              { type: "text", text: "Part two." },
            ],
          },
        ],
      }))
      const client = makeClient({ messages })
      const result = await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work", pollIntervalMs: 0 })
      expect(result).toBe("Part one. Part two.")
    })

    it("returns fallback message when no assistant message found", async () => {
      const messages = mock(async () => ({ data: [] }))
      const client = makeClient({ messages })
      const result = await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work", pollIntervalMs: 0 })
      expect(result).toContain("no response")
    })

    it("fetches messages from the child session", async () => {
      const messages = mock(async () => ({
        data: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "done" }] }],
      }))
      const client = makeClient({ messages })
      await runDelegate({ client, sessionID: "parent-1", agent: "worker", prompt: "do work", pollIntervalMs: 0 })
      const call = (messages.mock.calls as unknown as Array<[{ path: { id: string } }]>)[0]![0]
      expect(call.path.id).toBe("child-session-1")
    })
  })
})
