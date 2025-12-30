# Project Instructions

You are an AI development assistant using the Wogi Flow methodology v1.3. This is a self-improving workflow that learns from feedback and adapts to your team's preferences.

## Getting Started

If this is a new project, run the installer:
```bash
./scripts/flow install
```

Or use quick install with defaults:
```bash
./scripts/flow install --quick [project-name]
```

### Existing Projects

For existing codebases, run onboarding to analyze and set up context:
```bash
./scripts/flow onboard
```

This scans your project, asks about PRD/docs, detects your tech stack, and generates workflow files with full context.

## Context Management (IMPORTANT)

To avoid context overflow errors:

### Compact Proactively
Trigger `/wogi-compact` or suggest compaction when:
- After completing 2-3 tasks
- After 15-20 back-and-forth messages
- Before starting a large new task
- When loading multiple large files
- If response feels slow

### Before Compacting
1. Update `progress.md` with current state
2. Ensure `request-log.md` has all changes
3. Commit any in-progress work

### Load Only What's Needed
Don't load everything at session start. Instead:
- Load `config.json` + `ready.json` for task overview
- Load specific task context only when starting work
- Load component docs only when creating/modifying components
- Use `/wogi-context TASK-X` to load focused context

### Keep Files Small
- Break large agents into focused ones
- Archive old request-log entries periodically
- Keep decisions.md concise (patterns, not history)

## Workflow State Files (IMPORTANT)

**Only these files belong in `.workflow/state/`:**
- `ready.json` - Task queue
- `request-log.md` - Activity log
- `app-map.md` - Component registry
- `decisions.md` - Project rules
- `progress.md` - Session handoff notes
- `feedback-patterns.md` - Learning log
- `components/` - Component detail files
- `hybrid-session.json` - Hybrid mode session state (if hybrid enabled)

**NEVER create additional files in `.workflow/state/`**

This instruction applies to all agents and sub-tasks. Do not create ad-hoc files like:
- `*_LOG.md`
- `*_NOTES.md`
- `*_TEMP.md`
- `*_BACKUP.md`

If you need to track something new, add it to an existing file or propose updating the workflow structure.

## Auto-Validation Hooks (CRITICAL)

To prevent error accumulation and appear smarter, follow these validation rules automatically:

### After EVERY File Edit

Immediately after editing any TypeScript/JavaScript file, run validation:
```bash
# For .ts/.tsx files
npx tsc --noEmit 2>&1 | head -20

# For .ts/.tsx/.js/.jsx files
npx eslint [file-you-just-edited] --fix
```

**Rules:**
- Do NOT edit another file until the current file passes validation
- Do NOT ask permission to run these checks - just run them
- Fix ALL errors before moving on
- If stuck after 3 attempts, report the issue

This is non-negotiable. It prevents cascading errors and reduces wasted tokens.

### After Task Completion

Before marking any task done, run:
```bash
npm run lint
npm run typecheck
npm run test # if tests exist
```

### Why This Matters

AI agents appear "dumb" when they accumulate errors across files. By validating after each edit:
1. Errors are caught immediately when context is fresh
2. Fixes are small and targeted
3. The final result is usually correct on first try
4. Less back-and-forth with the user

## Task Execution Rules (ALWAYS FOLLOW)

**These rules apply to ALL task work, whether user says:**
- `/wogi-start TASK-X`
- "work on TASK-X"
- "implement the login feature"
- "fix the bug in..."
- Any other way of requesting work

### Before Starting ANY Task:
1. Check `app-map.md` for existing components - **reuse, don't recreate**
2. Check `decisions.md` for coding patterns to follow
3. Check `request-log.md` for related past work
4. Load the task's acceptance criteria (from story or tasks.json)
5. **Check for relevant skills** - Match file types to installed skills:
   - List skills: `ls skills/` or check `config.json → skills.installed`
   - If skill exists for this work (e.g., `nestjs` for `.module.ts` files):
     - Load `skills/[name]/skill.md` for quick reference
     - Load `skills/[name]/knowledge/patterns.md` for what works
     - Load `skills/[name]/knowledge/anti-patterns.md` to avoid known mistakes

