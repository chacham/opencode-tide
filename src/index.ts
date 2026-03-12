import type { Plugin } from "@opencode-ai/plugin"
import { loadConfig } from "./config/config-loader"
import { applyAgentsToConfig } from "./plugin/apply-agents"
import { LoopState } from "./loop/loop-state"
import { handleSessionEvent } from "./loop/event-handler"
import { createSystemTransformHook } from "./loop/system-prompt"
import { createLoopTools } from "./loop/tools"

const TidePlugin: Plugin = async (ctx) => {
  const tideConfig = await loadConfig(ctx.directory)
  const loopState = new LoopState({ maxIterations: tideConfig.loop?.max_iterations })

  return {
    config: async (opencodeConfig) => {
      applyAgentsToConfig(tideConfig, opencodeConfig)
    },

    event: async ({ event }) => {
      await handleSessionEvent({ event, loopState, client: ctx.client })
    },

    tool: createLoopTools({ loopState, client: ctx.client }),

    "experimental.chat.system.transform": createSystemTransformHook(loopState),
  }
}

export default TidePlugin
export type { TideConfig, AgentConfig } from "./config/schema"
