import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import type { Config } from "@opencode-ai/sdk"
import type { PluginInput } from "@opencode-ai/plugin"

const TMP = join(import.meta.dir, "__tmp__plugin__")
const OPENCODE_DIR = join(TMP, ".opencode")

function writeConfig(content: string) {
  writeFileSync(join(OPENCODE_DIR, "tide.json"), content, "utf-8")
}

function makeCtx(dir: string): PluginInput {
  return { directory: dir } as unknown as PluginInput
}

beforeEach(() => {
  mkdirSync(OPENCODE_DIR, { recursive: true })
})

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
})

describe("TidePlugin", () => {
  describe("#when no config", () => {
    test("returns plugin without error", async () => {
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      expect(hooks).toBeDefined()
      expect(typeof hooks.config).toBe("function")
    })

    test("config hook does not modify opencodeConfig when no agents defined", async () => {
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      const cfg: Config = {}
      await hooks.config!(cfg)
      expect(cfg.agent).toBeUndefined()
    })
  })

  describe("#when agents are configured", () => {
    test("config hook registers agents into opencodeConfig", async () => {
      writeConfig(
        JSON.stringify({
          orchestrator: "main",
          agents: {
            main: { model: "claude-opus-4-5", prompt: "You orchestrate." },
            worker: { model: "gpt-4o", temperature: 0.3 },
          },
        }),
      )
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      const cfg: Config = {}
      await hooks.config!(cfg)

      expect(cfg.agent?.main?.model).toBe("claude-opus-4-5")
      expect(cfg.agent?.main?.prompt).toBe("You orchestrate.")
      expect(cfg.agent?.worker?.model).toBe("gpt-4o")
      expect(cfg.agent?.worker?.temperature).toBe(0.3)
    })

    test("config hook merges into existing opencodeConfig agents", async () => {
      writeConfig(JSON.stringify({ agents: { tide: { model: "gemini-pro" } } }))
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      const cfg: Config = { agent: { build: { model: "existing" } } }
      await hooks.config!(cfg)

      expect(cfg.agent?.build?.model).toBe("existing")
      expect(cfg.agent?.tide?.model).toBe("gemini-pro")
    })
  })
})
