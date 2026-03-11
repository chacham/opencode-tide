# opencode-tide

Flexible multi-agent orchestration plugin for [OpenCode](https://opencode.ai).  
Bring your own models, roles, and prompts — no auto-selection, no magic defaults.

## What it does

- Registers named agents into OpenCode via `.opencode/tide.jsonc`
- Each agent gets an explicit model, optional system prompt, temperature, and step limit
- Agents not listed in config are simply not registered — nothing happens implicitly
- Designed to support orchestrator-driven parallel loops (in progress)

## Installation

```bash
bun add opencode-tide
```

Then register the plugin in your OpenCode config (`~/.config/opencode/opencode.json` or `.opencode/opencode.json`):

```json
{
  "plugin": ["opencode-tide"]
}
```

## Configuration

Create `.opencode/tide.jsonc` in your project root:

```jsonc
{
  // Name of the agent that acts as the orchestrator
  "orchestrator": "main",

  "agents": {
    "main": {
      "model": "claude-opus-4-5",
      "prompt": "You are the orchestrator. Plan tasks and delegate to workers.",
      "temperature": 0.5
    },
    "worker": {
      "model": "gpt-4o",
      "temperature": 0.3,
      "max_steps": 30
    },
    "researcher": {
      "model": "gemini-2.0-flash"
    }
  },

  "loop": {
    "max_iterations": 20
  }
}
```

### Agent fields

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | yes | Model ID as recognized by OpenCode (e.g. `claude-opus-4-5`, `gpt-4o`) |
| `prompt` | `string` | no | System prompt for the agent |
| `temperature` | `number` 0–2 | no | Sampling temperature |
| `max_steps` | `integer` > 0 | no | Max agentic iterations before forcing a text-only response |

### Top-level fields

| Field | Type | Description |
|---|---|---|
| `orchestrator` | `string` | Name of the agent that drives the main loop |
| `agents` | `Record<string, AgentConfig>` | Map of agent name → config |
| `loop.max_iterations` | `integer` > 0 | Global cap on orchestration loop cycles |

Omitting any agent means it is not registered. Omitting the entire `agents` field is valid — the plugin loads without registering anything.

## Development

```bash
bun install
bun test         # run all tests
bun run typecheck
bun run build
```

## License

MIT

