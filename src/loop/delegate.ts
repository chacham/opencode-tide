import type { OpencodeClient } from "@opencode-ai/sdk"

const DEFAULT_POLL_INTERVAL_MS = 500
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

type RunDelegateInput = {
  client: OpencodeClient
  sessionID: string
  agent: string
  prompt: string
  pollIntervalMs?: number
  timeoutMs?: number
}

export async function runDelegate({
  client,
  sessionID,
  agent,
  prompt,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: RunDelegateInput): Promise<string> {
  let childID: string
  try {
    const created = await client.session.create({
      body: { parentID: sessionID },
    }) as unknown as { data: { id: string } }
    childID = created.data.id
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return `Failed to create delegate session: ${message}`
  }

  try {
    await client.session.promptAsync({
      path: { id: childID },
      body: {
        agent,
        parts: [{ type: "text", text: prompt }],
      },
    } as Parameters<typeof client.session.promptAsync>[0])
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return `Failed to start delegate session: ${message}`
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const statusRes = await (client.session.status as unknown as (opts: { path: { id: string } }) => Promise<{ data: Record<string, { type: string }> }>)({ path: { id: childID } })
    const status = (statusRes.data as Record<string, { type: string }>)[childID]
    if (status?.type === "idle") break
    if (pollIntervalMs > 0) await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  if (Date.now() >= deadline) {
    return `Delegate session timed out after ${timeoutMs}ms`
  }

  const messagesRes = await client.session.messages({ path: { id: childID } })
  const messages = (messagesRes.data ?? []) as Array<{
    info: { role: string }
    parts: Array<{ type: string; text?: string }>
  }>

  const lastAssistant = [...messages].reverse().find((m) => m.info.role === "assistant")
  if (!lastAssistant) return `Delegate session returned no response`

  const text = lastAssistant.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("")

  return text || `Delegate session returned no response`
}
