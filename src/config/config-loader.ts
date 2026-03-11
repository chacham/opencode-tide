import { TideConfigSchema, type TideConfig } from "./schema"

const CONFIG_PATHS = [".opencode/tide.jsonc", ".opencode/tide.json"]

function stripJsonComments(src: string): string {
  return src
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

async function readConfigFile(dir: string): Promise<string | null> {
  for (const rel of CONFIG_PATHS) {
    const path = `${dir}/${rel}`
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

export async function loadConfig(dir: string): Promise<TideConfig> {
  const raw = await readConfigFile(dir)
  if (raw === null) return {}

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(raw))
  } catch (err) {
    throw new ConfigLoadError(`Failed to parse config file: ${err}`, err)
  }

  const result = TideConfigSchema.safeParse(parsed)
  if (!result.success) {
    throw new ConfigLoadError(
      `Invalid config: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      result.error,
    )
  }

  return result.data
}
