import { z } from "zod"

export const AgentConfigSchema = z.object({
  model: z.string(),
  prompt: z.string().optional(),
  description: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_steps: z.number().int().positive().optional(),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  color: z.string().optional(),
  disable: z.boolean().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
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
