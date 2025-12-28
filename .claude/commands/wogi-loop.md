Run an autonomous loop until completion criteria are met. For ad-hoc work that isn't a structured task.

**Usage:**
```
/wogi-loop "Your prompt here" --done-when "completion criteria"
```

## What This Does

Inspired by [Ralph Wiggum](https://github.com/anthropics/claude-code/tree/main/plugins/ralph-wiggum), this command creates a self-reinforcing loop that continues until the work is actually done.

```
┌─────────────────────────────────────────────────────┐
│  /wogi-loop "prompt" --done-when "criteria"         │
├─────────────────────────────────────────────────────┤
│  LOOP:                                              │
│    1. Execute the prompt                            │
│    2. Check: Are completion criteria met?           │
│    3. If NO:                                        │
│       → Analyze what's still needed                 │
│       → Continue working (same prompt context)      │
│       → Go to step 2                                │
│    4. If YES:                                       │
│       → Run quality gates                           │
│       → Update request-log                          │
│       → Commit changes                              │
│       → Exit loop                                   │
└─────────────────────────────────────────────────────┘
```

## When to Use

| Use `/wogi-loop` | Use `/wogi-start` |
|------------------|-------------------|
| Ad-hoc work not in ready.json | Structured tasks in ready.json |
| Refactors, migrations, batch work | Features with acceptance criteria |
| "Fix all X across the codebase" | "Implement user login" |
| Clear success criteria (tests pass, no errors) | Given/When/Then scenarios |

## Examples

### Refactor all API calls
```
/wogi-loop "Migrate all fetch() calls to use the new apiClient. Follow the pattern in src/lib/apiClient.ts" --done-when "No fetch() calls remain outside apiClient, all tests pass"
```

### Fix all TypeScript errors
```
/wogi-loop "Fix TypeScript errors in the codebase" --done-when "tsc --noEmit returns 0 errors"
```

### Add tests to uncovered files
```
/wogi-loop "Add unit tests to files with <50% coverage" --done-when "All files have >80% coverage, npm test passes"
```

### Documentation generation
```
/wogi-loop "Add JSDoc comments to all exported functions in src/lib/" --done-when "All exported functions have JSDoc, no eslint jsdoc warnings"
```

## Parameters

### `--done-when` (required)
The completion criteria. Be specific and verifiable:

**Good:**
- "All tests pass"
- "No TypeScript errors"
- "All files in src/components have Storybook stories"
- "README.md has installation, usage, and API sections"

**Bad:**
- "Code is clean" (subjective)
- "Everything works" (vague)
- "It's done" (not verifiable)

### `--max-iterations N` (optional, default: 20)
Safety limit to prevent infinite loops:
```
/wogi-loop "..." --done-when "..." --max-iterations 10
```

### `--verify-command "cmd"` (optional)
Shell command to verify completion:
```
/wogi-loop "Fix all lint errors" --done-when "No lint errors" --verify-command "npm run lint"
```

When provided, the loop uses this command's exit code to verify completion (0 = done).

### `--pause-every N` (optional)
Pause for user confirmation every N iterations:
```
/wogi-loop "..." --done-when "..." --pause-every 5
```

## Execution Flow

### 1. Parse and Validate
- Extract prompt and completion criteria
- Validate `--done-when` is provided
- Set max iterations (default: 20)

### 2. Initial Assessment
- Read the prompt
- Understand the scope of work
- Create TodoWrite checklist of high-level steps
- Check app-map and decisions.md for relevant context

### 3. Execute Loop

**Each iteration:**
```
Iteration 1/20
─────────────
Working: [current focus]
→ [action taken]
→ [result]

Checking completion criteria...
✗ Not yet: [what's still needed]

Iteration 2/20
─────────────
Working: [next focus]
...
```

### 4. Verify Completion

When criteria appear met:
- If `--verify-command` provided: run it, check exit code
- Otherwise: self-verify by checking the criteria explicitly
- If verification fails: continue loop

### 5. Finalize

When truly done:
```
✓ Loop complete after 7 iterations

Completion verified:
  ✓ No fetch() calls outside apiClient
  ✓ All tests pass (147 passing)

Updating request-log...
Committing changes...

Done: "refactor: Migrate all fetch calls to apiClient"
```

## Request Log Entry

After completion, automatically adds entry:
```markdown
### R-[XXX] | [timestamp]
**Type**: refactor
**Tags**: #loop #[inferred-tags]
**Request**: "[original prompt]"
**Result**: Completed after N iterations. [summary]
**Files**: [files changed]
```

## Safety Features

### Max Iterations
- Default limit: 20 iterations
- Prevents infinite loops
- When hit: stops, reports progress, leaves work in current state

### Progress Commits
- Commits after every 3 iterations
- Even if loop stops early, work is preserved

### Context Management
- Monitors context size
- After 5+ iterations, may suggest compaction
- Progress tracked in TodoWrite survives compaction

### Stuck Detection
- If 3 iterations make no progress: stop and report
- "Appears stuck. Last 3 iterations made no changes. Issue: [analysis]"

## When Things Go Wrong

### Max iterations reached
```
⚠ Max iterations (20) reached

Progress so far:
- Migrated 45/52 fetch calls
- 7 remaining in: [files]

Work committed. Run again to continue, or investigate remaining files.
```

### Stuck in loop
```
⚠ Loop appears stuck after iteration 8

Last 3 iterations made no progress toward:
  "All tests pass"

Current state:
- 3 tests still failing
- Same tests failing each iteration

Likely issue: [analysis]

Stopping for investigation.
```

### Context too large
```
⚠ Context getting large at iteration 12

Progress committed. Suggest:
1. Run /wogi-compact
2. Then: /wogi-loop "Continue: [original prompt]" --done-when "..."
```

## Comparison with /wogi-start

| Aspect | /wogi-start | /wogi-loop |
|--------|-------------|------------|
| Input | Task ID from ready.json | Ad-hoc prompt |
| Structure | Acceptance criteria scenarios | Free-form completion criteria |
| Tracking | Task moves through ready.json | Just request-log entry |
| Best for | Features, user stories | Refactors, migrations, batch work |
| Verification | Per-scenario + quality gates | Completion criteria + optional command |

## Tips for Good Prompts

### Be Specific
```
❌ "Clean up the code"
✓ "Remove all unused imports and variables flagged by eslint"
```

### Include Patterns
```
❌ "Add error handling"
✓ "Add try/catch to all async functions, using the ErrorBoundary pattern from src/lib/errors.ts"
```

### Make Criteria Verifiable
```
❌ --done-when "Code is better"
✓ --done-when "npm run lint exits with 0 errors, npm test passes"
```

### Scope Appropriately
```
❌ "Refactor the entire codebase" (too broad)
✓ "Refactor src/api/ to use the new Response type" (scoped)
```
