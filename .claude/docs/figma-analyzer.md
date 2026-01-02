# Figma Component Analyzer

Analyze Figma designs and match components against your existing codebase. Instead of generating all new code, it identifies what can be reused.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Figma     │ ──▶ │   Extract   │ ──▶ │    Match    │
│   Design    │     │  Components │     │  vs Codebase│
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────────────────┴────────────────────────┐
                    ▼                         ▼                        ▼
              ┌──────────┐             ┌──────────┐             ┌──────────┐
              │ 95%+ Use │             │ 60-95%   │             │ <60% New │
              │ Directly │             │ Variant? │             │Component │
              └──────────┘             └──────────┘             └──────────┘
```

1. **Scan codebase** - Build component registry
2. **Extract from Figma** - Parse Figma MCP response
3. **Match components** - Calculate similarity scores
4. **Confirm decisions** - Interactive or auto-confirm
5. **Generate code** - Prompts for Claude or imports

## Quick Start

```bash
# 1. Scan your codebase
./scripts/flow figma scan

# 2. Get Figma data via Figma MCP, save to file

# 3. Analyze and match
./scripts/flow figma analyze figma-data.json

# 4. Interactive confirmation
./scripts/flow figma confirm matches.json

# 5. Generate code
./scripts/flow figma generate
```

## Match Thresholds

| Score | Suggestion |
|-------|------------|
| 95%+ | Use directly |
| 80-95% | Use with minor adjustments |
| 60-80% | Consider as variant |
| <60% | Create new component |

## MCP Server

Start the MCP server for Claude Desktop or Cursor:

```bash
./scripts/flow figma server  # stdio mode (default)
./scripts/flow figma server 3847  # HTTP mode
```

Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "wogi-figma": {
      "command": "node",
      "args": ["/path/to/wogi-flow/scripts/flow-figma-mcp-server.js"]
    }
  }
}
```

## Setting Up Figma MCP

To fetch Figma designs:
1. Get a Personal Access Token from https://www.figma.com/developers/api#access-tokens
2. Add Figma MCP to your config:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-figma"],
      "env": {
        "FIGMA_PERSONAL_ACCESS_TOKEN": "your-token"
      }
    }
  }
}
```

## Configuration

In `config.json`:
```json
{
  "figmaAnalyzer": {
    "enabled": true,
    "thresholds": {
      "exactMatch": 95,
      "strongMatch": 80,
      "variantCandidate": 60
    },
    "componentDirs": ["src/components", "components"],
    "mcpServer": {
      "port": 3847,
      "autoStart": false
    }
  }
}
```

## Files Created

- `.workflow/state/component-registry.json` - Scanned components
- `.workflow/state/figma-decisions.json` - Confirmation decisions
- `.workflow/state/figma-output.json` - Generated output

See `skills/figma-analyzer/skill.md` for detailed documentation.
