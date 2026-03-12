import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { ConfigLoadError, loadConfig } from "./config-loader"

const TMP = join(import.meta.dir, "__tmp__")
const PROJECT_DIR = join(TMP, "project")
const USER_DIR = join(TMP, "user")
const OPENCODE_DIR = join(PROJECT_DIR, ".opencode")

function writeProjectConfig(name: string, content: string) {
  writeFileSync(join(OPENCODE_DIR, name), content, "utf-8")
}

function writeUserConfig(name: string, content: string) {
  writeFileSync(join(USER_DIR, name), content, "utf-8")
}

beforeEach(() => {
  mkdirSync(OPENCODE_DIR, { recursive: true })
  mkdirSync(USER_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

describe("loadConfig", () => {
  describe("#when no config file", () => {
    test("returns empty config", async () => {
      const cfg = await loadConfig(PROJECT_DIR)
      expect(cfg).toEqual({})
    })

    test("returns empty config when user dir also has no config", async () => {
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg).toEqual({})
    })
  })

  describe("#when only project config exists", () => {
    test("parses valid JSON config", async () => {
      writeProjectConfig("tide.json", JSON.stringify({ orchestrator: "main", agents: { main: { model: "claude-opus-4-5" } } }))
      const cfg = await loadConfig(PROJECT_DIR)
      expect(cfg.orchestrator).toBe("main")
      expect(cfg.agents?.main?.model).toBe("claude-opus-4-5")
    })

    test("parses JSONC with line comments", async () => {
      writeProjectConfig(
        "tide.jsonc",
        `{
  // orchestrator agent name
  "orchestrator": "boss",
  "agents": {
    "boss": { "model": "gpt-4o" }
  }
}`,
      )
      const cfg = await loadConfig(PROJECT_DIR)
      expect(cfg.orchestrator).toBe("boss")
    })

    test("parses JSONC with block comments", async () => {
      writeProjectConfig(
        "tide.jsonc",
        `{
  /* block comment */
  "agents": { "a": { "model": "m" } }
}`,
      )
      const cfg = await loadConfig(PROJECT_DIR)
      expect(cfg.agents?.a?.model).toBe("m")
    })

    test("prefers tide.jsonc over tide.json when both exist", async () => {
      writeProjectConfig("tide.jsonc", JSON.stringify({ orchestrator: "from-jsonc" }))
      writeProjectConfig("tide.json", JSON.stringify({ orchestrator: "from-json" }))
      const cfg = await loadConfig(PROJECT_DIR)
      expect(cfg.orchestrator).toBe("from-jsonc")
    })
  })

  describe("#when only user config exists", () => {
    test("loads user config when no project config", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ orchestrator: "user-agent", agents: { "user-agent": { model: "gpt-4o" } } }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.orchestrator).toBe("user-agent")
      expect(cfg.agents?.["user-agent"]?.model).toBe("gpt-4o")
    })

    test("loads tide.json from user dir", async () => {
      writeUserConfig("tide.json", JSON.stringify({ orchestrator: "u" }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.orchestrator).toBe("u")
    })

    test("prefers tide.jsonc over tide.json in user dir", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ orchestrator: "user-jsonc" }))
      writeUserConfig("tide.json", JSON.stringify({ orchestrator: "user-json" }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.orchestrator).toBe("user-jsonc")
    })
  })

  describe("#when both user and project configs exist", () => {
    test("project orchestrator overrides user", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ orchestrator: "user-orch" }))
      writeProjectConfig("tide.jsonc", JSON.stringify({ orchestrator: "project-orch" }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.orchestrator).toBe("project-orch")
    })

    test("user orchestrator used when project does not set it", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ orchestrator: "user-orch" }))
      writeProjectConfig("tide.jsonc", JSON.stringify({ agents: { x: { model: "m" } } }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.orchestrator).toBe("user-orch")
    })

    test("project agents override same-named user agents", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ agents: { coder: { model: "gpt-4o" }, reviewer: { model: "gpt-3.5" } } }))
      writeProjectConfig("tide.jsonc", JSON.stringify({ agents: { coder: { model: "claude-opus-4-5" } } }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.agents?.coder?.model).toBe("claude-opus-4-5")
      expect(cfg.agents?.reviewer?.model).toBe("gpt-3.5")
    })

    test("project base overrides user base", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ base: { temperature: 0.3, max_steps: 40 } }))
      writeProjectConfig("tide.jsonc", JSON.stringify({ base: { temperature: 0.7 } }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.base?.temperature).toBe(0.7)
      expect(cfg.base?.max_steps).toBe(40)
    })

    test("project loop overrides user loop", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ loop: { max_iterations: 10 } }))
      writeProjectConfig("tide.jsonc", JSON.stringify({ loop: { max_iterations: 20 } }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.loop?.max_iterations).toBe(20)
    })

    test("user loop used when project does not set it", async () => {
      writeUserConfig("tide.jsonc", JSON.stringify({ loop: { max_iterations: 10 } }))
      writeProjectConfig("tide.jsonc", JSON.stringify({ orchestrator: "x" }))
      const cfg = await loadConfig(PROJECT_DIR, USER_DIR)
      expect(cfg.loop?.max_iterations).toBe(10)
    })
  })

  describe("#when config is invalid JSON", () => {
    test("throws ConfigLoadError for invalid project config", async () => {
      writeProjectConfig("tide.json", "{ invalid json }")
      await expect(loadConfig(PROJECT_DIR)).rejects.toBeInstanceOf(ConfigLoadError)
    })

    test("throws ConfigLoadError for invalid user config", async () => {
      writeUserConfig("tide.json", "{ invalid json }")
      await expect(loadConfig(PROJECT_DIR, USER_DIR)).rejects.toBeInstanceOf(ConfigLoadError)
    })
  })

  describe("#when config fails schema validation", () => {
    test("throws ConfigLoadError with field info for project config", async () => {
      writeProjectConfig("tide.json", JSON.stringify({ agents: { bad: { model: "m", temperature: 5.0 } } }))
      const err = await loadConfig(PROJECT_DIR).catch((e) => e)
      expect(err).toBeInstanceOf(ConfigLoadError)
      expect(err.message).toContain("temperature")
    })

    test("throws ConfigLoadError with field info for user config", async () => {
      writeUserConfig("tide.json", JSON.stringify({ agents: { bad: { model: "m", temperature: 5.0 } } }))
      const err = await loadConfig(PROJECT_DIR, USER_DIR).catch((e) => e)
      expect(err).toBeInstanceOf(ConfigLoadError)
      expect(err.message).toContain("temperature")
    })
  })
})