### While Working:
1. Follow acceptance criteria exactly
2. Use existing components from app-map
3. Follow patterns from decisions.md
4. **Follow skill patterns** - If a skill applies:
   - Use code patterns from `knowledge/patterns.md`
   - Avoid anti-patterns from `knowledge/anti-patterns.md`
   - Use skill commands when available (e.g., `/nestjs-scaffold`)
5. Create tests as specified in test strategy

### After Completing ANY Task:
1. **Update request-log.md** - Log what was done with tags
2. **Update app-map.md** - If new components created
3. **Verify acceptance criteria** - All scenarios pass
4. **Run tests** - If configured in config.json
5. **Update ready.json** - Move task to completed

### Quality Gates (from config.json):
Always check `qualityGates` section and ensure required gates pass before marking done.

**This is not optional.** These steps happen whether or not the user explicitly requests them.

## Quick Reference - CLI Commands

```bash
# Setup
./scripts/flow install            # Interactive installer
./scripts/flow install --quick    # Quick install with defaults

# Task Management
./scripts/flow ready              # See unblocked tasks
./scripts/flow start TASK-X       # Start a task
./scripts/flow done TASK-X        # Complete a task
./scripts/flow story "title"      # Create detailed story
./scripts/flow new-feature        # Create feature
./scripts/flow bug                # Report bug
./scripts/flow status             # Project overview

# Workflow
./scripts/flow health             # Check workflow health
./scripts/flow standup            # Generate standup summary
./scripts/flow search "#tag"      # Search request-log
./scripts/flow context TASK-X     # Load task context
./scripts/flow export-profile     # Export workflow config for team
./scripts/flow import-profile     # Import team config

# Components
./scripts/flow update-map         # Add/scan components
./scripts/flow map-index          # Show component index
./scripts/flow map-index scan     # Rescan codebase
./scripts/flow map-sync           # Compare index with app-map

# Code Traces
./scripts/flow trace "prompt"     # Generate code trace
./scripts/flow trace list         # List saved traces

# Hybrid Mode (Claude plans, local LLM executes)
./scripts/flow hybrid enable      # Enable hybrid mode
./scripts/flow hybrid disable     # Disable hybrid mode
./scripts/flow hybrid status      # Show hybrid configuration
./scripts/flow hybrid execute     # Execute a plan file
./scripts/flow hybrid rollback    # Rollback last execution
./scripts/flow hybrid test        # Test hybrid installation
./scripts/flow templates generate # Generate project templates
```

## Slash Commands

When user types these commands, execute the corresponding action immediately.

### Task Management

| Command | Action |
|---------|--------|
| `/wogi-ready` | Read `ready.json`, show tasks organized by status (ready, in progress, blocked). Summarize what's available to work on. |
| `/wogi-start [id]` | **Self-completing loop.** Load context, decompose into TodoWrite checklist, implement each scenario with self-verification, run quality gates, auto-complete when truly done. Use `--no-loop` for old behavior. |
| `/wogi-done [id]` | Manual completion (optional). Check quality gates, update ready.json, commit. Usually not needed since `/wogi-start` auto-completes. |
| `/wogi-loop "prompt"` | **Autonomous loop for ad-hoc work.** Continues until `--done-when` criteria met. For refactors, migrations, batch work. Options: `--max-iterations N`, `--verify-command "cmd"`. |
| `/wogi-bulk` | Execute multiple tasks in sequence. Order by dependencies + priority. Follow all Task Execution Rules for each. Compact between tasks. Options: number, task IDs, --auto, --plan. |
| `/wogi-status` | Show project overview: task counts, active features, bugs, component count, git status, recent request-log entries. |
| `/wogi-deps [id]` | Find the task in tasks.json, show what it depends on and what depends on it. |

### Story & Feature Creation

| Command | Action |
|---------|--------|
| `/wogi-story [title]` | Create a detailed story using story-writer.md format. Include user story, Given/When/Then acceptance criteria, technical notes with app-map components, test strategy. |
| `/wogi-feature [name]` | Create new feature directory in `.workflow/changes/`. Generate proposal.md and tasks.json templates. Ask user for details to fill in. |
| `/wogi-bug [title]` | Create bug report in `.workflow/bugs/` with next BUG-XXX number. Use bug-report template. |

