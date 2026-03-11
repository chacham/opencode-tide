import { describe, expect, it } from "bun:test"
import { LoopState } from "./loop-state"
import { buildLoopSystemPrompt, createSystemTransformHook } from "./system-prompt"

describe("buildLoopSystemPrompt", () => {
  it("returns empty string when session is not tracked", () => {
    const loopState = new LoopState({})
    const result = buildLoopSystemPrompt(loopState, "session-1")
    expect(result).toBe("")
  })

  it("returns empty string when session is completed", () => {
    const loopState = new LoopState({})
    loopState.activate("session-1")
    loopState.complete("session-1")
    const result = buildLoopSystemPrompt(loopState, "session-1")
    expect(result).toBe("")
  })

  it("includes iteration info for active session", () => {
    const loopState = new LoopState({ maxIterations: 10 })
    loopState.activate("session-1")
    const result = buildLoopSystemPrompt(loopState, "session-1")
    expect(result).toContain("0")
    expect(result).toContain("10")
  })

  it("includes updated iteration after increment", () => {
    const loopState = new LoopState({ maxIterations: 10 })
    loopState.activate("session-1")
    loopState.increment("session-1")
    loopState.increment("session-1")
    const result = buildLoopSystemPrompt(loopState, "session-1")
    expect(result).toContain("2")
    expect(result).toContain("10")
  })

  it("mentions tide_loop_complete tool", () => {
    const loopState = new LoopState({})
    loopState.activate("session-1")
    const result = buildLoopSystemPrompt(loopState, "session-1")
    expect(result).toContain("tide_loop_complete")
  })

  it("mentions tide_loop_status tool", () => {
    const loopState = new LoopState({})
    loopState.activate("session-1")
    const result = buildLoopSystemPrompt(loopState, "session-1")
    expect(result).toContain("tide_loop_status")
  })
})

describe("createSystemTransformHook", () => {
  it("returns a function", () => {
    const loopState = new LoopState({})
    const hook = createSystemTransformHook(loopState)
    expect(typeof hook).toBe("function")
  })

  it("appends loop system prompt to output.system when session is active", async () => {
    const loopState = new LoopState({ maxIterations: 5 })
    loopState.activate("session-abc")
    const hook = createSystemTransformHook(loopState)

    const output = { system: ["You are a helpful assistant."] }
    await hook({ sessionID: "session-abc", model: "claude-opus-4-5" }, output)

    expect(output.system.length).toBe(2)
    expect(output.system[1]).toContain("tide_loop_complete")
  })

  it("does not append when session is not tracked", async () => {
    const loopState = new LoopState({})
    const hook = createSystemTransformHook(loopState)

    const output = { system: ["You are a helpful assistant."] }
    await hook({ sessionID: "session-xyz", model: "claude-opus-4-5" }, output)

    expect(output.system.length).toBe(1)
  })

  it("does not append when session is completed", async () => {
    const loopState = new LoopState({})
    loopState.activate("session-done")
    loopState.complete("session-done")
    const hook = createSystemTransformHook(loopState)

    const output = { system: ["base prompt"] }
    await hook({ sessionID: "session-done", model: "claude-opus-4-5" }, output)

    expect(output.system.length).toBe(1)
  })

  it("handles missing sessionID gracefully", async () => {
    const loopState = new LoopState({})
    const hook = createSystemTransformHook(loopState)

    const output = { system: ["base prompt"] }
    await hook({ model: "claude-opus-4-5" }, output)

    expect(output.system.length).toBe(1)
  })

  it("initializes system array if empty", async () => {
    const loopState = new LoopState({})
    loopState.activate("session-empty")
    const hook = createSystemTransformHook(loopState)

    const output: { system: string[] } = { system: [] }
    await hook({ sessionID: "session-empty", model: "gpt-4o" }, output)

    expect(output.system.length).toBe(1)
    expect(output.system[0]).toContain("tide_loop_complete")
  })
})
