import type { Config } from "@opencode-ai/sdk"
import type { TideConfig } from "../config/schema"

export function applyAgentsToConfig(tideConfig: TideConfig, opencodeConfig: Config): void {
  if (!tideConfig.agents) return

  for (const [name, agent] of Object.entries(tideConfig.agents)) {
    opencodeConfig.agent ??= {}
    opencodeConfig.agent[name] = {
      model: agent.model,
      ...(agent.prompt !== undefined && { prompt: agent.prompt }),
      ...(agent.description !== undefined && { description: agent.description }),
      ...(agent.temperature !== undefined && { temperature: agent.temperature }),
      ...(agent.top_p !== undefined && { top_p: agent.top_p }),
      ...(agent.max_steps !== undefined && { maxSteps: agent.max_steps }),
      ...(agent.mode !== undefined && { mode: agent.mode }),
      ...(agent.color !== undefined && { color: agent.color }),
      ...(agent.disable !== undefined && { disable: agent.disable }),
      ...(agent.tools !== undefined && { tools: agent.tools }),
      ...(agent.permission !== undefined && { permission: agent.permission }),
    }
  }
}
