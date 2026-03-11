import { z } from "zod"

export const AgentConfigSchema = z.object({
  model: z.string(),
  prompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_steps: z.number().int().positive().optional(),
})

export const TideConfigSchema = z.object({
  $schema: z.string().optional(),
  agents: z.record(z.string(), AgentConfigSchema).optional(),
  orchestrator: z.string().optional(),
  loop: z
    .object({
      max_iterations: z.number().int().positive().optional(),
    })
    .optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>
export type TideConfig = z.infer<typeof TideConfigSchema>
