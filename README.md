# Wogi Flow v1.5

A self-improving AI development workflow that learns from your feedback and accumulates knowledge over time.

## Key Features

| Feature                   | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Figma Analyzer**        | Match Figma designs against existing components - reuse before recreating                   |
| **Continual Learning**    | Skills automatically capture learnings from every session - knowledge persists and improves |
| **Hybrid Mode**           | Claude plans, local LLM executes - save 85-95% tokens                                       |
| **Self-Completing Tasks** | `/wogi-start` runs until truly done - no manual completion needed                           |
| **Autonomous Loops**      | `/wogi-loop` for ad-hoc work that continues until criteria are met                          |
| **Component Registry**    | Tracks all components to prevent duplication                                                |
| **Code Traces**           | Task-focused flow documentation with diagrams                                               |
| **Quality Gates**         | Configurable mandatory steps per task type                                                  |
| **Skills System**         | Modular add-ons for specific tech stacks with accumulated knowledge                         |
| **Profile Sharing**       | Export refined workflows for your team                                                      |

## Quick Start

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/Wogi-Git/wogi-flow/main/install.sh | bash

# Setup
./scripts/flow install

# Or quick setup with defaults
./scripts/flow install --quick my-project
```

For existing projects:

```bash
./scripts/flow onboard
```

## Developer Workflow

Daily commands for working with Wogi Flow. Start with `/wogi-ready` to see tasks, use `/wogi-start` to begin work, and `/wogi-session-end` to save progress.

```
# Session Init
/wogi-ready                    # Show available tasks
/wogi-status                   # Project overview
/wogi-context TASK-012         # Load task context

# Execution
/wogi-start TASK-012           # Start working on task
/wogi-loop "Migrate API"       # Run until done (for refactors)

# Backlog Management
/wogi-story "Add user avatar"  # Create task with acceptance criteria
/wogi-bug "Login fails"        # Report a bug
/wogi-feature user-settings    # Create feature with subtasks

# Pre-implementation Check
/wogi-map                      # Check existing components
/wogi-trace "auth flow"        # Analyze code flow
/wogi-deps TASK-015            # Show task dependencies

# Session Checkpoint
/wogi-session-end              # Save progress and commit

# Context Management (Critical)
/wogi-compact                  # Free up context (use after 2-3 tasks)

# Utilities
/wogi-health                   # Check workflow integrity
/wogi-search "#tag"            # Search request-log
/wogi-skills                   # List installed skills
```

## Table of Contents

- [Figma Component Analyzer](#figma-component-analyzer-new-in-v15)
- [Continual Learning Skills](#continual-learning-skills)
- [Hybrid Mode](#hybrid-mode)
- [Self-Completing Tasks](#self-completing-tasks)
- [Task Management](#task-management)
- [Component Registry](#component-registry)
- [Code Traces](#code-traces)
- [Skills System](#skills-system)
- [Configuration](#configuration)
- [CLI Reference](#cli-reference)
- [Slash Commands](#slash-commands)

---

## Figma Component Analyzer (New in v1.5)

Analyze Figma designs and match components against your existing codebase. Instead of generating all new code, it identifies what can be reused.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Figma     │ ──▶ │   Extract   │ ──▶ │    Match    │
│   Design    │     │  Components │     │  vs Codebase│
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
              ┌──────────┐              ┌──────────┐              ┌──────────┐
              │ 95%+ Use │              │ 60-95%   │              │ <60% New │
              │ Directly │              │ Variant? │              │Component │
              └──────────┘              └──────────┘              └──────────┘
```

### Quick Start

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

### Match Thresholds

| Score   | Suggestion                     |
| ------- | ------------------------------ |
| 95%+    | Use directly                   |
| 80-95%  | Use with minor adjustments     |
| 60-80%  | Consider as variant            |
| <60%    | Create new component           |

### MCP Server

Start the MCP server for Claude Desktop or Cursor:

```bash
./scripts/flow figma server        # stdio mode (default)
./scripts/flow figma server 3847   # HTTP mode on port 3847
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

### Commands

| Command                  | Description                    |
| ------------------------ | ------------------------------ |
| `flow figma scan`        | Scan codebase for components   |
| `flow figma show [name]` | Show component details         |
| `flow figma extract <f>` | Extract from Figma MCP data    |
| `flow figma match <f>`   | Match against registry         |
| `flow figma analyze <f>` | Extract + match (full pipeline)|
| `flow figma confirm <f>` | Interactive confirmation       |
| `flow figma generate`    | Generate code from decisions   |
| `flow figma server`      | Start MCP server               |

---

## Continual Learning Skills

Skills now automatically capture learnings from every session. Knowledge persists and improves over time without manual intervention.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTO-TRIGGER POINTS                       │
├─────────────────────────────────────────────────────────────┤
│  1. Pre-commit hook    → Captures learnings before commit   │
│  2. Task completion    → After quality gates pass           │
│  3. Session end        → When /wogi-session-end runs        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    SKILL KNOWLEDGE                           │
├─────────────────────────────────────────────────────────────┤
│  skills/[name]/knowledge/                                   │
│  ├── learnings.md      ← Session insights (auto-updated)   │
│  ├── patterns.md       ← What works                         │
│  └── anti-patterns.md  ← What to avoid                     │
└─────────────────────────────────────────────────────────────┘
```

### Skill Structure

```
skills/nestjs/
├── skill.md              # Core definition (always loaded)
├── knowledge/
│   ├── learnings.md      # Session learnings (auto-updated)
│   ├── patterns.md       # Proven patterns
│   └── anti-patterns.md  # Known mistakes to avoid
├── rules/
│   └── conventions.md    # Coding rules
├── commands/
│   └── *.md              # Slash commands
└── templates/
    └── *.template.*      # Code templates
```

### Commands

```bash
./scripts/flow skill-learn              # Manual extraction
./scripts/flow skill-learn --dry-run    # Preview changes
./scripts/flow skill-create <name>      # Create new skill
./scripts/flow skill-create --list      # List skills
```

### Configuration

```json
{
  "skillLearning": {
    "enabled": true,
    "autoExtract": true,
    "triggers": {
      "onCommit": true,
      "onTaskComplete": true,
      "onCompact": true
    },
    "autoCreateSkills": "ask"
  }
}
```

---

## Hybrid Mode

Save 85-95% of tokens by having Claude create execution plans that local LLMs execute.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Claude    │ ──▶ │    Plan     │ ──▶ │  Local LLM  │
│  (Planner)  │     │   (JSON)    │     │ (Executor)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                       │
       └──────▶ Escalation (if needed) ◀───────┘
```

### Setup

```bash
./scripts/flow hybrid enable   # Interactive setup
# or
/wogi-hybrid-setup            # Full setup via slash command
```

**Requirements:**

- [Ollama](https://ollama.ai/) or [LM Studio](https://lmstudio.ai/)
- Recommended: `nemotron-3-nano`, `qwen3-coder:30b`, or `deepseek-coder:33b`

### Token Savings

| Task Size         | Normal | Hybrid | Savings |
| ----------------- | ------ | ------ | ------- |
| Small (3 files)   | ~8K    | ~1.2K  | 85%     |
| Medium (8 files)  | ~20K   | ~1.8K  | 91%     |
| Large (15+ files) | ~45K   | ~2.5K  | 94%     |

### Commands

| Command                | Description              |
| ---------------------- | ------------------------ |
| `flow hybrid enable`   | Enable with setup wizard |
| `flow hybrid disable`  | Disable hybrid mode      |
| `flow hybrid status`   | Show configuration       |
| `flow hybrid rollback` | Undo last execution      |

---

## Self-Completing Tasks

When you run `/wogi-start TASK-XXX`, it runs a self-completing loop:

```
/wogi-start TASK-012
    ↓
