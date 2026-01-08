# Installation

Set up Wogi-Flow for a new project.

---

## Quick Install

```bash
./scripts/flow install
```

This interactive installer will:
1. Ask for project name and description
2. Create the `.workflow/` directory structure
3. Generate default `config.json`
4. Create template state files

---

## What Gets Created

```
.workflow/
├── config.json              # Configuration (200+ options)
├── specs/
│   └── project.md          # Project specification
├── state/
│   ├── ready.json          # Task queues
│   ├── app-map.md          # Component registry
│   ├── decisions.md        # Coding patterns
│   ├── request-log.md      # Change history
│   └── progress.md         # Session notes
├── .claude/skills/          # Skill packages (Claude Code 2.1+)
├── agents/                  # Agent personas
│   ├── orchestrator.md
│   ├── story-writer.md
│   ├── developer.md
│   ├── reviewer.md
│   └── tester.md
└── changes/                 # Feature change sets
```

---

## Installation Options

### Interactive Mode (Default)

```bash
./scripts/flow install
```

Prompts for:
- Project name
- Brief description
- Workflow style preference

### Quick Mode

```bash
./scripts/flow install --quick "my-project"
```

Creates workflow with minimal prompts using defaults.

### With PRD

If you have a Product Requirements Document:

```bash
./scripts/flow install
# Then during prompts, provide path to PRD
```

The PRD will be parsed and used to:
- Generate initial decisions
- Suggest component structure
- Create initial tasks

---

## Post-Installation

### 1. Review Config

Check `.workflow/config.json` and adjust settings:

```json
{
  "enforcement": {
    "strictMode": true,              // Require tasks for implementation
    "requireStoryForMediumTasks": true
  },
  "loops": {
    "enforced": true,                // Enable execution loops
    "maxRetries": 5
  }
}
```

### 2. Add to Git

```bash
git add .workflow/
git commit -m "feat: add wogi-flow workflow"
```

### 3. Verify Setup

```bash
/wogi-health
```

This checks:
- Required files exist
- Config is valid
- No obvious issues

---

## Default Configuration

The installer creates a balanced config:

| Setting | Default | Purpose |
|---------|---------|---------|
| `enforcement.strictMode` | `true` | Require tasks for implementation |
| `loops.enforced` | `true` | Enable self-completing loops |
| `loops.maxRetries` | `5` | Retry failed verifications |
| `durableSteps.enabled` | `true` | Enable crash recovery |
| `autoLog` | `true` | Auto-log changes |
| `autoUpdateAppMap` | `true` | Auto-update component registry |

---

## For Existing Projects

If you're adding Wogi-Flow to an existing project, use onboarding instead:

```bash
./scripts/flow onboard
```

This analyzes your codebase and populates state files automatically.

See [Onboarding Existing Projects](./onboarding-existing.md).

---

## Troubleshooting

### Permission Denied

```bash
chmod +x ./scripts/flow*
```

### Missing Dependencies

Ensure Node.js is installed:
```bash
node --version  # Should be 16+
```

### Config Validation Errors

Check JSON syntax:
```bash
node -e "JSON.parse(require('fs').readFileSync('.workflow/config.json'))"
```

---

## Related

- [Onboarding Existing Projects](./onboarding-existing.md)
- [Configuration Reference](../configuration/all-options.md)
- [Component Indexing](./component-indexing.md)
