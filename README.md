# Wogi Flow v1.2

A self-improving AI development workflow for experienced developers and PMs.

## What Makes It Different

- **Self-Completing Tasks**: `/wogi-start` runs until the task is actually done - no manual `/wogi-done` needed
- **Autonomous Loops**: `/wogi-loop` for ad-hoc work that continues until completion criteria are met
- **Self-Improving**: Workflow learns from your feedback and updates its own instructions
- **Component-Aware**: Tracks all components to prevent duplication
- **Hybrid Component Index**: Auto-generated index + curated registry with sync detection
- **Code Traces**: Task-focused flow documentation with diagrams
- **Request Logging**: Every change is logged and searchable
- **Quality Gates**: Configurable mandatory steps per task type
- **Profile Sharing**: Export refined workflows for your team
- **Skills System**: Modular add-ons for specific tech stacks (NestJS, React, etc.)
- **Flexible Planning**: Feature-based or phase-based planning
- **Correction Reports**: Detailed bug fix documentation (configurable)
- **Easy Updates**: Update framework without losing project data

## Installation

### Option 1: One-Line Install (Recommended)

```bash
cd your-project
curl -fsSL https://raw.githubusercontent.com/Wogi-Git/wogi-flow/main/install.sh | bash
```

### Option 2: Clone and Copy

```bash
git clone https://github.com/Wogi-Git/wogi-flow.git
cp -r wogi-flow/* /path/to/your/project/
```

### Option 3: Download Release

