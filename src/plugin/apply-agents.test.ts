import { describe, expect, test } from "bun:test"
import type { Config } from "@opencode-ai/sdk"
import { applyAgentsToConfig } from "./apply-agents"
import type { TideConfig } from "../config/schema"

describe("applyAgentsToConfig", () => {
  describe("#basic field mapping", () => {
    test("maps model", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "anthropic/claude-opus-4-5" } } }, cfg)
      expect(cfg.agent?.a?.model).toBe("anthropic/claude-opus-4-5")
    })

    test("maps prompt", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", prompt: "You are helpful." } } }, cfg)
      expect(cfg.agent?.a?.prompt).toBe("You are helpful.")
    })

    test("maps temperature", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", temperature: 0.7 } } }, cfg)
      expect(cfg.agent?.a?.temperature).toBe(0.7)
    })

    test("maps max_steps to maxSteps", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", max_steps: 30 } } }, cfg)
      expect(cfg.agent?.a?.maxSteps).toBe(30)
    })

    test("does not set undefined optional fields", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m" } } }, cfg)
      const agent = cfg.agent?.a
      expect(agent?.prompt).toBeUndefined()
      expect(agent?.temperature).toBeUndefined()
      expect(agent?.maxSteps).toBeUndefined()
    })
  })

  describe("#new fields", () => {
    test("maps description", () => {
      const cfg: Config = {}
      applyAgentsToConfig(
        { agents: { a: { model: "m", description: "Use for research tasks." } } },
        cfg,
      )
      expect(cfg.agent?.a?.description).toBe("Use for research tasks.")
    })

    test("maps top_p", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", top_p: 0.9 } } }, cfg)
      expect(cfg.agent?.a?.top_p).toBe(0.9)
    })

    test("maps mode", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", mode: "subagent" } } }, cfg)
      expect(cfg.agent?.a?.mode).toBe("subagent")
    })

    test("maps color", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", color: "#FF5733" } } }, cfg)
      expect(cfg.agent?.a?.color).toBe("#FF5733")
    })

    test("maps disable", () => {
      const cfg: Config = {}
      applyAgentsToConfig({ agents: { a: { model: "m", disable: true } } }, cfg)
      expect(cfg.agent?.a?.disable).toBe(true)
    })

    test("maps tools allow/deny map", () => {
      const cfg: Config = {}
      applyAgentsToConfig(
        { agents: { a: { model: "m", tools: { bash: false, webfetch: true } } } },
        cfg,
      )
      expect(cfg.agent?.a?.tools).toEqual({ bash: false, webfetch: true })
    })
  })

  describe("#edge cases", () => {
    test("does nothing when agents is undefined", () => {
      const cfg: Config = {}
      applyAgentsToConfig({}, cfg)
      expect(cfg.agent).toBeUndefined()
    })

    test("merges into existing agent config", () => {
      const cfg: Config = { agent: { existing: { model: "x" } } }
      applyAgentsToConfig({ agents: { new: { model: "y" } } }, cfg)
      expect(cfg.agent?.existing?.model).toBe("x")
      expect(cfg.agent?.new?.model).toBe("y")
    })

    test("registers multiple agents", () => {
      const cfg: Config = {}
      const tideConfig: TideConfig = {
        agents: {
          main: { model: "anthropic/claude-opus-4-5", description: "Orchestrator" },
          worker: { model: "openai/gpt-4o", mode: "subagent" },
          researcher: { model: "google/gemini-2.0-flash", disable: true },
        },
      }
      applyAgentsToConfig(tideConfig, cfg)
      expect(Object.keys(cfg.agent ?? {})).toHaveLength(3)
      expect(cfg.agent?.main?.description).toBe("Orchestrator")
      expect(cfg.agent?.worker?.mode).toBe("subagent")
      expect(cfg.agent?.researcher?.disable).toBe(true)
    })
  })
})
