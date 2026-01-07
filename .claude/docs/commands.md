# Wogi Flow Commands Reference

Complete reference for all slash commands and CLI commands.

## Slash Commands

When user types these commands, execute the corresponding action immediately.

### Task Management

| Command | Action |
|---------|--------|
| `/wogi-ready` | Read `ready.json`, show tasks organized by status (ready, in progress, blocked). Summarize what's available to work on. |
| `/wogi-start [id]` | **Self-completing loop.** Load context, decompose into TodoWrite checklist, implement each scenario with self-verification, run quality gates, auto-complete when truly done. Use `--no-loop` for old behavior. |
| `/wogi-done [id]` | Manual completion (optional). Check quality gates, update ready.json, commit. Usually not needed since `/wogi-start` auto-completes. |
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

### Team Collaboration

| Command | Action |
|---------|--------|
| `/wogi-team login <code>` | Join a team with invite code. Downloads team config and triggers initial sync. |
| `/wogi-team logout` | Leave current team. Disables team features but preserves local data. |
| `/wogi-team setup [n]` | List or select a team setup configuration. |
| `/wogi-team sync` | Manually sync knowledge with team backend. |
| `/wogi-team proposals` | View pending team rule proposals. Vote with `proposals vote <id> <approve\|reject>`. |
| `/wogi-team status` | Show team connection status, sync info, and local proposals. |

### PRD Management

| Command | Action |
|---------|--------|
| `/wogi-prd load <file>` | Load PRD markdown file into memory. Chunks content for contextual retrieval. |
| `/wogi-prd context <task>` | Get relevant PRD context for a task description. |
| `/wogi-prd list` | List loaded PRDs with chunk counts. |
| `/wogi-prd show <id>` | Show chunks from a specific PRD. |
| `/wogi-prd remove <id>` | Remove a PRD from memory. |
| `/wogi-prd clear` | Clear all PRD data. |

### Export & Import

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
| `/wogi-config storybook on` | Enable auto-generation of Storybook stories for new components. |
| `/wogi-config storybook off` | Disable Storybook auto-generation. |
| `/wogi-config hooks on` | Enable pre-commit hooks. Runs `flow setup-hooks install`. |
| `/wogi-config hooks off` | Disable pre-commit hooks. |
| `/wogi-config tests-before-commit on/off` | Toggle running tests before commits. |
| `/wogi-config phases on/off` | Toggle phase-based planning. |

### Skills & Rules

| Command | Action |
|---------|--------|
| `/wogi-skills` | List installed and available skills. Show what commands each skill provides. |
| `/wogi-skills add [name]` | Install a skill package. Copy to `skills/`, update config.json. |
| `/wogi-skills remove [name]` | Remove installed skill. |
| `/wogi-skills info [name]` | Show skill details, commands, templates. |
| `/wogi-rules` | List all coding rules from `.claude/rules/` and installed skills. |
| `/wogi-rules [name]` | View specific rule file. |
| `/wogi-rules add [name]` | Create new rule file. |

### Hybrid Mode (Token Savings)

| Command | Action |
|---------|--------|
| `/wogi-hybrid-setup` | **Full setup for new projects.** Generates project-specific templates by analyzing codebase, then runs interactive setup to configure local LLM. |
| `/wogi-hybrid` | Enable hybrid mode. Runs interactive setup to detect local LLM providers. |
| `/wogi-hybrid-off` | Disable hybrid mode. Returns to normal Claude-only execution. |
| `/wogi-hybrid-status` | Show current hybrid mode configuration. |
| `/wogi-hybrid-edit` | Edit the current execution plan before running. |

### Planning & Documentation

| Command | Action |
|---------|--------|
| `/wogi-correction [TASK-XXX]` | Create detailed correction report for significant bug fix. |
| `/wogi-help` | Show all available Wogi Flow commands with descriptions. |

### Metrics & Insights

| Command | Action |
|---------|--------|
| `/wogi-metrics` | Show command success/failure statistics. |
| `/wogi-metrics --problems` | Show only commands with >30% failure rate. |
| `/wogi-metrics --reset` | Clear all metrics data. |
| `/wogi-insights` | Regenerate codebase-insights.md. |
| `/wogi-model-adapter` | Show current model adapter info. |
| `/wogi-model-adapter --stats` | Show per-model success/failure statistics. |
| `/wogi-multi-approach "task"` | Start multi-approach session for complex task. |
| `/wogi-multi-approach --analyze "task"` | Analyze task for multi-approach suitability. |

## CLI Commands

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

# Hybrid Mode
./scripts/flow hybrid enable      # Enable hybrid mode
./scripts/flow hybrid disable     # Disable hybrid mode
./scripts/flow hybrid status      # Show hybrid configuration
./scripts/flow hybrid execute     # Execute a plan file
./scripts/flow hybrid rollback    # Rollback last execution
./scripts/flow hybrid test        # Test hybrid installation
./scripts/flow templates generate # Generate project templates

# Worktree Isolation
./scripts/flow worktree enable    # Enable worktree isolation
./scripts/flow worktree disable   # Disable worktree isolation
./scripts/flow worktree list      # List active task worktrees
./scripts/flow worktree cleanup   # Remove stale worktrees
./scripts/flow worktree status    # Show worktree configuration

# Parallel Execution
./scripts/flow parallel config    # Show parallel config
./scripts/flow parallel check     # Check tasks for parallel potential
./scripts/flow parallel enable    # Enable parallel execution
./scripts/flow parallel disable   # Disable parallel execution

# Figma Analyzer
./scripts/flow figma scan         # Scan codebase for components
./scripts/flow figma show [name]  # Show component details
./scripts/flow figma extract <f>  # Extract from Figma MCP data
./scripts/flow figma match <f>    # Match against registry
./scripts/flow figma analyze <f>  # Full pipeline
./scripts/flow figma confirm <f>  # Interactive confirmation
./scripts/flow figma generate     # Generate code from decisions
./scripts/flow figma server       # Start MCP server
```

## Command Execution

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