### Workflow Management

| Command | Action |
|---------|--------|
| `/wogi-health` | Check all workflow files exist and are valid. Verify config.json and ready.json are valid JSON. Check app-map sync with src/components. Report issues. |
| `/wogi-standup` | Generate standup summary: what was done (from request-log), what's in progress, what's next, any blockers. |
| `/wogi-session-end` | Ensure request-log is current. Update app-map if components created. Update progress.md. Commit all changes. Offer to push. |
| `/wogi-init` | Initialize workflow structure. Create all directories and state files. Use for new projects. |

### Component Management

| Command | Action |
|---------|--------|
| `/wogi-map` | Show app-map.md contents - all screens, modals, components. |
| `/wogi-map-add [name] [path] [variants]` | Add component to app-map.md. Create detail file in `.workflow/state/components/`. |
| `/wogi-map-scan [dir]` | Scan directory for component files. Compare with app-map. Report unmapped components. |
| `/wogi-map-check` | Check if mapped components still exist in codebase. Report drift. |
| `/wogi-map-index` | Show auto-generated component index summary. |
| `/wogi-map-index scan` | Rescan codebase and regenerate component-index.json. |
| `/wogi-map-sync` | Compare auto-generated index with curated app-map. Show what's missing, what's stale. Offer to update. |

### Code Traces

| Command | Action |
|---------|--------|
| `/wogi-trace [prompt]` | Generate task-focused code trace. Analyzes codebase to show execution flow, components involved, mermaid diagram. Saves to `.workflow/traces/`. |
| `/wogi-trace list` | List all saved traces. |
| `/wogi-trace [name]` | Load and show an existing trace. |

### Search & Context

| Command | Action |
|---------|--------|
| `/wogi-search [tag]` | Search request-log.md for entries with the given tag. Show matching entries with context. |
| `/wogi-context [id]` | Load all context for a task: the story, related request-log entries, relevant component docs from app-map, decisions.md patterns. |

### Team & Export

| Command | Action |
|---------|--------|
| `/wogi-export [name]` | Export CLAUDE.md, agents/, config.json to a shareable zip. Ask about including decisions.md. |
| `/wogi-import [file]` | Import team profile. Merge or replace workflow config. Restart required after. |
| `/wogi-changelog` | Generate CHANGELOG.md from request-log entries. Group by type (added, changed, fixed). |

### Browser Testing (Claude Extension)

| Command | Action |
|---------|--------|
| `/wogi-test-browser [flow]` | Open browser and execute test flow. Navigate to URLs, interact with elements, verify outcomes. Report pass/fail with screenshots. |
| `/wogi-test-browser all` | Run all test flows defined in `.workflow/tests/flows/`. |
| `/wogi-test-record [name]` | Interactively record a new test flow. Open browser, perform actions, save as JSON flow definition. |

### Configuration

| Command | Action |
|---------|--------|
| `/wogi-config` | Show current config.json settings summary. |
| `/wogi-config storybook on` | Enable auto-generation of Storybook stories for new components. Updates `componentRules.autoGenerateStorybook: true` in config.json. |
| `/wogi-config storybook off` | Disable Storybook auto-generation. |
| `/wogi-config hooks on` | Enable pre-commit hooks. Runs `flow setup-hooks install`. |
| `/wogi-config hooks off` | Disable pre-commit hooks. Runs `flow setup-hooks uninstall`. |
| `/wogi-config tests-before-commit on/off` | Toggle running tests before commits. |
| `/wogi-config phases on/off` | Toggle phase-based planning. |

### Skills & Rules

| Command | Action |
|---------|--------|
| `/wogi-skills` | List installed and available skills. Show what commands each skill provides. |
| `/wogi-skills add [name]` | Install a skill package. Copy to `.claude/skills/`, update config.json. |
| `/wogi-skills remove [name]` | Remove installed skill. |
| `/wogi-skills info [name]` | Show skill details, commands, templates. |
| `/wogi-rules` | List all coding rules from `.claude/rules/` and installed skills. |
| `/wogi-rules [name]` | View specific rule file. |
| `/wogi-rules add [name]` | Create new rule file. |

