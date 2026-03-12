# opencode-tide

Flexible multi-agent orchestration plugin for [OpenCode](https://opencode.ai).  
Bring your own models, roles, and prompts — no auto-selection, no magic defaults.

## What it does

- Registers named agents into OpenCode via `.opencode/tide.jsonc`
- Each agent gets an explicit model, optional system prompt, temperature, and step limit
- Agents not listed in config are simply not registered — nothing happens implicitly
- Orchestrator-driven loop via `session.idle` events — agents control iteration with `tide_loop_complete` / `tide_loop_status`

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
  "orchestrator": "orchestrator",

  "base": {
    // Shared defaults — inherited by all agents
    "temperature": 0.3,
    "max_steps": 40,
    "permission": {
      "bash": "ask",
      "edit": "allow"
    }
  },

  "agents": {
    // Plans tasks, delegates to sub-agents, synthesizes the final result
    "orchestrator": {
      "model": "github-copilot/gpt-4.1",
      "prompt": "You are a senior engineering orchestrator. Break down the user's request into concrete sub-tasks, delegate implementation to 'coder', quick tasks to 'runner', and review to 'reviewer' using tide_delegate, then synthesize the final result. Call tide_loop_complete when all tasks are done.",
      "temperature": 0.5
    },

    // Implements features, writes and edits code files
    "coder": {
      "model": "opencode/minimax-m2.5-free",
      "prompt": "You are a focused software engineer. Implement exactly what you are asked — no scope creep. Write clean, idiomatic code. When done, summarize what you changed.",
      "max_steps": 60
    },

    // Lightweight task runner for simple, well-defined sub-tasks
    "runner": {
      "model": "github-copilot/gpt-5-mini",
      "prompt": "You are an efficient task runner. Execute well-scoped, clearly defined tasks quickly. Focus on the exact request — no extra context, no explanations unless asked.",
      "max_steps": 20
    },

    // Reviews code and plans with chain-of-thought reasoning
    "reviewer": {
      "model": "opencode/big-pickle",
      "prompt": "You are a senior code reviewer with strong reasoning skills. Carefully analyze the provided code or plan for correctness, edge cases, security issues, and design flaws. Give concise, actionable feedback. Do not make edits.",
      "tools": {
        "edit_file": false,
        "bash": false
      }
    }
  },

  "loop": {
    "max_iterations": 15
  }
}
```

### Agent fields

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | yes | Model in `provider/model` format (e.g. `anthropic/claude-opus-4-5`, `openai/gpt-4o`) |
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

### Local development

OpenCode (which runs on Bun) can import `.ts` files directly, so no build step is needed during development.

Point the plugin at the source file in your OpenCode config:

```json
{
  "plugin": ["file:///path/to/opencode-tide/src/index.ts"]
}
```

After any code change, restart OpenCode to pick up the updated source.

## License

MIT