Load context (story, app-map, decisions, skills)
    ↓
Decompose into TodoWrite checklist
    ↓
┌─────────────────────────────────────────┐
│ FOR EACH scenario:                      │
│   → Implement                           │
│   → Self-verify                         │
│   → Retry if broken                     │
│   → Mark completed                      │
└─────────────────────────────────────────┘
    ↓
Run quality gates → Update logs → Commit
```

**No need to run `/wogi-done`** - tasks complete themselves.

Options: `--no-loop`, `--pause-between`, `--max-retries N`

### Autonomous Loops

For ad-hoc work (refactors, migrations):

```bash
/wogi-loop "Migrate all fetch() to apiClient" --done-when "No fetch() calls remain"
```

Options: `--max-iterations N`, `--verify-command "cmd"`

---

## Task Management

### Creating Tasks

```bash
./scripts/flow story "Add login form"    # Detailed story with acceptance criteria
./scripts/flow new-feature auth          # Create feature structure
./scripts/flow bug "Login fails"         # Create bug report
```

### Task Workflow

```bash
./scripts/flow ready              # See what's ready to work on
./scripts/flow start TASK-001     # Start task (self-completing)
./scripts/flow status             # Project overview
./scripts/flow deps TASK-001      # Show dependencies
```

### Story Format

Stories are created with Given/When/Then acceptance criteria:

```markdown
# [TASK-012] Forgot Password Link

## User Story

**As a** user who forgot my password
**I want** to request a reset from login
**So that** I can regain access

## Acceptance Criteria

### Scenario 1: Navigate to reset

**Given** I am on login page
**When** I click "Forgot password?"
**Then** I navigate to /forgot-password
```

---

## Component Registry

Two-layer system prevents component duplication:

### 1. Curated `app-map.md`

Human-maintained with rich context:

```markdown
| Component | Variants           | Description        |
| --------- | ------------------ | ------------------ |
| Button    | primary, secondary | Main action button |
```

### 2. Auto-generated `component-index.json`

Machine-generated, always current:

```bash
./scripts/flow map-index scan   # Scan codebase
./scripts/flow map-sync         # Compare with app-map
```

---

## Code Traces

Generate task-focused documentation of code flows:

```bash
./scripts/flow trace "user authentication flow"
./scripts/flow trace "payment processing"
./scripts/flow trace list       # List saved traces
```

Traces include:

- High-level flow overview
- Execution steps with file/line references
- Mermaid diagrams
- Security/performance notes

---

## Skills System

Skills are modular add-ons for specific tech stacks that accumulate knowledge over time.

### Available Skills

| Skill    | Description              | Commands                                           |
| -------- | ------------------------ | -------------------------------------------------- |
| `nestjs` | NestJS module builder    | `/nestjs-scaffold`, `/nestjs-entity`, `/nestjs-db` |
| `react`  | React component patterns | `/react-component`, `/react-hook`                  |
| `python` | Python/FastAPI patterns  | `/python-endpoint`, `/python-test`                 |

### Install Skills

```bash
./scripts/flow install          # During setup
/wogi-skills add nestjs         # After setup
```

### Using Skills

When working on files that match a skill's patterns, Claude automatically:

1. Loads the skill's `knowledge/patterns.md`
2. Checks `knowledge/anti-patterns.md` to avoid mistakes
3. Updates learnings after task completion

---

## Configuration

### Main Config (`config.json`)

```json
{
  "mandatorySteps": {
    "afterTask": ["test", "lint"],
    "beforeCommit": ["review"],
    "onSessionEnd": ["updateRequestLog", "updateAppMap"]
  },
  "qualityGates": {
    "feature": { "require": ["tests", "appMapUpdate", "requestLogEntry"] },
    "bugfix": { "require": ["tests", "requestLogEntry"] }
  },
  "skillLearning": {
    "enabled": true,
    "autoExtract": true
  }
}
```

### Natural Language Config

Tell Claude what you want:

- "Always run tests after completing a task"
- "Require review before any commit"

Claude updates `config.json` accordingly.

### Optional Features

| Feature           | Enable                               |
| ----------------- | ------------------------------------ |
| Storybook stories | `/wogi-config storybook on`          |
| Pre-commit hooks  | `./scripts/flow setup-hooks install` |
| Phase planning    | Set `phases.enabled: true` in config |
| Strict mode       | Set `strictMode` options in config   |

---

## CLI Reference

```bash
# Setup
flow install                    # Interactive setup
flow install --quick <name>     # Quick setup
flow onboard                    # Onboard existing project
flow update                     # Update to latest version

