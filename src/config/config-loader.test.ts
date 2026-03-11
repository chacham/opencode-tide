import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { ConfigLoadError, loadConfig } from "./config-loader"

const TMP = join(import.meta.dir, "__tmp__")
const OPENCODE_DIR = join(TMP, ".opencode")

function writeConfig(name: string, content: string) {
  writeFileSync(join(OPENCODE_DIR, name), content, "utf-8")
}

beforeEach(() => {
  mkdirSync(OPENCODE_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

describe("loadConfig", () => {
  describe("#when no config file", () => {
    test("returns empty config", async () => {
      const cfg = await loadConfig(TMP)
      expect(cfg).toEqual({})
    })
  })

  describe("#when tide.json exists", () => {
    test("parses valid JSON config", async () => {
      writeConfig("tide.json", JSON.stringify({ orchestrator: "main", agents: { main: { model: "claude-opus-4-5" } } }))
      const cfg = await loadConfig(TMP)
      expect(cfg.orchestrator).toBe("main")
      expect(cfg.agents?.main?.model).toBe("claude-opus-4-5")
    })
  })

  describe("#when tide.jsonc exists", () => {
    test("parses JSONC with line comments", async () => {
      writeConfig(
        "tide.jsonc",
        `{
  // orchestrator agent name
  "orchestrator": "boss",
  "agents": {
    "boss": { "model": "gpt-4o" }
  }
}`,
      )
      const cfg = await loadConfig(TMP)
      expect(cfg.orchestrator).toBe("boss")
    })

    test("parses JSONC with block comments", async () => {
      writeConfig(
        "tide.jsonc",
        `{
  /* block comment */
  "agents": { "a": { "model": "m" } }
}`,
      )
      const cfg = await loadConfig(TMP)
      expect(cfg.agents?.a?.model).toBe("m")
    })

    test("prefers tide.jsonc over tide.json when both exist", async () => {
      writeConfig("tide.jsonc", JSON.stringify({ orchestrator: "from-jsonc" }))
      writeConfig("tide.json", JSON.stringify({ orchestrator: "from-json" }))
      const cfg = await loadConfig(TMP)
      expect(cfg.orchestrator).toBe("from-jsonc")
    })
  })

  describe("#when config is invalid JSON", () => {
    test("throws ConfigLoadError", async () => {
      writeConfig("tide.json", "{ invalid json }")
      await expect(loadConfig(TMP)).rejects.toBeInstanceOf(ConfigLoadError)
    })
  })

  describe("#when config fails schema validation", () => {
    test("throws ConfigLoadError with field info", async () => {
      writeConfig("tide.json", JSON.stringify({ agents: { bad: { temperature: 0.5 } } }))
      const err = await loadConfig(TMP).catch((e) => e)
      expect(err).toBeInstanceOf(ConfigLoadError)
      expect(err.message).toContain("model")
    })
  })
})
