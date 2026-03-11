import { beforeEach, describe, expect, test } from "bun:test"
import { LoopState } from "./loop-state"

describe("LoopState", () => {
  let state: LoopState

  beforeEach(() => {
    state = new LoopState({ maxIterations: 10 })
  })

  describe("#getSession", () => {
    test("returns undefined for unknown session", () => {
      expect(state.getSession("unknown")).toBeUndefined()
    })

    test("returns session state after activation", () => {
      state.activate("ses_1")
      const session = state.getSession("ses_1")
      expect(session).toBeDefined()
      expect(session!.iteration).toBe(0)
      expect(session!.status).toBe("active")
    })
  })

  describe("#activate", () => {
    test("creates active session with iteration 0", () => {
      state.activate("ses_1")
      expect(state.getSession("ses_1")).toEqual({
        iteration: 0,
        status: "active",
      })
    })

    test("resets session if already exists", () => {
      state.activate("ses_1")
      state.increment("ses_1")
      state.increment("ses_1")
      state.activate("ses_1")
      expect(state.getSession("ses_1")!.iteration).toBe(0)
      expect(state.getSession("ses_1")!.status).toBe("active")
    })
  })

  describe("#increment", () => {
    test("increments iteration count", () => {
      state.activate("ses_1")
      state.increment("ses_1")
      expect(state.getSession("ses_1")!.iteration).toBe(1)
    })

    test("increments multiple times", () => {
      state.activate("ses_1")
      state.increment("ses_1")
      state.increment("ses_1")
      state.increment("ses_1")
      expect(state.getSession("ses_1")!.iteration).toBe(3)
    })

    test("does nothing for unknown session", () => {
      state.increment("unknown")
      expect(state.getSession("unknown")).toBeUndefined()
    })

    test("does nothing for completed session", () => {
      state.activate("ses_1")
      state.increment("ses_1")
      state.complete("ses_1")
      state.increment("ses_1")
      expect(state.getSession("ses_1")!.iteration).toBe(1)
    })
  })

  describe("#complete", () => {
    test("marks session as completed", () => {
      state.activate("ses_1")
      state.complete("ses_1")
      expect(state.getSession("ses_1")!.status).toBe("completed")
    })

    test("does nothing for unknown session", () => {
      state.complete("unknown")
      expect(state.getSession("unknown")).toBeUndefined()
    })
  })

  describe("#shouldContinue", () => {
    test("returns false for unknown session", () => {
      expect(state.shouldContinue("unknown")).toBe(false)
    })

    test("returns true for active session under max iterations", () => {
      state.activate("ses_1")
      expect(state.shouldContinue("ses_1")).toBe(true)
    })

    test("returns true up to max_iterations - 1 increments", () => {
      state = new LoopState({ maxIterations: 3 })
      state.activate("ses_1")
      state.increment("ses_1") // 1
      state.increment("ses_1") // 2
      expect(state.shouldContinue("ses_1")).toBe(true)
    })

    test("returns false when iteration reaches max_iterations", () => {
      state = new LoopState({ maxIterations: 3 })
      state.activate("ses_1")
      state.increment("ses_1") // 1
      state.increment("ses_1") // 2
      state.increment("ses_1") // 3
      expect(state.shouldContinue("ses_1")).toBe(false)
    })

    test("returns false for completed session", () => {
      state.activate("ses_1")
      state.complete("ses_1")
      expect(state.shouldContinue("ses_1")).toBe(false)
    })

    test("uses default maxIterations of 20 when not specified", () => {
      state = new LoopState({})
      state.activate("ses_1")
      for (let i = 0; i < 19; i++) state.increment("ses_1")
      expect(state.shouldContinue("ses_1")).toBe(true)
      state.increment("ses_1") // 20
      expect(state.shouldContinue("ses_1")).toBe(false)
    })
  })

  describe("#remove", () => {
    test("removes session state", () => {
      state.activate("ses_1")
      state.remove("ses_1")
      expect(state.getSession("ses_1")).toBeUndefined()
    })

    test("does nothing for unknown session", () => {
      state.remove("unknown") // no throw
    })
  })

  describe("multiple sessions", () => {
    test("tracks sessions independently", () => {
      state.activate("ses_1")
      state.activate("ses_2")
      state.increment("ses_1")
      state.increment("ses_1")
      state.increment("ses_2")
      state.complete("ses_2")

      expect(state.getSession("ses_1")!.iteration).toBe(2)
      expect(state.getSession("ses_1")!.status).toBe("active")
      expect(state.getSession("ses_2")!.iteration).toBe(1)
      expect(state.getSession("ses_2")!.status).toBe("completed")
    })
  })
})