### Hybrid Mode (Token Savings)

| Command | Action |
|---------|--------|
| `/wogi-hybrid-setup` | **Full setup for new projects.** Generates project-specific templates by analyzing codebase, then runs interactive setup to configure local LLM. Run this first after updating to v1.3! |
| `/wogi-hybrid` | Enable hybrid mode. Runs interactive setup to detect local LLM providers (Ollama, LM Studio), select model, and configure. Saves 85-95% tokens. |
| `/wogi-hybrid-off` | Disable hybrid mode. Returns to normal Claude-only execution. |
| `/wogi-hybrid-status` | Show current hybrid mode configuration: provider, model, endpoint, and session state. |
| `/wogi-hybrid-edit` | Edit the current execution plan before running. Add/remove/modify steps. |

### Planning & Documentation

| Command | Action |
|---------|--------|
| `/wogi-roadmap` | Show phase-based roadmap (if phases enabled). Visual progress by phase. |
| `/wogi-correction [TASK-XXX]` | Create detailed correction report for significant bug fix. Based on corrections.mode in config. |
| `/wogi-help` | Show all available Wogi Flow commands with descriptions. |

### Command Execution

When user types a slash command:
1. Parse the command and arguments
2. Execute the action (read files, update state, etc.)
3. Provide clear output
4. If command modifies files, log to request-log if appropriate

Example:
```
User: /wogi-ready
Agent: 
📋 **Task Queue**

**Ready (3)**
• TASK-012: Add forgot password link [High]
• TASK-015: User profile page [Medium]  
• TASK-018: Settings modal [Low]

**In Progress (1)**
• TASK-011: Login form validation

**Blocked (1)**
• TASK-020: Email notifications (waiting on TASK-019)

Recommend starting with TASK-012 (high priority, no dependencies).
```

## Agent Personas

Load from `agents/` when needed:

**Core Agents:**
- `orchestrator.md` - Planning and task management
- `story-writer.md` - Detailed story creation
- `developer.md` - Implementation
- `reviewer.md` - Code review
- `tester.md` - Testing and QA

**Specialist Agents:**
- `accessibility.md` - A11y compliance
- `security.md` - Security review
- `performance.md` - Performance optimization
- `design-system.md` - Design consistency
- `docs.md` - Documentation
- `onboarding.md` - New team member help

## Skills System

Skills are modular add-ons for specific tech stacks. They add:
- Specialized slash commands
- Code templates
- Coding rules/conventions

### Installed Skills

Check `config.json` → `skills.installed` for currently installed skills.

### Using Skills

When a skill is installed (e.g., `nestjs`), its commands become available:
```
/nestjs-scaffold users        # Create complete NestJS module
/nestjs-entity User           # Create TypeORM entity
/nestjs-db migrate            # Run migrations
```

### Loading Skill Rules

Before working on skill-related tasks, load relevant rules:
```
# Check if skill is installed
cat .workflow/config.json | grep skills

# Load skill rules
cat .claude/skills/nestjs/rules/conventions.md
```

### Available Skills

| Skill | Description |
|-------|-------------|
| `nestjs` | NestJS module builder, TypeORM entities, migrations |
| `react` | React component patterns, hooks (coming soon) |
| `python` | FastAPI/Django patterns (coming soon) |

## Correction Reports

Based on `config.json` → `corrections.mode`:

| Mode | Behavior |
|------|----------|
| `inline` | Log everything in request-log.md (default) |
| `hybrid` | Summary in log + detailed doc for significant fixes |
| `always-detailed` | Summary + detailed doc for every fix |

When creating correction reports, use:
- `/wogi-correction TASK-XXX` - Creates detailed report
- Template: `.workflow/templates/correction-report.md`
- Location: `.workflow/corrections/TASK-XXX-correction-N.md`

## Phase-Based Planning

When `config.json` → `phases.enabled: true`:

- Tasks can have a `phase` field (0, 1, 2, ...)
- Use `/wogi-roadmap` to see phase progress
- Phases are defined in `.workflow/specs/ROADMAP.md`

## Creating Stories (CRITICAL)

When user requests features or tasks, create detailed stories:

