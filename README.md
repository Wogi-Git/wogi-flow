# Wogi Flow v1.8

A self-improving AI development workflow that learns from your feedback and accumulates knowledge over time.

## Key Features

| Feature                   | Description                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Pattern Enforcement**   | Active pattern injection from decisions.md/app-map.md into prompts with citation validation |
| **Loop Enforcement**      | "Ralph Wiggum mode" - blocks exit until all acceptance criteria pass                        |
| **Parallel Auto-Detect**  | Automatically detects and suggests parallel task execution                                  |
| **Skill Auto-Creation**   | Detects frameworks and generates skills from official documentation                         |
| **Project-Based Sync**    | Team sync at project scope - decisions.md, app-map.md, skills shared across team            |
| **Safety Guardrails**     | Bounded execution with file/command permissions and checkpoint intervals                    |
| **Verification Gates**    | Structured gate results with auto-feed stderr for LLM self-healing                          |
| **Execution Traces**      | JSONL event logging with artifact timeline for full run history                             |
| **Diff-First Output**     | Preview changes before applying - unified diff with colored terminal display                |
| **Cloud Providers**       | Unified interface for Anthropic, OpenAI, Ollama, and LM Studio                              |
| **Declarative Workflows** | YAML-based workflows with conditional routing and bounded loops                             |
| **Figma Analyzer**        | Match Figma designs against existing components - reuse before recreating                   |
| **Continual Learning**    | Skills automatically capture learnings from every session - knowledge persists and improves |
| **Hybrid Mode**           | Claude plans, local LLM executes - save 85-95% tokens                                       |
| **Self-Completing Tasks** | `/wogi-start` runs until truly done - no manual completion needed                           |
| **Ad-Hoc Task Handling**  | Ad-hoc requests get the same rigor as structured tasks (clarify → execute → verify)         |
| **Component Registry**    | Tracks all components to prevent duplication                                                |
| **Code Traces**           | Task-focused flow documentation with diagrams                                               |
| **Quality Gates**         | Configurable mandatory steps per task type                                                  |
| **Skills System**         | Modular add-ons for specific tech stacks with accumulated knowledge                         |
| **Profile Sharing**       | Export refined workflows for your team                                                      |
| **Team Backend**          | AWS-powered team sync: shared memory, proposals, activity logging                           |

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
/wogi-start TASK-012           # Start working on task (self-completing)

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
/compact                       # Free up context (built-in, use after 2-3 tasks)

# Utilities
/wogi-health                   # Check workflow integrity
/wogi-search "#tag"            # Search request-log
/wogi-skills                   # List installed skills
```

## Table of Contents

- [Pattern Enforcement (New in v1.8)](#pattern-enforcement-new-in-v18)
- [Loop Enforcement (New in v1.8)](#loop-enforcement-new-in-v18)
- [Parallel Auto-Detection (New in v1.8)](#parallel-auto-detection-new-in-v18)
- [Skill Auto-Creation (New in v1.8)](#skill-auto-creation-new-in-v18)
- [Project-Based Team Sync (New in v1.8)](#project-based-team-sync-new-in-v18)
- [Safety & Verification](#safety--verification)
- [Execution Traces & Checkpoints](#execution-traces--checkpoints)
- [Diff-First Output](#diff-first-output)
- [Cloud Model Providers](#cloud-model-providers)
- [Declarative Workflows](#declarative-workflows)
- [External Context Protocol](#external-context-protocol)
- [Figma Component Analyzer](#figma-component-analyzer)
- [Continual Learning Skills](#continual-learning-skills)
- [Hybrid Mode](#hybrid-mode)
- [Self-Completing Tasks](#self-completing-tasks)
- [Task Management](#task-management)
- [Component Registry](#component-registry)
- [Code Traces](#code-traces)
- [Skills System](#skills-system)
- [Team Backend](#team-backend)
- [Configuration](#configuration)
- [CLI Reference](#cli-reference)
- [Slash Commands](#slash-commands)

---

## Pattern Enforcement (New in v1.8)

Active pattern injection ensures the AI uses your established patterns from `decisions.md` and `app-map.md`.

### How It Works

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│ decisions.md│ ──▶ │ Extract Patterns│ ──▶ │  Inject to  │
│  app-map.md │     │  & Components   │     │   Prompt    │
└─────────────┘     └─────────────────┘     └─────────────┘
                                                   │
                                                   ▼
                                            ┌─────────────┐
                                            │   Validate  │
                                            │  Citations  │
                                            └─────────────┘
```

