import type { Plugin } from "@opencode-ai/plugin"
import { loadConfig } from "./config/config-loader"
import { applyAgentsToConfig } from "./plugin/apply-agents"

const TidePlugin: Plugin = async (ctx) => {
  const tideConfig = await loadConfig(ctx.directory)

  return {
    config: async (opencodeConfig) => {
      applyAgentsToConfig(tideConfig, opencodeConfig)
    },
  }
}

export default TidePlugin
export type { TideConfig, AgentConfig } from "./config/schema"