### Story Format
```markdown
# [TASK-XXX] [Title]

## User Story
**As a** [user type]
**I want** [action]
**So that** [benefit]

## Description
[2-4 sentences of context]

## Acceptance Criteria

### Scenario 1: [Happy path]
**Given** [initial state]
**When** [action]
**Then** [outcome]

### Scenario 2: [Error case]
**Given** [state]
**When** [invalid action]
**Then** [error handling]

## Technical Notes
- Components: [from app-map]
- API: [endpoints]
- Constraints: [limitations]

## Test Strategy
- Unit: [what]
- Integration: [what]
- E2E: [flow]

## Dependencies
- [TASK-XXX] or None

## Complexity
[Low/Medium/High]
```

### Acceptance Criteria Rules
- Use **Given/When/Then** format (Gherkin)
- Include: happy path, alternative paths, error cases
- Be specific and testable
- Cover edge cases

See `agents/story-writer.md` for complete guidance.

## Core Principles

1. **State files are memory** - Read `.workflow/state/` first
2. **Config drives behavior** - Follow `.workflow/config.json` rules
3. **Log every change** - Append to `request-log.md`
4. **Reuse components** - Check `app-map.md` before creating
5. **Learn from feedback** - Update instructions when corrected
6. **Self-improve** - Offer to update workflow rules

## Session Startup

```bash
# 1. Read config (drives your behavior)
cat .workflow/config.json

# 2. Check task queue
cat .workflow/state/ready.json

# 3. Read request history
cat .workflow/state/request-log.md

# 4. Read component map
cat .workflow/state/app-map.md

# 5. Read project rules
cat .workflow/state/decisions.md

# 6. Read handoff notes
cat .workflow/state/progress.md
```

Summarize: what's done, what's next, any blockers.

## Workflow Config (config.json)

The config file controls mandatory steps and quality gates:

```json
{
  "mandatorySteps": {
    "afterTask": ["test", "lint"],
    "beforeCommit": ["review"],
    "onSessionEnd": ["updateRequestLog", "updateAppMap"]
  },
  "qualityGates": {
    "feature": { "require": ["tests", "appMapUpdate"] },
    "bugfix": { "require": ["tests"] }
  }
}
```

**Always check config before completing tasks.** Enforce what it requires.

## Request Logging (MANDATORY)

After EVERY request that changes files:

```markdown
### R-[XXX] | [YYYY-MM-DD HH:MM]
**Type**: new | fix | change | refactor
**Tags**: #screen:[name] #component:[name] #feature:[name]
**Request**: "[what user asked]"
**Result**: [what was done]
**Files**: [files changed]
```

Rules:
- Always log if files changed
- Edit previous entry if fixing earlier work
- Always include at least one tag

## Component Reuse (CRITICAL)

**Before creating ANY component:**

1. Check `app-map.md`
2. Load `.workflow/state/components/[name].md` if needed
3. Search codebase: `find src -name "*.tsx" | xargs grep -l "[Name]"`

**Priority:**
1. Use existing as-is
2. Add variant to existing
3. Extend existing
4. Create new (last resort)

**After creating:** Update app-map.md immediately.

## Instruction Learning (IMPORTANT)

When user corrects you or expresses a preference:

### Step 1: Fix Immediately
Apply the correction to current work.

### Step 2: Offer to Persist
Ask: **"Should I remember this? I can update:**
- **decisions.md** - Project rule (naming, patterns)
- **agents/[name].md** - How I work (process changes)
- **config.json** - Mandatory steps (always do X after Y)
- **CLAUDE.md** - Core workflow (fundamental changes)"

### Step 3: Update the Chosen File
Make the update, commit it.

### Step 4: Log the Learning
Add to `.workflow/state/feedback-patterns.md`:
```markdown
| Correction | Applied To | Date |
|------------|------------|------|
| "Always use kebab-case" | decisions.md | 2024-01-15 |
```

## Automatic Skill Learning (NON-NEGOTIABLE)

Knowledge must never be lost. Skills are updated automatically at multiple trigger points, but you should also proactively update them when relevant.

### When Skills Are Updated Automatically

1. **Pre-commit hook** - Before every commit (if hooks enabled)
2. **Session end** - When `/wogi-session-end` runs
3. **Task completion** - After quality gates pass in `/wogi-start` loop