### Configuration

```json
{
  "enforcement": {
    "requirePatternCitation": true,
    "citationFormat": "// Pattern: {pattern}"
  }
}
```

### Commands

```bash
./scripts/flow pattern status      # Show active patterns
./scripts/flow pattern inject      # Preview injected context
./scripts/flow pattern validate    # Check citation compliance
```

When enabled, the AI must cite patterns from `decisions.md` when applying them:

```javascript
// Pattern: Helper functions in src/utils/helpers/
export function formatDate(date) { ... }
```

---

## Loop Enforcement (New in v1.8)

"Ralph Wiggum Mode" - prevents exiting tasks until all acceptance criteria pass.

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Start     │ ──▶ │ Acceptance  │ ──▶ │  Verify     │
│   Task      │     │   Criteria  │     │   Each      │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          ▼                    ▼                    ▼
                    ┌──────────┐         ┌──────────┐         ┌──────────┐
                    │  ✅ Pass  │         │  ❌ Fail  │         │  ⏭ Skip  │
                    │  → Next  │         │  → Retry │         │→ Approval│
                    └──────────┘         └──────────┘         └──────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| **requireVerification** | Must verify each criterion before marking complete |
| **blockOnSkip** | Cannot skip criteria without explicit approval |
| **blockExitUntilComplete** | Cannot exit loop until all criteria pass or max retries |
| **maxIterations** | Safety limit to prevent infinite loops |

### Configuration

```json
{
  "loops": {
    "enabled": true,
    "enforced": true,
    "requireVerification": true,
    "blockOnSkip": true,
    "blockExitUntilComplete": true,
    "maxRetries": 5,
    "maxIterations": 20
  }
}
```

### Commands

```bash
./scripts/flow loop status        # Show active loop session
./scripts/flow loop stats         # Show loop statistics
./scripts/flow loop can-exit      # Check if exit is allowed
./scripts/flow loop enable        # Enable enforcement
./scripts/flow loop disable       # Disable enforcement
```

---

## Parallel Auto-Detection (New in v1.8)

Automatically detects when tasks can run in parallel and suggests optimal execution.

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Tasks     │ ──▶ │  Analyze    │ ──▶ │  Suggest    │
│   Queue     │     │Dependencies │     │  Parallel   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    ▼                     ▼
                              ┌──────────┐          ┌──────────┐
                              │ Execute  │          │  User    │
                              │Parallel  │          │ Approval │
                              └──────────┘          └──────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| **autoDetect** | Automatically analyze tasks for parallel potential |
| **autoSuggest** | Show recommendation when parallel execution is possible |
| **autoExecute** | Execute in parallel automatically (no approval needed) |
| **minTasksForParallel** | Minimum task count to trigger detection |

### Configuration

```json
{
  "parallel": {
    "enabled": true,
    "autoDetect": true,
    "autoSuggest": true,
    "autoExecute": false,
    "minTasksForParallel": 2,
    "maxConcurrent": 3
  }
}
```

### Commands

```bash
./scripts/flow parallel analyze   # Analyze pending tasks
./scripts/flow parallel suggest   # Check if suggestion is available
./scripts/flow parallel config    # Show configuration
./scripts/flow parallel enable    # Enable parallel execution
./scripts/flow parallel disable   # Disable parallel execution
```

### Example Output

```
╔══════════════════════════════════════════════════════╗
║         🔀 PARALLEL EXECUTION AVAILABLE              ║
╠══════════════════════════════════════════════════════╣
║  3 of 5 tasks can run in parallel                    ║
║  Estimated time savings: ~60%                        ║
╠══════════════════════════════════════════════════════╣
║  Parallelizable tasks:                               ║
║    • TASK-012: Add forgot password link              ║
║    • TASK-015: User profile page                     ║
║    • TASK-018: Settings modal                        ║
╚══════════════════════════════════════════════════════╝
```

---

## Skill Auto-Creation (New in v1.8)

Automatically detects frameworks in your project and generates skills from official documentation.

### How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ package.json│ ──▶ │   Detect    │ ──▶ │   Fetch     │
│  + Files    │     │ Frameworks  │     │ Official Doc│
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                         ┌──────────┐
                                         │ Generate │
                                         │  Skill   │
                                         └──────────┘
