# Project Instructions

You are an AI development assistant using the Wogi Flow methodology v1.9. This is a self-improving workflow that learns from feedback and adapts to your team's preferences.

---

## ⛔ MANDATORY: Task Gating (READ THIS FIRST)

**STOP. Before doing ANY implementation work, you MUST follow these steps:**

### Step 1: Is this an implementation request?

**YES - Implementation requests:**
- "Add X to Y"
- "Fix the bug in..."
- "Create a component for..."
- "Implement feature X"
- "Build me a [system/feature]"
- Any request that requires writing/modifying code

**NO - Handle normally:**
- "What does X do?"
- "How does Y work?"
- "Show me the code for..."
- Questions, exploration, reading files

If **NO** → Proceed normally without task gating.
If **YES** → Continue to Step 2.

### Step 2: Does a task already exist?

Check `.workflow/state/ready.json` for existing tasks.

- If **YES** → Use `/wogi-start TASK-XXX`
- If **NO** → Continue to Step 3

### Step 3: Assess task size

| Size | Criteria | Action |
|------|----------|--------|
| **Small** | < 3 files, < 1 hour, obvious scope | Create task inline, proceed with `/wogi-start` |
| **Medium** | 3-10 files, 1-4 hours, some complexity | **STOP** - Create story first |
| **Large** | > 10 files, > 4 hours, new feature | **STOP** - Create story first |

### For Medium/Large Tasks:

```
⛔ This looks like a medium/large task.

Before I start implementing, I need to create a story with acceptance criteria.

**Proposed story:** "[title based on request]"

Should I create this story with detailed acceptance criteria for your approval?
```

Then:
1. Run `/wogi-story "[title]"` to create acceptance criteria
2. **WAIT for user approval** on the story
3. Only then proceed with `/wogi-start`

### Step 4: Implementation Checklist

Before writing ANY code, verify:
- [ ] Task exists (in ready.json or just created)
- [ ] For medium/large: Story with acceptance criteria approved
- [ ] User has confirmed to proceed

**This is NON-NEGOTIABLE when strict mode is enabled (default).**

---

## Quick Start

```bash
# New project
./scripts/flow install

# Existing project
./scripts/flow onboard
```

## Core Principles

1. **State files are memory** - Read `.workflow/state/` first
2. **Config drives behavior** - Follow `.workflow/config.json` rules
3. **Log every change** - Append to `request-log.md`
4. **Reuse components** - Check `app-map.md` before creating
5. **Learn from feedback** - Update instructions when corrected

## Essential Commands

| Command | Purpose |
|---------|---------|
| `/wogi-ready` | Show available tasks |
| `/wogi-start TASK-X` | Start task (self-completing loop) |
| `/wogi-story "title"` | Create story with acceptance criteria |
| `/wogi-status` | Project overview |
| `/wogi-health` | Check workflow health |

See `.claude/docs/commands.md` for complete command reference.

## Session Startup

```bash
cat .workflow/config.json      # Read config
cat .workflow/state/ready.json # Check tasks
cat .workflow/state/decisions.md # Project rules
```

## Task Execution Rules

**These apply to ALL implementation work:**

### Before Starting:
1. Check `app-map.md` for existing components
2. Check `decisions.md` for coding patterns
3. Load task acceptance criteria

### While Working:
1. Follow acceptance criteria exactly
2. Use existing components from app-map
3. Follow patterns from decisions.md
4. Validate after EVERY file edit (run lint/typecheck)

### After Completing:
1. Update `request-log.md` with tags
2. Update `app-map.md` if new components
3. Run quality gates (lint, typecheck, test)
4. **Run regression tests** (if enabled in config)
5. **Suggest browser tests** (if UI task and tests exist)
6. Provide completion report

### Regression Testing (v1.9+)
After task completion, optionally test 3 random previously-completed tasks:
```bash
./scripts/flow regression        # Test random completed tasks
./scripts/flow regression --all  # Test all completed
```
Configure in `config.json → regressionTesting`:
- `enabled`: true/false
- `sampleSize`: Number of tasks to test (default: 3)
- `runOnTaskComplete`: Auto-run after each task
- `onFailure`: "warn" | "block" | "fix"

### Browser Testing (v1.9+)
For UI tasks, suggest browser tests if available:
- Check `.workflow/tests/flows/` for test flows
- If task modified `.tsx`/`.jsx` files, suggest: `/wogi-test-browser [flow]`
- Configure in `config.json → browserTesting`

### Story Decomposition (v1.9+)
For complex stories, auto-decompose into granular sub-tasks:
- Use `/wogi-story "title" --deep` for explicit decomposition
- With `storyDecomposition.autoDetect: true`, Claude suggests when beneficial
- With `storyDecomposition.autoDecompose: true`, fully automatic

## Auto-Validation (CRITICAL)

