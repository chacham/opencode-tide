import type { Config } from "@opencode-ai/sdk"
import type { BaseAgentConfig, TideConfig } from "../config/schema"

export function applyAgentsToConfig(tideConfig: TideConfig, opencodeConfig: Config): void {
  if (!tideConfig.agents) return

  const base = tideConfig.base

  for (const [name, agent] of Object.entries(tideConfig.agents)) {
    const merged: BaseAgentConfig = { ...base, ...agent }

    if (!merged.model) continue

    opencodeConfig.agent ??= {}
    opencodeConfig.agent[name] = {
      model: merged.model,
      ...(merged.prompt !== undefined && { prompt: merged.prompt }),
      ...(merged.description !== undefined && { description: merged.description }),
      ...(merged.temperature !== undefined && { temperature: merged.temperature }),
      ...(merged.top_p !== undefined && { top_p: merged.top_p }),
      ...(merged.max_steps !== undefined && { maxSteps: merged.max_steps }),
      ...(merged.mode !== undefined && { mode: merged.mode }),
      ...(merged.color !== undefined && { color: merged.color }),
      ...(merged.disable !== undefined && { disable: merged.disable }),
      ...(merged.tools !== undefined && { tools: merged.tools }),
      ...(merged.permission !== undefined && { permission: merged.permission }),
    }
  }
}