```

### Detected Frameworks

| Framework | Detection Patterns |
|-----------|-------------------|
| NestJS | `*.module.ts`, `*.controller.ts`, `@nestjs/*` |
| React | `*.tsx`, `*.jsx`, `use*.ts`, `react` |
| Vue | `*.vue`, `vue`, `@vue/*` |
| Angular | `*.component.ts`, `@angular/*` |
| FastAPI | `main.py`, `fastapi`, `pydantic` |
| Django | `manage.py`, `django`, `settings.py` |
| Express | `app.js`, `express`, `router.js` |

### Configuration

```json
{
  "skillLearning": {
    "autoDetectFrameworks": true,
    "fetchOfficialDocs": true,
    "autoCreateSkills": "ask",
    "frameworkDetectionPatterns": { ... },
    "officialDocsUrls": {
      "nestjs": "https://docs.nestjs.com",
      "react": "https://react.dev",
      ...
    }
  }
}
```

### Commands

```bash
./scripts/flow skill detect       # Detect frameworks
./scripts/flow skill list         # List installed skills
./scripts/flow skill create <name># Create new skill
./scripts/flow skill-learn        # Extract learnings
```

---

## Project-Based Team Sync (New in v1.8)

Sync workflow files at project scope - share decisions, patterns, and knowledge across your team.

### What Gets Synced

| Resource | Description | Sync Mode |
|----------|-------------|-----------|
| `decisions.md` | Coding rules and patterns | Full sync |
| `app-map.md` | Component registry | Full sync |
| `component-index.json` | Auto-generated index | Full sync |
| `skills/*/knowledge/` | Skill learnings | Full sync |
| Memory facts | Local database facts | Export to JSON |
| `request-log.md` | Activity history | Recent entries only |
| Tasks | Task queue | Optional |

### Configuration

```json
{
  "team": {
    "enabled": true,
    "projectScope": true,
    "conflictResolution": "newest-wins",
    "sync": {
      "decisions": true,
      "appMap": true,
      "componentIndex": true,
      "skills": true,
      "memory": true,
      "requestLog": "recent",
      "tasks": false
    }
  }
}
```

### Conflict Resolution Strategies

| Strategy | Description |
|----------|-------------|
| `newest-wins` | Latest change wins (default) |
| `remote-wins` | Server version always wins |
| `local-wins` | Local version always wins |
| `merge` | Attempt to merge changes |

### Commands

```bash
./scripts/flow team sync-status   # Show sync status
./scripts/flow team sync-init     # Initialize project sync
./scripts/flow team project-id    # Show/set project ID
./scripts/flow team sync          # Sync local → remote
```

---

## Safety & Verification

Enterprise-grade safety guardrails and verification gates for reliable AI-assisted development.

### Safety Guardrails

Prevent unintended operations with bounded execution limits:

```bash
./scripts/flow safety status    # Show current limits
./scripts/flow safety check-file src/app.ts
./scripts/flow safety check-command "npm test"
```

**Default Limits:**
| Limit | Default | Description |
|-------|---------|-------------|
| `maxSteps` | 50 | Maximum execution steps |
| `maxFilesModified` | 20 | Files that can be modified |
| `maxFilesCreated` | 10 | New files that can be created |
| `maxFilesDeleted` | 5 | Files that can be deleted |
| `checkpointInterval` | 5 | Auto-checkpoint every N steps |

**Permission Model:**
```json
{
  "safety": {
    "enabled": true,
    "permissions": {
      "files": {
        "allow": ["src/**", "tests/**", "*.json"],
        "deny": ["**/.env", "**/secrets/**", "**/*.key"]
      },
      "commands": {
        "allow": ["npm", "node", "git", "eslint"],
        "deny": ["rm -rf", "sudo", "curl", "wget"]
      }
    }
  }
}
```

### Verification Gates

Structured verification with auto-feed stderr for LLM self-healing:

```bash
./scripts/flow verify lint         # Run linting gate
./scripts/flow verify typecheck    # Run TypeScript check
./scripts/flow verify all          # Run all gates
./scripts/flow verify --json       # JSON output for CI
./scripts/flow verify --llm-context  # LLM-friendly error output
```

**Available Gates:**
| Gate | Tool | Description |
|------|------|-------------|
| `lint` | ESLint/Biome | Code linting |
| `typecheck` | TypeScript | Type checking |
| `test` | Jest/Vitest | Test suite |
| `build` | npm | Build process |
| `format` | Prettier/Biome | Code formatting |

**Exit Codes:**
- `0` - Success
- `1` - General failure
- `2` - Configuration error
- `5` - Safety violation

---

## Execution Traces & Checkpoints

Full run history with JSONL event logging and automatic checkpoints.

### Run Traces

```bash
./scripts/flow run-trace start "Implement login"  # Start traced run
./scripts/flow run-trace end                       # End current run
./scripts/flow history                             # List recent runs
./scripts/flow inspect <run-id>                    # Show run details
./scripts/flow run-trace cleanup                   # Remove old runs
```

**Event Types:**
- `RUN_START`, `RUN_END` - Run lifecycle
- `STEP_START`, `STEP_END` - Individual steps
- `FILE_WRITE`, `FILE_DELETE` - File operations
- `COMMAND_RUN` - Shell commands
- `VALIDATION_PASS`, `VALIDATION_FAIL` - Gate results
- `CHECKPOINT` - Automatic checkpoints
- `ERROR`, `WARNING` - Issues

### Auto-Checkpoints

Periodic state snapshots with rollback support:

```bash
./scripts/flow checkpoint create "Before refactor"
./scripts/flow checkpoint list
./scripts/flow checkpoint rollback <id>
./scripts/flow checkpoint cleanup
```

**Configuration:**
```json
{
  "checkpoint": {
    "enabled": true,
    "interval": 5,
    "maxCheckpoints": 20,
    "autoCommit": true,
    "commitPrefix": "[checkpoint]"
  }
}
```

---

## Diff-First Output

Preview changes before applying with unified diff format.

```bash
./scripts/flow diff file1.ts file2.ts           # Compare files
./scripts/flow diff --preview operations.json   # Preview changes
./scripts/flow diff --apply operations.json     # Apply changes
./scripts/flow diff --dry-run operations.json   # Show diff only
./scripts/flow diff --json                      # JSON output
```

**Operations JSON Format:**
```json
[
  { "type": "write", "path": "src/app.ts", "content": "..." },
  { "type": "modify", "path": "src/utils.ts", "content": "..." },
  { "type": "delete", "path": "src/old.ts" }
]
```

---

## Cloud Model Providers

Unified interface for local and cloud LLM providers.

```bash
./scripts/flow providers list      # List all providers
./scripts/flow providers detect    # Detect running local providers
./scripts/flow providers test ollama
./scripts/flow providers test anthropic
```

**Supported Providers:**
| Provider | Type | Requires Key |
|----------|------|--------------|
| Ollama | Local | No |
| LM Studio | Local | No |
| Anthropic | Cloud | `ANTHROPIC_API_KEY` |
| OpenAI | Cloud | `OPENAI_API_KEY` |

**Configuration:**
```json
{
  "hybrid": {
    "enabled": true,
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "settings": {
      "temperature": 0.7,
      "maxTokens": 4096
    }
  }
}
```

---

## Declarative Workflows

YAML-based workflow definitions with conditional routing and bounded loops.

```bash
./scripts/flow workflow list              # List workflows
./scripts/flow workflow create deploy     # Create template
./scripts/flow workflow run deploy        # Run workflow
./scripts/flow workflow validate deploy   # Validate syntax
```

**Workflow YAML:**
```yaml
name: deploy
description: Build and deploy
onError: abort
maxIterations: 10

