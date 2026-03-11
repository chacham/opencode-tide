import { z } from "zod"

const PermissionAction = z.enum(["ask", "allow", "deny"])

const AgentConfigFieldsSchema = {
  prompt: z.string().optional(),
  description: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_steps: z.number().int().positive().optional(),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  color: z.string().optional(),
  disable: z.boolean().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  permission: z
    .object({
      edit: PermissionAction.optional(),
      bash: z.union([PermissionAction, z.record(z.string(), PermissionAction)]).optional(),
      webfetch: PermissionAction.optional(),
      doom_loop: PermissionAction.optional(),
      external_directory: PermissionAction.optional(),
    })
    .optional(),
}

export const AgentConfigSchema = z.object({
  model: z.string(),
  ...AgentConfigFieldsSchema,
})

export const BaseAgentConfigSchema = z.object({
  model: z.string().optional(),
  ...AgentConfigFieldsSchema,
})

export const TideConfigSchema = z.object({
  $schema: z.string().optional(),
  base: BaseAgentConfigSchema.optional(),
  agents: z.record(z.string(), BaseAgentConfigSchema).optional(),
  orchestrator: z.string().optional(),
  loop: z
    .object({
      max_iterations: z.number().int().positive().optional(),
    })
    .optional(),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>
export type BaseAgentConfig = z.infer<typeof BaseAgentConfigSchema>
export type TideConfig = z.infer<typeof TideConfigSchema>
