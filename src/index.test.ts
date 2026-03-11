import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import type { Config, Event } from "@opencode-ai/sdk"
import type { PluginInput } from "@opencode-ai/plugin"

const TMP = join(import.meta.dir, "__tmp__plugin__")
const OPENCODE_DIR = join(TMP, ".opencode")

function writeConfig(content: string) {
  writeFileSync(join(OPENCODE_DIR, "tide.json"), content, "utf-8")
}

function makeClient(promptAsync = mock(async () => {})) {
  return {
    session: { promptAsync },
  }
}

function makeCtx(dir: string, client = makeClient()): PluginInput {
  return { directory: dir, client } as unknown as PluginInput
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

  describe("#event hook", () => {
    test("registers event hook", async () => {
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      expect(typeof hooks.event).toBe("function")
    })

    test("event hook does nothing for non-idle events", async () => {
      const promptAsync = mock(async () => {})
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP, makeClient(promptAsync)))
      const event = { type: "session.started", properties: { sessionID: "s1" } } as unknown as Event
      await hooks.event!({ event })
      expect(promptAsync).not.toHaveBeenCalled()
    })

    test("event hook does nothing for session.idle when session not in loop", async () => {
      const promptAsync = mock(async () => {})
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP, makeClient(promptAsync)))
      const event = { type: "session.idle", properties: { sessionID: "s-not-tracked" } } as unknown as Event
      await hooks.event!({ event })
      expect(promptAsync).not.toHaveBeenCalled()
    })
  })

  describe("#tool hook", () => {
    test("registers tool hook with tide_loop_complete and tide_loop_status", async () => {
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      expect(hooks.tool).toBeDefined()
      expect(hooks.tool).toHaveProperty("tide_loop_complete")
      expect(hooks.tool).toHaveProperty("tide_loop_status")
    })
  })

  describe("#experimental.chat.system.transform hook", () => {
    test("registers experimental.chat.system.transform hook", async () => {
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      expect(typeof hooks["experimental.chat.system.transform"]).toBe("function")
    })

    test("transform hook does not modify system for untracked session", async () => {
      const { default: TidePlugin } = await import("./index")
      const hooks = await TidePlugin(makeCtx(TMP))
      const output = { system: ["base"] }
      await hooks["experimental.chat.system.transform"]!(
        { sessionID: "unknown-session", model: "claude-opus-4-5" as never },
        output,
      )
      expect(output.system.length).toBe(1)
    })
  })
})