steps:
  - id: lint
    run: npm run lint

  - id: test
    when: $environment == "development"
    run: npm test

  - id: build
    run: npm run build

  - id: retry-on-fail
    type: loop
    maxIterations: 3
    until: $build_success == true
    steps:
      - run: npm run fix
      - run: npm run build
```

**Step Types:**
| Type | Description |
|------|-------------|
| `command` | Run shell command (default) |
| `gate` | Verification with recovery |
| `loop` | Bounded iteration |
| `parallel` | Run steps concurrently |
| `conditional` | Branch based on conditions |

---

## External Context Protocol

Reference external resources with automatic fetching and caching.

```bash
./scripts/flow links init              # Create template
./scripts/flow links list              # List all links
./scripts/flow links add prd ./docs/PRD.md
./scripts/flow links fetch prd         # Fetch and cache
./scripts/flow links show prd          # Show cached content
./scripts/flow links context           # Get all context
```

**links.yaml:**
```yaml
docs:
  prd: ./docs/PRD.md
  api: https://api.example.com/docs
design:
  figma: https://figma.com/file/...
issues:
  backlog: https://linear.app/...
```

**Supported Sources:**
- Local files
- GitHub files/repos
- Notion pages
- Figma files
- Jira/Linear issues
- Any URL (HTML extracted)

---

## Figma Component Analyzer

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

### Ad-Hoc Task Handling

When you give Claude a direct implementation request (not via `/wogi-start`), it automatically:

1. **Clarifies** - Asks 1-3 questions about requirements
2. **Creates criteria** - Generates testable Given/When/Then criteria
3. **Executes** - Full workflow (app-map check, auto-context, implementation)
4. **Verifies** - Runs quality gates, confirms criteria are met
5. **Logs** - Updates request-log.md

Ad-hoc tasks get the same rigor as structured tasks.

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

## Team Backend

AWS-powered backend for team collaboration with shared memory, proposals, and activity tracking.

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Wogi Flow CLI  │ ──▶ │   API Gateway   │ ──▶ │     Lambda      │
│   (Local)       │     │   (HTTP API)    │     │   Functions     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
        ┌───────────────────────────────────────────────┼───────────────────────────────────────────────┐
        ▼                       ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Teams       │     │   Proposals     │     │  Shared Memory  │     │    Activity     │
│   (DynamoDB)    │     │   (DynamoDB)    │     │   (DynamoDB)    │     │   (DynamoDB)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Features

| API | Description |
|-----|-------------|
| **Teams** | Create teams, invite members, manage roles |
| **Proposals** | Team decision voting system for workflow changes |
| **Memory Sync** | Share learned patterns across team members |
| **Activity** | Track team activity and generate reports |

### Setup

1. **Sign up** via Cognito hosted UI to get authentication token
2. **Configure** team settings in `config.json`:

```json
{
  "team": {
    "enabled": true,
    "teamId": "your-team-id",
    "aws": {
      "apiEndpoint": "https://your-api.execute-api.region.amazonaws.com/v1",
      "cognitoUserPool": "region_PoolId",
      "cognitoClientId": "your-client-id",
      "region": "eu-west-1"
    }
  }
}
```

### API Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/teams` | GET, POST | List/create teams |
| `/teams/{id}` | GET, PUT, DELETE | Team operations |
| `/teams/{id}/members` | GET | List team members |
| `/teams/{id}/invite` | POST | Invite member |
| `/teams/{id}/proposals` | GET, POST | Team proposals |
| `/teams/{id}/proposals/{id}` | GET | Proposal details |
| `/teams/{id}/proposals/{id}/vote` | POST | Cast vote |
| `/teams/{id}/memory` | GET, POST | Shared memory |
| `/teams/{id}/memory/sync` | POST | Sync local memory |
| `/teams/{id}/activity` | GET, POST | Activity log |