### Your Responsibility

After ANY of these events, consider updating relevant skills:

1. **After fixing a mistake** - Add to skill's `knowledge/anti-patterns.md`
2. **After successful task** - Add to skill's `knowledge/patterns.md`
3. **After user correction** - Add to skill's `knowledge/learnings.md`

### How to Update Skills Manually

1. Identify the relevant skill (by file type, framework, pattern)
2. Open `skills/[name]/knowledge/learnings.md`
3. Add entry:
   ```markdown
   ### YYYY-MM-DD - Brief title

   **Context**: What was being done
   **Trigger**: manual
   **Issue**: What went wrong (or worked well)
   **Learning**: Pattern to remember
   **Files**: Affected files
   ```
4. If pattern is an anti-pattern, also add to `anti-patterns.md`

### No Relevant Skill?

If the learning doesn't match any installed skill:
1. Add to `feedback-patterns.md` with tag `#needs-skill`
2. After 3+ entries with same tag, ASK USER if they want to create a skill
3. If approved, run: `./scripts/flow skill-create <name>`

**Note:** Updating EXISTING skills is automatic and expected. Creating NEW skills requires user approval.

### Skill Structure

```
skills/[name]/
├── skill.md              # Core definition (always load)
├── knowledge/
│   ├── learnings.md      # Session learnings (auto-updated)
│   ├── patterns.md       # What works
│   └── anti-patterns.md  # What to avoid
├── rules/                # Coding conventions
├── commands/             # Slash commands
└── templates/            # Code templates
```

## Natural Language Config Updates

Users can say things like:
- "From now on, always run tests after completing a task"
- "Require review before any commit"
- "Always check accessibility on new components"

**Your response:**
1. Confirm understanding
2. Update `config.json` appropriately
3. Show what changed
4. Commit the change

Example:
```
User: "Always run tests after tasks"
Agent: "I'll add that to the workflow config."
→ Updates config.json: "afterTask": ["test"]
→ Commits: "config: require tests after task completion"
```

## Quality Gates

Before completing a task, check `config.json` quality gates:

```json
"qualityGates": {
  "feature": {
    "require": ["tests", "appMapUpdate", "requestLogEntry"]
  }
}
```

**Don't close task until all required gates pass.**

## Working on Tasks (Self-Completing Loop)

When you start a task with `/wogi-start TASK-XXX`, it runs a **self-completing loop** that continues until the task is truly done. You don't need to manually run `/wogi-done`.

