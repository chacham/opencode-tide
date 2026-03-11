import type { Config } from "@opencode-ai/sdk"
import type { TideConfig } from "../config/schema"

export function applyAgentsToConfig(tideConfig: TideConfig, opencodeConfig: Config): void {
  if (!tideConfig.agents) return

  for (const [name, agent] of Object.entries(tideConfig.agents)) {
    opencodeConfig.agent ??= {}
    opencodeConfig.agent[name] = {
      model: agent.model,
      ...(agent.prompt !== undefined && { prompt: agent.prompt }),
      ...(agent.temperature !== undefined && { temperature: agent.temperature }),
      ...(agent.max_steps !== undefined && { maxSteps: agent.max_steps }),
    }
  }
}