### Infrastructure

The backend is deployed via Terraform in `infrastructure/terraform/`:

```bash
cd infrastructure/terraform
terraform init
terraform plan
terraform apply
```

**Resources created:**
- API Gateway v2 (HTTP API)
- 4 Lambda functions (teams, proposals, memory, activity)
- 6 DynamoDB tables
- Cognito User Pool
- S3 bucket for artifacts
- IAM roles and policies

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
flow skill detect               # Detect frameworks (v1.8)
flow skill list                 # List installed skills (v1.8)

# Loop Enforcement (v1.8)
flow loop status                # Show active loop session
flow loop stats                 # Show loop statistics
flow loop can-exit              # Check if exit is allowed
flow loop enable                # Enable enforcement
flow loop disable               # Disable enforcement

# Parallel Detection (v1.8)
flow parallel analyze           # Analyze tasks for parallel potential
flow parallel suggest           # Check if suggestion available

# Team Sync (v1.8)
flow team sync-status           # Show project sync status
flow team sync-init             # Initialize project sync
flow team project-id            # Show/set project ID

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

# Safety & Verification (v1.6)
flow safety status              # Show safety limits
flow safety check-file <path>   # Check file permission
flow safety check-command <cmd> # Check command permission
flow verify lint                # Run lint gate
flow verify all                 # Run all gates
flow verify --json              # JSON output for CI

