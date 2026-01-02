# Hybrid Mode (Claude Plans, Local LLM Executes)

Hybrid mode saves 85-95% of tokens by having Claude create execution plans that are executed by a local LLM (Ollama or LM Studio).

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │ ──▶ │    Plan     │ ──▶ │  Local LLM  │
│  (Planner)  │     │   (JSON)    │     │ (Executor)  │
└─────────────┘     └─────────────┘     └─────────────┘
     │                                        │
     │         ┌─────────────────┐           │
     └────────▶│   Escalation    │◀──────────┘
               │  (if needed)    │
               └─────────────────┘
```

1. You give Claude a task
2. Claude creates a detailed plan with templates
3. You review and approve (or modify/cancel)
4. Local LLM executes each step
5. Claude handles any failures (escalation)

## Enable Hybrid Mode

```bash
./scripts/flow hybrid enable
# or use slash command:
/wogi-hybrid
```

The setup wizard:
1. Detects available providers (Ollama, LM Studio)
2. Lists available models
3. Tests the connection
4. Saves configuration

## Recommended Models

- **NVIDIA Nemotron 3 Nano** - Best instruction following
- **Qwen3-Coder 30B** - Best code quality
- **DeepSeek Coder** - Good balance

## Token Savings

| Task Size | Normal Mode | Hybrid Mode | Savings |
|-----------|-------------|-------------|---------|
| Small (3 files) | ~8,000 | ~1,200 | 85% |
| Medium (8 files) | ~20,000 | ~1,800 | 91% |
| Large (15+ files) | ~45,000 | ~2,500 | 94% |

## Configuration

In `config.json`:
```json
{
  "hybrid": {
    "enabled": true,
    "provider": "ollama",
    "providerEndpoint": "http://localhost:11434",
    "model": "nemotron-3-nano",
    "settings": {
      "temperature": 0.7,
      "maxTokens": 4096,
      "maxRetries": 2,
      "timeout": 120000,
      "autoExecute": false
    }
  }
}
```

## Templates

Hybrid mode uses templates in `templates/hybrid/` to guide the local LLM:
- `_base.md` - Universal rules
- `_patterns.md` - Project-specific patterns (auto-generated)
- `create-component.md` - Component creation
- `create-hook.md` - Hook creation
- `create-service.md` - Service creation
- `modify-file.md` - File modification
- `fix-bug.md` - Bug fixing

Generate project-specific templates:
```bash
./scripts/flow templates generate
```

## Rollback

If execution fails or produces unwanted results:
```bash
./scripts/flow hybrid rollback
```

This removes created files and restores modified files.
