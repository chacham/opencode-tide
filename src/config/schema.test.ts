import { describe, expect, test } from "bun:test"
import { AgentConfigSchema, TideConfigSchema } from "./schema"

describe("AgentConfigSchema", () => {
  describe("#when valid", () => {
    test("accepts model only", () => {
      const result = AgentConfigSchema.safeParse({ model: "claude-opus-4-5" })
      expect(result.success).toBe(true)
    })

    test("accepts all fields", () => {
      const result = AgentConfigSchema.safeParse({
        model: "gpt-4o",
        prompt: "You are a helpful assistant.",
        temperature: 0.7,
        max_steps: 20,
      })
      expect(result.success).toBe(true)
    })

    test("accepts description", () => {
      const result = AgentConfigSchema.safeParse({
        model: "anthropic/claude-opus-4-5",
        description: "Use for complex reasoning tasks.",
      })
      expect(result.success).toBe(true)
    })

    test("accepts top_p", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", top_p: 0 }).success).toBe(true)
      expect(AgentConfigSchema.safeParse({ model: "m", top_p: 1 }).success).toBe(true)
      expect(AgentConfigSchema.safeParse({ model: "m", top_p: 0.9 }).success).toBe(true)
    })

    test("accepts color as hex string", () => {
      const result = AgentConfigSchema.safeParse({ model: "m", color: "#FF5733" })
      expect(result.success).toBe(true)
    })

    test("accepts disable flag", () => {
      const result = AgentConfigSchema.safeParse({ model: "m", disable: true })
      expect(result.success).toBe(true)
    })

    test("accepts mode values", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", mode: "subagent" }).success).toBe(true)
      expect(AgentConfigSchema.safeParse({ model: "m", mode: "primary" }).success).toBe(true)
      expect(AgentConfigSchema.safeParse({ model: "m", mode: "all" }).success).toBe(true)
    })

    test("accepts tools as boolean map", () => {
      const result = AgentConfigSchema.safeParse({
        model: "m",
        tools: { bash: false, webfetch: true, read: true },
      })
      expect(result.success).toBe(true)
    })

    test("accepts permission with simple values", () => {
      const result = AgentConfigSchema.safeParse({
        model: "m",
        permission: { edit: "allow", webfetch: "deny", doom_loop: "ask" },
      })
      expect(result.success).toBe(true)
    })

    test("accepts permission.bash as string", () => {
      const result = AgentConfigSchema.safeParse({
        model: "m",
        permission: { bash: "allow" },
      })
      expect(result.success).toBe(true)
    })

    test("accepts permission.bash as per-command map", () => {
      const result = AgentConfigSchema.safeParse({
        model: "m",
        permission: { bash: { "git commit": "allow", "rm -rf": "deny" } },
      })
      expect(result.success).toBe(true)
    })

    test("accepts temperature at boundaries", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", temperature: 0 }).success).toBe(true)
      expect(AgentConfigSchema.safeParse({ model: "m", temperature: 2 }).success).toBe(true)
    })
  })

  describe("#when invalid", () => {
    test("rejects missing model", () => {
      const result = AgentConfigSchema.safeParse({ temperature: 0.5 })
      expect(result.success).toBe(false)
    })

    test("rejects temperature out of range", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", temperature: -0.1 }).success).toBe(false)
      expect(AgentConfigSchema.safeParse({ model: "m", temperature: 2.1 }).success).toBe(false)
    })

    test("rejects top_p out of range", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", top_p: -0.1 }).success).toBe(false)
      expect(AgentConfigSchema.safeParse({ model: "m", top_p: 1.1 }).success).toBe(false)
    })

    test("rejects invalid mode value", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", mode: "invalid" }).success).toBe(false)
    })

    test("rejects tools with non-boolean values", () => {
      expect(
        AgentConfigSchema.safeParse({ model: "m", tools: { bash: "allow" } }).success,
      ).toBe(false)
    })

    test("rejects permission with invalid action value", () => {
      expect(
        AgentConfigSchema.safeParse({ model: "m", permission: { edit: "yes" } }).success,
      ).toBe(false)
    })

    test("rejects non-positive max_steps", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", max_steps: 0 }).success).toBe(false)
      expect(AgentConfigSchema.safeParse({ model: "m", max_steps: -1 }).success).toBe(false)
    })

    test("rejects non-integer max_steps", () => {
      expect(AgentConfigSchema.safeParse({ model: "m", max_steps: 1.5 }).success).toBe(false)
    })
  })
})

describe("TideConfigSchema", () => {
  describe("#when valid", () => {
    test("accepts empty object", () => {
      expect(TideConfigSchema.safeParse({}).success).toBe(true)
    })

    test("accepts full config", () => {
      const result = TideConfigSchema.safeParse({
        orchestrator: "main",
        agents: {
          main: { model: "claude-opus-4-5", prompt: "Orchestrate tasks." },
          worker: { model: "gpt-4o" },
        },
        loop: { max_iterations: 10 },
      })
      expect(result.success).toBe(true)
    })

    test("accepts config with no agents — unused agents are simply absent", () => {
      const result = TideConfigSchema.safeParse({ orchestrator: "main" })
      expect(result.success).toBe(true)
    })

    test("accepts $schema field", () => {
      const result = TideConfigSchema.safeParse({ $schema: "./tide.schema.json" })
      expect(result.success).toBe(true)
    })

    test("accepts base config without model", () => {
      const result = TideConfigSchema.safeParse({
        base: { temperature: 0.5, mode: "subagent" },
        agents: { worker: { model: "openai/gpt-4o" } },
      })
      expect(result.success).toBe(true)
    })

    test("accepts base config with model", () => {
      const result = TideConfigSchema.safeParse({
        base: { model: "anthropic/claude-haiku-3-5", temperature: 0.3 },
        agents: { worker: {} },
      })
      expect(result.success).toBe(true)
    })
  })

  describe("#when invalid", () => {
    test("rejects invalid agent config inside agents map", () => {
      const result = TideConfigSchema.safeParse({
        agents: { bad: { model: "m", temperature: 5.0 } },
      })
      expect(result.success).toBe(false)
    })

    test("rejects non-integer loop.max_iterations", () => {
      const result = TideConfigSchema.safeParse({ loop: { max_iterations: 1.5 } })
      expect(result.success).toBe(false)
    })

    test("rejects non-positive loop.max_iterations", () => {
      const result = TideConfigSchema.safeParse({ loop: { max_iterations: 0 } })
      expect(result.success).toBe(false)
    })
  })
})