# Execution Traces (v1.6)
flow run-trace start <name>     # Start traced run
flow run-trace end              # End current run
flow history                    # List recent runs
flow inspect <run-id>           # Show run details

# Checkpoints (v1.6)
flow checkpoint create [msg]    # Create checkpoint
flow checkpoint list            # List checkpoints
flow checkpoint rollback <id>   # Rollback to checkpoint

# Diff Preview (v1.6)
flow diff <file1> <file2>       # Compare files
flow diff --preview <ops.json>  # Preview changes
flow diff --apply <ops.json>    # Apply changes

# Providers (v1.6)
flow providers list             # List providers
flow providers detect           # Detect local providers
flow providers test <type>      # Test provider

# External Links (v1.6)
flow links list                 # List external links
flow links add <name> <url>     # Add link
flow links fetch <name>         # Fetch and cache

# Declarative Workflows (v1.6)
flow workflow list              # List workflows
flow workflow run <name>        # Run workflow
flow workflow create <name>     # Create template

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

# Team Backend (AWS)
flow team status                # Show team connection status
flow team sync                  # Sync local memory to team
flow team activity              # Show team activity

# Hooks
flow setup-hooks install        # Install git hooks
flow setup-hooks uninstall      # Remove hooks
```

---

## Slash Commands

Quick reference for chat commands:

| Category       | Commands                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Tasks**      | `/wogi-ready`, `/wogi-start`, `/wogi-done`, `/wogi-bulk`, `/wogi-status`, `/wogi-deps`               |
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

### v1.8.0 - Pattern Enforcement & Team Sync

- **Pattern Enforcement**: Active pattern injection from decisions.md/app-map.md into prompts with citation validation
- **Loop Enforcement**: "Ralph Wiggum Mode" - blocks exit until all acceptance criteria pass, requireVerification, blockOnSkip
- **Parallel Auto-Detection**: Automatically detects parallelizable tasks with autoSuggest and autoExecute options
- **Skill Auto-Creation**: Detects frameworks from package.json and file patterns, fetches official documentation
- **Project-Based Team Sync**: Sync decisions.md, app-map.md, component-index, skills, and memory facts across team
- **Memory Export**: Schema-aware SQLite export for memory facts synchronization
- **Conflict Resolution**: Configurable strategies (newest-wins, remote-wins, local-wins, merge)
- **New commands**: `flow loop`, `flow parallel [analyze|suggest]`, `flow skill [detect|list]`, `flow team [sync-status|sync-init|project-id]`

### v1.7.0 - Team Backend

- **AWS Team Backend**: Full serverless infrastructure for team collaboration
- **Team APIs**: Teams, proposals, shared memory, activity logging
- **Cognito Auth**: JWT-based authentication for secure team access
- **Memory Sync**: Share learned patterns across team members
- **Proposal Voting**: Democratic decision-making for workflow changes
- **Infrastructure as Code**: Terraform-managed AWS resources

### v1.6.0 - Enterprise Safety & Automation

- **Safety Guardrails** (`flow-safety.js`): File/command permission models, bounded execution limits
- **Verification Gates** (`flow-verify.js`): Structured gate results with LLM error context for self-healing
- **Execution Traces** (`flow-run-trace.js`): JSONL event logging with artifact timeline
- **Auto-Checkpoints** (`flow-checkpoint.js`): Periodic state snapshots with rollback support
- **Diff-First Output** (`flow-diff.js`): Preview changes before applying, unified diff format
- **Cloud Providers** (`flow-providers.js`): Unified interface for Anthropic, OpenAI, Ollama, LM Studio
- **External Context** (`flow-links.js`): Reference external resources with automatic caching
- **Declarative Workflows** (`flow-workflow.js`): YAML workflows with conditional routing and bounded loops
- **CLI Utilities** (`flow-cli.js`): Standardized exit codes and JSON output for CI integration
- **Project Context** (`flow-context-init.js`): Auto-detect tech stack, manage constraints and conventions
- **New commands**: `flow safety`, `flow verify`, `flow run-trace`, `flow checkpoint`, `flow diff`, `flow providers`, `flow links`, `flow workflow`, `flow context-init`

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
