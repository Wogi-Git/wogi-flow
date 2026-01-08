# Development Tools

Features that accelerate specific development workflows.

---

## Overview

These tools speed up common tasks:
- Design-to-code with Figma
- Understanding codebases with traces
- Step-by-step multi-file editing
- Voice-driven development
- MCP server integrations

---

## Features

| Feature | Purpose |
|---------|---------|
| [Figma Analyzer](./figma-analyzer.md) | Design-to-code component matching |
| [Code Traces](./code-traces.md) | Understand code flow for features |
| [Guided Edit](./guided-edit.md) | Step-by-step multi-file changes |
| [Voice Input](./voice-input.md) | Voice-driven commands |
| [MCP Integrations](./mcp-integrations.md) | External tool connections |

---

## Quick Start

### Figma Analysis

```bash
/wogi-figma analyze LoginScreen
```

### Code Trace

```bash
/wogi-trace "user authentication flow"
```

### Guided Edit

```bash
/wogi-guided-edit "rename Button to BaseButton"
```

### Voice Input

```bash
/wogi-voice
# Speak your command
```

---

## Key Configuration

```json
{
  "figmaAnalyzer": {
    "enabled": true,
    "thresholds": {
      "exactMatch": 95,
      "strongMatch": 80
    }
  },
  "traces": {
    "saveTo": ".workflow/traces",
    "generateDiagrams": true
  },
  "voice": {
    "enabled": false,
    "provider": null
  }
}
```

---

## Integration Points

These tools integrate with:
- Task execution (auto-context)
- Component indexing
- App-map registry
- Hybrid mode

---

## Related

- [Task Execution](../02-task-execution/) - Core workflow
- [Setup](../01-setup-onboarding/) - Component indexing
- [Configuration](../configuration/all-options.md) - All settings