Download the latest release from [GitHub Releases](https://github.com/Wogi-Git/wogi-flow/releases).

## Setup

After installation, run the interactive setup:

```bash
./scripts/flow install
```

The installer asks:
1. Project name
2. Agent structure (unified vs split frontend/backend)
3. Correction report mode
4. Planning style (feature-based vs phase-based)
5. Skills to install (nestjs, react, python, all, none)
6. Optional features (hooks, storybook, strict mode)

### Quick Setup (Defaults)

```bash
./scripts/flow install --quick my-project
```

## Updating

Update to the latest version without losing your project data:

```bash
./scripts/flow update
```

**What gets updated:**
- CLAUDE.md, README.md
- Scripts, agents, templates
- Slash commands
- Skills (framework files only)

**What's preserved:**
- Your config.json settings
- All workflow state (tasks, logs, history)
- Custom rules you've added
- Installed skill customizations

### Check for Updates

```bash
./scripts/flow update --check
```

## Onboarding Existing Projects

Already have a codebase? Run the onboarding wizard:

```bash
./scripts/flow onboard
```

This will:
1. **Analyze your project** - Detect language, framework, database, components
2. **Ask questions** - Project description, PRD, goals, known issues, coding patterns
3. **Generate context** - Create project.md, app-map.md, decisions.md
4. **Create initial tasks** - From known issues you provide
5. **Suggest skills** - Based on your tech stack

After onboarding, the AI has full context about your project and can:
- Analyze code with understanding of your architecture
- Create features that fit your patterns
- Fix bugs knowing your conventions
- Suggest improvements based on your goals

## Component Index (Hybrid Approach)

Wogi Flow uses two layers for component tracking:

### 1. Curated `app-map.md`
Human-maintained with rich context:
```markdown
| Component | Variants | Description |
|-----------|----------|-------------|
| Button | primary, secondary, ghost | Main action button |
```

### 2. Auto-generated `component-index.json`
Machine-generated, always current:
```bash
./scripts/flow map-index scan   # Scan codebase
./scripts/flow map-sync         # Compare with app-map
```

The sync command shows what's in your codebase but missing from app-map, and what's in app-map but no longer exists.

## Code Traces

Generate task-focused documentation of how code flows work:

```bash
./scripts/flow trace "user authentication flow"
./scripts/flow trace "payment processing"
./scripts/flow trace "how errors propagate"
```

Traces include:
- High-level flow overview
- Execution steps with file/line references
- Mermaid diagrams
- Related files
- Security/performance notes

Use traces for:
- **Understanding before editing** - Know what you're changing
- **Onboarding** - Learn new areas of codebase fast
- **Debugging** - Trace data flow through system
- **Documentation** - Save and share with team

## Core Concepts

### Self-Completing Tasks (New in v1.2)

When you run `/wogi-start TASK-XXX`, it now runs a **self-completing loop**:

```
/wogi-start TASK-012
    ↓
Load context (story, app-map, decisions)
    ↓
Decompose into TodoWrite checklist (from acceptance criteria)
    ↓
┌─────────────────────────────────────────┐
│ FOR EACH scenario:                      │
│   → Mark in_progress                    │
│   → Implement                           │
│   → Self-verify (did it actually work?) │
│   → If broken: fix and retry            │
│   → Mark completed                      │
└─────────────────────────────────────────┘
    ↓
Run quality gates (must all pass)
    ↓
Update request-log, app-map, ready.json
    ↓
Commit → Task complete
```

**No need to run `/wogi-done`** - the task completes itself when truly done.

Options:
- `--no-loop` - Just load context, don't auto-complete (old behavior)
- `--pause-between` - Ask for confirmation between scenarios
- `--max-retries N` - Limit retry attempts per scenario (default: 5)

### Autonomous Loops for Ad-Hoc Work (New in v1.2)

For work that isn't a structured task (refactors, migrations, batch operations):

```bash
/wogi-loop "Migrate all fetch() calls to use apiClient" --done-when "No fetch() calls remain, tests pass"
```

Same self-completing philosophy, but for free-form prompts. Inspired by [Ralph Wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum).

Options:
- `--done-when "criteria"` - Required. When to stop.
- `--max-iterations N` - Safety limit (default: 20)
- `--verify-command "cmd"` - Shell command to verify completion
- `--pause-every N` - Pause for confirmation every N iterations

**When to use which:**
| Situation | Command |
|-----------|---------|
| Task in ready.json with acceptance criteria | `/wogi-start TASK-XXX` |
| Ad-hoc refactor or migration | `/wogi-loop "prompt" --done-when "criteria"` |
| Quick one-off fix | Just do it directly |

### Task Execution Rules (Always Apply)

**These rules apply regardless of how you start a task:**
- Using `/wogi-start TASK-X`
- Saying "work on TASK-X"
- Saying "implement the login feature"
- Any other way of requesting work

**Before starting any task:**
1. Check app-map.md for existing components
2. Check decisions.md for patterns to follow
3. Load acceptance criteria

**After completing any task:**
1. Update request-log.md with what was done
2. Update app-map.md if new components created
3. Verify all acceptance criteria pass
4. Update ready.json to mark complete

This is enforced automatically - you don't need to remind Claude.

### Story Creation
When you request features, Claude creates detailed stories:

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

### Scenario 2: Error state
**Given** I am on login page
**When** I submit invalid email format
**Then** I see validation error

## Technical Notes
- Components: Use `Link` (secondary), modify `LoginForm`
- Route: /forgot-password

## Complexity
Low - Single link addition
```

Stories include: user story, Given/When/Then acceptance criteria, technical notes referencing app-map, test strategy, dependencies, and complexity.

### Request Logging
Every file change is automatically logged:
```markdown
### R-012 | 2024-01-15 14:32
**Type**: new
**Tags**: #screen:login #component:AuthForm
**Request**: "Add forgot password link"
**Result**: Added link, routes to /forgot-password
**Files**: LoginScreen.tsx, routes.ts
```

Search with tags:
```bash
grep -A5 "#screen:login" .workflow/state/request-log.md
```

### Component Registry (App Map)
Prevents duplicate components:
```markdown
| Component | Variants | Path |
|-----------|----------|------|
| Button | primary, secondary | components/ui/Button |
```

Before creating → check app-map. After creating → update app-map.

### Self-Improving Workflow
When you correct Claude:
1. It fixes the issue
2. Asks: "Should I update decisions.md / agents/*.md / config.json?"
3. Updates the chosen file
4. Commits the change

Your workflow improves over time.

### Quality Gates
Configure in `.workflow/config.json`:
```json
{
  "mandatorySteps": {
    "afterTask": ["test", "lint"],
    "beforeCommit": ["review"]
  },
  "qualityGates": {
    "feature": { "require": ["tests", "appMapUpdate"] }
  }
}
```

### Profile Export
Share refined workflow with team:
```bash
./scripts/flow export-profile "my-team"
# Share my-team.zip with team

./scripts/flow import-profile my-team.zip
```

## Commands Reference

### Slash Commands (Chat)

Type these directly in Claude chat for quick actions:

#### Task Management
| Command | Description |
|---------|-------------|
| `/wogi-ready` | Display all tasks organized by status. Shows ready tasks with priority, in-progress tasks, and blocked tasks with reasons. Recommends what to work on next. |
| `/wogi-start [id]` | **Self-completing loop.** Loads context, decomposes into TodoWrite checklist from acceptance criteria, implements each scenario with self-verification, runs quality gates, auto-commits when truly done. Options: `--no-loop` (old behavior), `--pause-between`, `--max-retries N`. |
| `/wogi-loop "prompt"` | **Autonomous loop for ad-hoc work.** Continues until `--done-when` criteria met. For refactors, migrations, batch operations. Options: `--max-iterations N`, `--verify-command "cmd"`, `--pause-every N`. |
| `/wogi-done [id]` | Manual completion (optional). Usually not needed since `/wogi-start` auto-completes. Use for force-completing stuck tasks or work done outside the loop. |
| `/wogi-bulk` | Execute multiple tasks in sequence. Orders by dependencies and priority, follows all workflow rules for each task, compacts proactively between tasks. Options: `--auto` (unattended), `--plan` (dry run). |
| `/wogi-status` | Full project overview. Shows task counts by status, active features, open bugs, mapped components count, git branch and uncommitted changes, and recent activity from request-log. |
| `/wogi-deps [id]` | Show dependency tree for a task. Displays what the task depends on (with their status) and what other tasks are blocked waiting for this one. |

#### Story & Feature Creation
| Command | Description |
|---------|-------------|
| `/wogi-story [title]` | Create a detailed story with full structure: user story (As a/I want/So that), description, Given/When/Then acceptance criteria covering happy path, alternatives, and errors, technical notes referencing app-map components, test strategy, dependencies, and complexity assessment. |
| `/wogi-feature [name]` | Create a new feature. Sets up `.workflow/changes/[name]/` directory with proposal.md template and tasks.json. Prompts for feature details to populate the templates. |
| `/wogi-bug [title]` | Create a bug report. Generates next BUG-XXX number, creates report in `.workflow/bugs/` with reproduction steps template, severity field, and related component tags. |

#### Workflow Management
| Command | Description |
|---------|-------------|
| `/wogi-health` | Comprehensive health check. Verifies all required files exist, validates JSON syntax in config.json and ready.json, checks if app-map is in sync with actual components, reports git status, and lists any issues found. |
| `/wogi-standup` | Generate daily standup summary. Pulls recent completions from request-log, shows current in-progress tasks, lists what's ready next, highlights any blockers, and notes recent decisions from feedback-patterns.md. |
| `/wogi-session-end` | Properly end a session. Ensures request-log has all changes logged, updates app-map if new components were created, updates progress.md with handoff notes, commits all changes, and offers to push to remote. |
| `/wogi-init` | Initialize Wogi Flow in a new project. Creates all required directories (.workflow/state, specs, changes, etc.) and state files (ready.json, request-log.md, app-map.md, decisions.md, config.json). |

#### Component Management
| Command | Description |
|---------|-------------|
| `/wogi-map` | Display the full app-map showing all screens with routes, modals with triggers, and components with their variants and paths. Quick reference before creating anything new. |
| `/wogi-map-add [name] [path] [variants]` | Add a component to app-map.md. Also creates a detail file at `.workflow/state/components/[name].md` with props, usage examples, and "used in" tracking. |
| `/wogi-map-scan [dir]` | Scan a directory (default: src/components) for component files (.tsx, .jsx, .vue). Compares found components against app-map and reports which ones are missing from documentation. |
| `/wogi-map-check` | Check for drift between app-map and codebase. Verifies each mapped component still exists at its listed path. Reports orphaned entries that need cleanup. |

#### Search & Context
| Command | Description |
|---------|-------------|
| `/wogi-search [tag]` | Search request-log.md for entries matching a tag (e.g., #screen:login, #component:Button, #feature:auth). Returns matching entries with their full context. Useful for finding past work related to current task. |
| `/wogi-context [id]` | Load complete context for a task. Gathers: the task's story/acceptance criteria, related request-log entries, component docs for any referenced components, relevant patterns from decisions.md. Everything needed to implement. |

#### Team & Export
| Command | Description |
|---------|-------------|
| `/wogi-export [name]` | Export your refined workflow as a shareable profile. Creates a zip containing CLAUDE.md, all agents/, and config.json. Optionally includes decisions.md. Share with team members so everyone uses the same workflow. |
| `/wogi-import [file]` | Import a team profile. Copies CLAUDE.md, agents/, and config.json from the zip. Can merge or replace existing files. Requires Claude CLI restart after importing. |
| `/wogi-changelog` | Generate CHANGELOG.md from request-log. Parses all entries, groups by type (new→Added, fix→Fixed, change→Changed, refactor→Refactored), and outputs standard changelog format. |

#### Browser Testing (Claude Extension)
| Command | Description |
|---------|-------------|
| `/wogi-test-browser [flow]` | Execute a browser test flow using Claude's browser extension. Opens the browser, navigates to URLs, interacts with elements (click, type), verifies outcomes, and reports pass/fail with optional screenshots. |
| `/wogi-test-browser all` | Run all test flows defined in `.workflow/tests/flows/`. Executes each flow sequentially and provides a summary report of all results. |
| `/wogi-test-record [name]` | Interactively record a new test flow. Opens browser, you perform the actions, Claude records them as a JSON flow definition that can be replayed later. |

#### Configuration
| Command | Description |
|---------|-------------|
| `/wogi-config` | Display current configuration summary from config.json. Shows which features are enabled/disabled. |
| `/wogi-config storybook on/off` | Toggle auto-generation of Storybook stories. When ON, every new component created will also get a `.stories.tsx` file. |
| `/wogi-config hooks on/off` | Toggle pre-commit git hooks. When ON, commits are checked for request-log updates, console.logs, and tests (if configured). |
| `/wogi-config tests-before-commit on/off` | Toggle whether `npm test` runs before each commit. Requires hooks to be enabled. |
| `/wogi-config phases on/off` | Toggle phase-based planning mode. |

#### Skills & Rules
| Command | Description |
|---------|-------------|
| `/wogi-skills` | List installed and available skills with their commands. |
| `/wogi-skills add [name]` | Install a skill package (nestjs, react, python, or all). |
| `/wogi-skills remove [name]` | Remove an installed skill. |
| `/wogi-skills info [name]` | Show detailed info about a skill including commands, rules, templates. |
| `/wogi-rules` | List all coding rules from `.claude/rules/` and installed skills. |
| `/wogi-rules [name]` | View specific rule file content. |

#### Planning & Documentation
| Command | Description |
|---------|-------------|
| `/wogi-roadmap` | Show phase-based roadmap with progress per phase (requires phases enabled). |
| `/wogi-correction [id]` | Create detailed correction report for a bug fix (behavior based on corrections.mode in config). |
| `/wogi-help` | Show all available Wogi Flow commands. |

### CLI Commands (Terminal)

Run these directly in your terminal:

```bash
# Task Management
./scripts/flow ready                    # Show task queue
./scripts/flow start TASK-001           # Start a task
./scripts/flow done TASK-001 "message"  # Complete with commit message
./scripts/flow status                   # Project overview
./scripts/flow deps TASK-001            # Show dependencies

# Story & Feature Creation  
./scripts/flow story "Add login form"   # Create detailed story
./scripts/flow new-feature auth         # Create feature
./scripts/flow bug "Login fails"        # Create bug report

# Workflow Management
./scripts/flow health                   # Check workflow health
./scripts/flow standup                  # Generate standup
./scripts/flow standup 3                # Standup for last 3 days
./scripts/flow session-end              # End session properly
./scripts/flow init                     # Initialize workflow

# Component Management
./scripts/flow update-map add Button components/ui/Button "primary,secondary"
./scripts/flow update-map screen Login /login
./scripts/flow update-map modal Confirm "Delete button click"
./scripts/flow update-map scan src/components
./scripts/flow update-map check

# Search & Context
./scripts/flow search "#screen:login"   # Search by tag
./scripts/flow search "password"        # Search by keyword
./scripts/flow context TASK-001         # Load all task context

# Git Hooks (optional)
./scripts/flow setup-hooks install      # Install pre-commit hooks
./scripts/flow setup-hooks uninstall    # Remove hooks
./scripts/flow setup-hooks status       # Check if hooks installed

# Team & Export
./scripts/flow export-profile team-v1
./scripts/flow export-profile team-v1 --include-decisions
./scripts/flow import-profile team-v1.zip
./scripts/flow import-profile team-v1.zip --backup
./scripts/flow changelog
```

## Optional Features

### Auto-generate Storybook Stories

When enabled, every new component automatically gets a Storybook story file.

**Enable:**
```
/wogi-config storybook on
```

Or edit `config.json`:
```json
"componentRules": {
  "autoGenerateStorybook": true,
  "storybookPath": "src/stories"
}
```

When you create a component, Claude will also create:
```
src/stories/ComponentName.stories.tsx
```

### Pre-commit Hooks

Optional git hooks that check before each commit:
- request-log.md was updated (warning)
- No console.log statements (warning)
- Tests pass (if configured)
- Lint passes (if eslint configured)

**Install:**
```bash
./scripts/flow setup-hooks install
```

**Uninstall:**
```bash
./scripts/flow setup-hooks uninstall
```

**Bypass for a single commit:**
```bash
git commit --no-verify
```

### Skills System

Skills are modular add-ons for specific tech stacks:

**Available Skills:**
| Skill | Description | Commands |
|-------|-------------|----------|
| `nestjs` | NestJS module builder | `/nestjs-scaffold`, `/nestjs-entity`, `/nestjs-db` |
| `react` | React component patterns | `/react-component`, `/react-hook` |
| `python` | Python/FastAPI patterns | `/python-endpoint`, `/python-test` |

**Install during setup:**
```bash
./scripts/flow install
# Answer "nestjs" or "all" when asked about skills
```

**Install after setup:**
```
/wogi-skills add nestjs
```

**Using skill commands:**
```
/nestjs-scaffold users        # Create complete NestJS module
/nestjs-entity User           # Create TypeORM entity
/nestjs-db migrate            # Run migrations
```

Skills add:
- Slash commands specific to the tech stack
- Code templates
- Coding rules and conventions

### Phase-Based Planning

Enable for projects with sequential milestones:

```json
"phases": {
  "enabled": true
}
```

Then use:
- Add `phase` field to tasks (0, 1, 2, etc.)
- Create `.workflow/specs/ROADMAP.md` with phase definitions
- Use `/wogi-roadmap` to view progress

### Correction Reports

Configure how bug fixes are documented:

```json
"corrections": {
  "mode": "inline"  // or "hybrid" or "always-detailed"
}
```

| Mode | Behavior |
|------|----------|
| `inline` | Everything in request-log.md (default) |
| `hybrid` | Summary in log + detailed doc for significant fixes |
| `always-detailed` | Summary + detailed doc for every fix |

Use `/wogi-correction TASK-XXX` to create detailed reports.

### Strict Mode

Enable additional quality requirements:

```json
"strictMode": {
  "verificationChecklist": true,   // Require checklist before done
  "correctionReportsOnFail": true, // Require report on test failure
  "featureReportsOnComplete": true // Require report on completion
}
```

## Agents

**Core Agents:**
- `orchestrator.md` - Planning, coordination
- `story-writer.md` - Detailed story creation with Given/When/Then
- `developer.md` - Implementation
- `reviewer.md` - Code review
- `tester.md` - Testing

**Specialist Agents:**
- `accessibility.md` - A11y compliance
- `security.md` - Security review
- `performance.md` - Performance optimization
- `design-system.md` - Design consistency
- `docs.md` - Documentation
- `onboarding.md` - New team member help

## File Structure

```
.workflow/
├── config.json              # Workflow configuration
├── state/
│   ├── ready.json           # Task queue
│   ├── request-log.md       # Change history
│   ├── app-map.md           # Component registry
│   ├── components/          # Component details
│   ├── decisions.md         # Project rules
│   ├── feedback-patterns.md # Learning tracker
│   └── progress.md          # Handoff notes
├── specs/
│   └── project.md           # Project overview
├── changes/                 # Active features
├── archive/                 # Completed work
├── bugs/                    # Bug reports
└── tests/flows/             # Browser test flows

agents/                      # Agent personas
scripts/                     # CLI tools
templates/                   # File templates
CLAUDE.md                    # Main instructions
```

## Natural Language Config

Tell Claude what you want:
- "Always run tests after completing a task"
- "Require review before any commit"
- "Add accessibility checks to quality gates"

Claude updates `config.json` accordingly.

## Feedback Loop

1. **Correction**: You correct Claude's work
2. **Fix**: Claude fixes immediately
3. **Learn**: Claude asks to persist the rule
4. **Update**: Updates decisions.md / agents/*.md / config.json
5. **Track**: Logs to feedback-patterns.md

After 3+ similar corrections → Claude suggests promoting to permanent instruction.

## Team Usage

1. One person refines the workflow
2. Export: `./scripts/flow export-profile "team-v1"`
3. Share the zip file
4. Others import: `./scripts/flow import-profile team-v1.zip`
5. Everyone has same workflow configuration

## Configuration Options

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
  "requireApproval": ["architecture-changes", "new-dependencies"],
  "componentRules": {
    "preferVariants": true,
    "requireAppMapEntry": true
  },
  "testing": {
    "runAfterTask": false,
    "browserTests": false
  }
}
```

## Changelog

### v1.2.0 - Self-Completing Loops
- **Self-completing `/wogi-start`**: Tasks now run in a loop until truly done
  - Decomposes acceptance criteria into TodoWrite checklist
  - Self-verifies each scenario before marking complete
  - Retries on failure automatically
  - Runs quality gates before completion
  - Auto-commits when done
  - Options: `--no-loop`, `--pause-between`, `--max-retries N`
- **New `/wogi-loop` command**: Autonomous loops for ad-hoc work
  - For refactors, migrations, batch operations
  - Continues until `--done-when` criteria met
  - Options: `--max-iterations N`, `--verify-command "cmd"`
  - Inspired by [Ralph Wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum)
- **`/wogi-done` now optional**: Only needed for force-completing or old behavior
- **New config section**: `loops` settings in config.json

### v1.1.0 - Hybrid Component Index & Code Traces
- **Hybrid component index**: Auto-generated `component-index.json` + curated `app-map.md`
  - `/wogi-map-index` - Show auto-generated index
  - `/wogi-map-index scan` - Rescan codebase
  - `/wogi-map-sync` - Compare index with app-map, suggest updates
- **Code traces**: Task-focused flow documentation
  - `/wogi-trace "prompt"` - Generate code trace with Mermaid diagrams
  - `/wogi-trace list` - List saved traces
  - Saved to `.workflow/traces/`
- **New CLI commands**: `flow map-index`, `flow map-sync`, `flow trace`
- **New state file**: `.workflow/state/component-index.json`
- **New directory**: `.workflow/traces/`

### v1.01 - Bug Fixes
- Fixed `flow-update` script bugs for smoother framework updates

### v1.0.0 - Initial Release
- Core workflow with task management, stories, quality gates
- Component registry (app-map.md)
- Request logging
- Self-improving feedback loop
- Skills system (NestJS, React, Python)
- Profile export/import for teams
- Browser testing support
- Onboarding wizard for existing projects

## License

MIT