# Tasks
flow ready                      # Show task queue
flow start <id>                 # Start task
flow done <id>                  # Complete task (usually not needed)
flow status                     # Project overview
flow deps <id>                  # Show dependencies

# Stories & Features
flow story "<title>"            # Create story
flow new-feature <name>         # Create feature
flow bug "<title>"              # Create bug report

# Components
flow update-map add <name> <path> [variants]
flow map-index scan             # Rescan codebase
flow map-sync                   # Compare index with app-map

# Code Traces
flow trace "<prompt>"           # Generate trace
flow trace list                 # List traces

# Skills
flow skill-learn                # Extract learnings
flow skill-create <name>        # Create skill
flow skill-create --list        # List skills

# Hybrid Mode
flow hybrid enable              # Enable with wizard
flow hybrid disable             # Disable
flow hybrid status              # Show config
flow hybrid rollback            # Undo last execution

# Figma Analyzer
flow figma scan                 # Scan codebase for components
flow figma show [name]          # Show component details
flow figma extract <file>       # Extract from Figma MCP data
flow figma match <file>         # Match against registry
flow figma analyze <file>       # Full pipeline (extract + match)
flow figma confirm <file>       # Interactive confirmation
flow figma generate             # Generate code from decisions
flow figma server               # Start MCP server

# Workflow
flow health                     # Check health
flow standup                    # Generate standup
flow session-end                # End session
flow search "<query>"           # Search logs
flow context <id>               # Load task context

# Team
flow export-profile <name>      # Export workflow
flow import-profile <file>      # Import workflow
flow changelog                  # Generate changelog

# Hooks
flow setup-hooks install        # Install git hooks
flow setup-hooks uninstall      # Remove hooks
```

---

## Slash Commands

Quick reference for chat commands:

| Category       | Commands                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Tasks**      | `/wogi-ready`, `/wogi-start`, `/wogi-loop`, `/wogi-done`, `/wogi-bulk`, `/wogi-status`, `/wogi-deps` |
| **Create**     | `/wogi-story`, `/wogi-feature`, `/wogi-bug`                                                          |
| **Components** | `/wogi-map`, `/wogi-map-add`, `/wogi-map-scan`, `/wogi-map-check`, `/wogi-map-sync`                  |
| **Figma**      | `flow figma scan`, `flow figma analyze`, `flow figma confirm`, `flow figma generate`, `flow figma server` |
| **Traces**     | `/wogi-trace`                                                                                        |
| **Skills**     | `/wogi-skills`, `/wogi-skill-learn`                                                                  |
| **Hybrid**     | `/wogi-hybrid-setup`, `/wogi-hybrid`, `/wogi-hybrid-off`, `/wogi-hybrid-status`                      |
| **Workflow**   | `/wogi-health`, `/wogi-standup`, `/wogi-session-end`, `/wogi-search`, `/wogi-context`                |
| **Config**     | `/wogi-config`                                                                                       |
| **Team**       | `/wogi-export`, `/wogi-import`, `/wogi-changelog`                                                    |
| **Help**       | `/wogi-help`                                                                                         |

---

## File Structure

```
.workflow/
├── config.json              # Workflow configuration
├── state/
│   ├── ready.json           # Task queue
│   ├── request-log.md       # Change history
│   ├── app-map.md           # Component registry (curated)
│   ├── component-index.json # Component index (auto-generated)
│   ├── decisions.md         # Project rules
│   ├── feedback-patterns.md # Learning tracker
│   ├── progress.md          # Session handoff notes
│   ├── component-registry.json  # Figma codebase scan
│   ├── figma-decisions.json     # Figma confirmations
│   └── figma-output.json        # Figma generated output
├── traces/                  # Code trace documents
└── tests/flows/             # Browser test flows