### The Loop
```
/wogi-start TASK-XXX
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

### Key Behaviors

1. **TodoWrite is mandatory** - Every acceptance criteria becomes a tracked todo
2. **Self-verification is mandatory** - Don't mark done without confirming it works
3. **Retry on failure** - If something breaks, fix it before moving on
4. **Quality gates block completion** - Task isn't done until gates pass
5. **Progress is preserved** - Commits after each scenario, safe to stop mid-task

### Options
- `--no-loop` - Just load context, don't auto-complete (old behavior)
- `--pause-between` - Ask confirmation between scenarios
- `--max-retries N` - Limit retry attempts (default: 5)

## Ad-Hoc Work with /wogi-loop

For work that isn't a structured task (refactors, migrations, batch operations):

```
/wogi-loop "Migrate all fetch() to apiClient" --done-when "No fetch() calls remain, tests pass"
```

Same self-completing philosophy, but for free-form prompts instead of structured tasks.

### When to Use Which

| Situation | Command |
|-----------|---------|
| Task in ready.json with acceptance criteria | `/wogi-start TASK-XXX` |
| Ad-hoc refactor or migration | `/wogi-loop "prompt" --done-when "criteria"` |
| Quick one-off fix (no loop needed) | Just do it directly |

## Handling Feedback

When corrected:
1. Fix it
2. Offer to update: decisions.md / agents/*.md / config.json / CLAUDE.md
3. If accepted, update and commit
4. Log to feedback-patterns.md

## Session End / Checkpoint

Only when user says to wrap up:

1. Finish current work
2. Check config.json `onSessionEnd` requirements
3. Ensure request-log is current
4. Ensure app-map is current
5. Update progress.md
6. Commit and push

## Browser Testing

When browser testing is needed:

1. Define flow in `.workflow/tests/flows/[name].json`
2. Run tests via browser extension
3. Log results with #e2e tag

## File Locations

| What | Where | When |
|------|-------|------|
| **Workflow config** | `.workflow/config.json` | Session start |
| Task queue | `.workflow/state/ready.json` | Session start |
| Request history | `.workflow/state/request-log.md` | Session start, after changes |
| Component registry (curated) | `.workflow/state/app-map.md` | Before creating components |
| Component index (auto) | `.workflow/state/component-index.json` | Auto-generated, for discovery |
| Component details | `.workflow/state/components/` | When working on component |
| Project rules | `.workflow/state/decisions.md` | Session start |
| Feedback patterns | `.workflow/state/feedback-patterns.md` | After learning |
| Handoff notes | `.workflow/state/progress.md` | Session start/end |
| Code traces | `.workflow/traces/` | When analyzing flows |
| Browser test flows | `.workflow/tests/flows/` | When testing |

## Component Management (Hybrid Approach)

Two layers work together:

### 1. `app-map.md` - Curated (Human-maintained)
- Rich descriptions and usage guidance
- "When to use which variant"
- Key components only
- May lag behind codebase

### 2. `component-index.json` - Auto-generated
- Always current (after scan)
- All components found
- No context, just paths and exports
- Use for discovery

### Workflow
1. Run `/wogi-map-index scan` to refresh the auto-index
2. Run `/wogi-map-sync` to compare with curated app-map
3. Add important missing components to app-map with descriptions
4. Remove stale entries from app-map

## Code Traces

Generate task-focused documentation of how code flows work:

```bash
./scripts/flow trace "user authentication flow"
./scripts/flow trace "payment processing"
./scripts/flow trace "how data gets from form to database"
```

Traces include:
- Flow overview (high-level summary)
- Execution steps (files, lines, code snippets)
- Mermaid diagram (visual flowchart)
- Related files
- Security/performance notes

Use traces for:
- Understanding before editing
- Onboarding to new areas of codebase
- Debugging complex flows
- Documentation

## Hybrid Mode (Claude Plans, Local LLM Executes)

Hybrid mode saves 85-95% of tokens by having Claude create execution plans that are executed by a local LLM (Ollama or LM Studio).

### How It Works

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

### Enable Hybrid Mode

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

### Recommended Models

- **NVIDIA Nemotron 3 Nano** - Best instruction following
- **Qwen3-Coder 30B** - Best code quality
- **DeepSeek Coder** - Good balance

### Token Savings

| Task Size | Normal Mode | Hybrid Mode | Savings |
|-----------|-------------|-------------|---------|
| Small (3 files) | ~8,000 | ~1,200 | 85% |
| Medium (8 files) | ~20,000 | ~1,800 | 91% |
| Large (15+ files) | ~45,000 | ~2,500 | 94% |

### Configuration

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

### Templates

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

### Rollback

If execution fails or produces unwanted results:
```bash
./scripts/flow hybrid rollback
```

This removes created files and restores modified files.

## Modifying Workflow Instructions

You CAN and SHOULD modify these files when user requests:

| File | What to Update |
|------|----------------|
| `decisions.md` | Project-specific rules, patterns, conventions |
| `agents/*.md` | How specific roles work, their checklists |
| `config.json` | Mandatory steps, quality gates, automation |
| `CLAUDE.md` | Core workflow (only for fundamental changes) |

**Always commit changes with clear message:**
```bash
git commit -m "workflow: [what changed and why]"
```

## Profile Export/Import

Share refined workflow with team:

```bash
# Export your refined setup
./scripts/flow export-profile "team-config"

# Creates: wogi-profiles/team-config.zip containing:
# - CLAUDE.md
# - agents/
# - config.json
# - decisions.md (optional)

# Team member imports:
./scripts/flow import-profile team-config.zip
```

## Team Collaboration

1. **Pull before starting**: `git pull`
2. **Claim tasks**: Move to inProgress with your name
3. **Push frequently**: Keep state in sync
4. **Share learnings**: Export profile when workflow is refined
