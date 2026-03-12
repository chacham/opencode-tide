import { TideConfigSchema, type TideConfig } from "./schema"

const CONFIG_FILENAMES = ["tide.jsonc", "tide.json"]

function stripJsonComments(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

async function readConfigFile(dir: string): Promise<string | null> {
  for (const name of CONFIG_FILENAMES) {
    const path = `${dir}/${name}`
    const file = Bun.file(path)
    if (await file.exists()) {
      return file.text()
    }
  }
  return null
}

export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = "ConfigLoadError"
  }
}

async function parseConfig(raw: string, label: string): Promise<TideConfig> {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(raw))
  } catch (err) {
    throw new ConfigLoadError(`Failed to parse ${label} config file: ${err}`, err)
  }

  const result = TideConfigSchema.safeParse(parsed)
  if (!result.success) {
    throw new ConfigLoadError(
      `Invalid ${label} config: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      result.error,
    )
  }

  return result.data
}

function mergeConfigs(user: TideConfig, project: TideConfig): TideConfig {
  return {
    ...(user.$schema !== undefined || project.$schema !== undefined
      ? { $schema: project.$schema ?? user.$schema }
      : {}),
    ...(user.orchestrator !== undefined || project.orchestrator !== undefined
      ? { orchestrator: project.orchestrator ?? user.orchestrator }
      : {}),
    ...(user.base !== undefined || project.base !== undefined
      ? { base: { ...user.base, ...project.base } }
      : {}),
    ...(user.agents !== undefined || project.agents !== undefined
      ? { agents: { ...user.agents, ...project.agents } }
      : {}),
    ...(user.loop !== undefined || project.loop !== undefined
      ? { loop: { ...user.loop, ...project.loop } }
      : {}),
  }
}

export async function loadConfig(projectDir: string, userConfigDir?: string): Promise<TideConfig> {
  const projectRaw = await readConfigFile(`${projectDir}/.opencode`)
  const userRaw = userConfigDir ? await readConfigFile(userConfigDir) : null

  if (projectRaw === null && userRaw === null) return {}

  const projectConfig = projectRaw ? await parseConfig(projectRaw, "project") : {}
  const userConfig = userRaw ? await parseConfig(userRaw, "user") : {}

  if (projectRaw === null) return userConfig
  if (userRaw === null) return projectConfig

  return mergeConfigs(userConfig, projectConfig)
}