skills/
├── _template/               # Template for new skills
├── figma-analyzer/          # Figma design analyzer
├── nestjs/
│   ├── skill.md
│   ├── knowledge/           # Learnings, patterns, anti-patterns
│   ├── rules/
│   ├── commands/
│   └── templates/
└── ...

agents/                      # Agent personas
scripts/                     # CLI tools
templates/                   # File templates
CLAUDE.md                    # Main instructions
```

---

## Self-Improving Workflow

Wogi Flow learns from your corrections:

1. **Correction** → You correct Claude's work
2. **Fix** → Claude fixes immediately
3. **Learn** → Claude asks to persist the rule
4. **Update** → Updates decisions.md / agents/\*.md / config.json / skills
5. **Track** → Logs to feedback-patterns.md

After 3+ similar corrections → Claude suggests promoting to permanent instruction.

---

## Team Workflow

```bash
# One person refines the workflow
./scripts/flow export-profile "team-v1"

# Share team-v1.zip with team

# Others import
./scripts/flow import-profile team-v1.zip
```

---

## Changelog

### v1.5.0 - Figma Component Analyzer

- **Figma Component Analyzer**: Match Figma designs against existing codebase components
- **Multi-framework support**: React, Vue, Svelte, Angular auto-detection
- **Similarity matching**: Weighted scoring (CSS 35%, structure 25%, naming 20%, behavior 20%)
- **Interactive confirmation**: Choose to reuse, add variant, or create new
- **MCP Server**: Both stdio and HTTP modes for Claude Desktop/Cursor integration
- **New commands**: `flow figma [scan|show|extract|match|analyze|confirm|generate|server]`
- **New skill**: `skills/figma-analyzer/`

### v1.4.0 - Continual Learning Skills

- **Automatic skill learning**: Knowledge captured at pre-commit, task completion, session end
- **New skill structure**: `knowledge/` directory with learnings, patterns, anti-patterns
- **Agents use skills**: Developer agent loads relevant skill knowledge before tasks
- **New commands**: `flow skill-learn`, `flow skill-create`
- **New slash command**: `/wogi-skill-learn`
- **Config section**: `skillLearning` in config.json

### v1.3.0 - Hybrid Mode

- **Hybrid mode**: Claude plans, local LLM executes - 85-95% token savings
- **Supports**: Ollama and LM Studio
- **Features**: Rollback, escalation, template system
- **New commands**: `flow hybrid [enable|disable|status|rollback]`

### v1.2.0 - Self-Completing Loops

- **Self-completing `/wogi-start`**: Tasks run until truly done
- **New `/wogi-loop`**: Autonomous loops for ad-hoc work
- **Options**: `--no-loop`, `--pause-between`, `--max-retries`, `--done-when`

### v1.1.0 - Component Index & Code Traces

- **Hybrid component index**: Auto-generated + curated
- **Code traces**: Task-focused flow documentation with Mermaid diagrams
- **New commands**: `flow map-index`, `flow map-sync`, `flow trace`

### v1.0.0 - Initial Release

- Core workflow, task management, quality gates
- Component registry, request logging
- Self-improving feedback loop
- Skills system, profile sharing
- Browser testing, onboarding wizard

---

## License

MIT