After editing ANY TypeScript/JavaScript file:
```bash
npx tsc --noEmit 2>&1 | head -20
npx eslint [file] --fix
```

**Do NOT edit another file until current file passes validation.**

## Request Logging

After EVERY request that changes files:
```markdown
### R-[XXX] | [YYYY-MM-DD HH:MM]
**Type**: new | fix | change | refactor
**Tags**: #screen:[name] #component:[name]
**Request**: "[what user asked]"
**Result**: [what was done]
**Files**: [files changed]
```

## Component Reuse

**Before creating ANY component:**
1. Check `app-map.md`
2. Search codebase for existing
3. Priority: Use existing → Add variant → Extend → Create new (last resort)

## Creating Stories

Use `/wogi-story "title"` to create. Format:
```markdown
# [TASK-XXX] [Title]

## User Story
**As a** [user] **I want** [action] **So that** [benefit]

## Acceptance Criteria
### Scenario 1: [Happy path]
**Given** [state] **When** [action] **Then** [outcome]
```

See `agents/story-writer.md` for complete guidance.

## Self-Completing Task Loop

When you run `/wogi-start TASK-XXX`:
```
Load context → Decompose into todos → FOR EACH scenario:
  → Implement → Self-verify → Fix if broken → Mark complete
→ Run quality gates → Update logs → Commit
```

Options: `--no-loop`, `--pause-between`, `--max-retries N`

## Agent Personas

Load from `agents/` when needed:
- `orchestrator.md` - Planning
- `story-writer.md` - Story creation
- `developer.md` - Implementation
- `reviewer.md` - Code review
- `tester.md` - Testing

## Skills System

Check `config.json → skills.installed`. When a skill applies:
- Load `.claude/skills/[name]/skill.md`
- Load `.claude/skills/[name]/knowledge/patterns.md`
- Avoid `.claude/skills/[name]/knowledge/anti-patterns.md`

Skills are now in `.claude/skills/` for Claude Code hot-reload support (v2.1.0).

## Instruction Learning

When user corrects you:
1. Fix immediately
2. Offer to persist: decisions.md / agents/*.md / config.json / CLAUDE.md
3. Update and commit
4. Log to feedback-patterns.md

## File Locations

| What | Where |
|------|-------|
| Config | `.workflow/config.json` |
| Tasks | `.workflow/state/ready.json` |
| Logs | `.workflow/state/request-log.md` |
| Components | `.workflow/state/app-map.md` |
| Rules | `.workflow/state/decisions.md` |
| Progress | `.workflow/state/progress.md` |
| Roadmap | `.workflow/roadmap/roadmap.md` |

**Note**: When user asks to add something to the roadmap, add it to `.workflow/roadmap/roadmap.md` in the appropriate priority section.

## Workflow State Files

**Only these belong in `.workflow/state/`:**
- `ready.json`, `request-log.md`, `app-map.md`, `decisions.md`
- `progress.md`, `feedback-patterns.md`, `components/`

**NEVER create additional files in `.workflow/state/`**

## Commit Behavior (IMPORTANT)

**Check `config.json → commits` before committing:**

```json
"commits": {
  "requireApproval": {
    "feature": true,    // Features require user approval
    "bugfix": false,    // Small fixes can auto-commit
    "refactor": true,   // Refactors require approval
    "docs": false       // Docs can auto-commit
  },
  "autoCommitSmallFixes": true,
  "smallFixThreshold": 3  // Max files for "small fix"
}
```

**Rules:**
- If `requireApproval[taskType]` is `true` → ASK before committing
- If task changes > `smallFixThreshold` files → ASK before committing
- Show git diff and ask: "Ready to commit these changes?"
- Never commit without user awareness on features/refactors

## Quality Gates

Check `config.json → qualityGates` before closing any task:
```json
"qualityGates": {
  "feature": { "require": ["tests", "appMapUpdate"] }
}
```

## Advanced Features

Detailed documentation in `.claude/docs/knowledge-base/`:
- [Task Execution](/.claude/docs/knowledge-base/02-task-execution/) - Loops, hybrid mode, parallel execution
- [Development Tools](/.claude/docs/knowledge-base/05-development-tools/) - Figma analyzer, code traces, voice
- [Configuration](/.claude/docs/knowledge-base/configuration/all-options.md) - All 200+ config options
- `commands.md` - Full command reference

## Context Management

Use `/compact` when:
- After completing 2-3 tasks
- After 15-20 messages
- Before starting large tasks

Before compacting: Update progress.md, ensure request-log is current, commit work.

## Handling Feedback

When corrected:
1. Fix it
2. Offer to update: decisions.md / agents/*.md / config.json / CLAUDE.md
3. If accepted, update and commit
4. Log to feedback-patterns.md

## Session End

When user says to wrap up:
1. Finish current work
2. Ensure request-log is current
3. Update progress.md
4. Commit and push
