Start working on a task. Provide the task ID as argument: `/wogi-start TASK-XXX`

## Self-Completing Loop (Default Behavior)

This command runs a **self-completing loop** - it continues working until the task is truly done. You don't need to run `/wogi-done` separately.

### Execution Flow

```
┌─────────────────────────────────────────────────────┐
│  /wogi-start TASK-XXX                               │
├─────────────────────────────────────────────────────┤
│  1. Load context                                    │
│  2. Decompose into steps (TodoWrite)                │
│  3. Work on each step                               │
│  ┌───────────────────────────────────────────────┐  │
│  │  FOR EACH acceptance criteria scenario:       │  │
│  │    → Mark in_progress                         │  │
│  │    → Implement                                │  │
│  │    → Self-verify (did it work?)               │  │
│  │    → If not working: fix and retry            │  │
│  │    → Mark completed                           │  │
│  └───────────────────────────────────────────────┘  │
│  4. Run quality gates                               │
│  5. If gates fail: fix and retry                    │
│  6. Update request-log, app-map, ready.json         │
│  7. Commit changes                                  │
│  8. ✓ Task complete                                 │
└─────────────────────────────────────────────────────┘
```

### Step 1: Load Context

1. Read `.workflow/state/ready.json`
2. Find the task in the ready array
3. Move it to inProgress array, save ready.json
4. Load task context:
   - Find story file in `.workflow/changes/*/TASK-XXX.md` or tasks.json
   - Extract user story, acceptance criteria, technical notes
5. Check `.workflow/state/app-map.md` for components mentioned
6. Check `.workflow/state/decisions.md` for relevant patterns

### Step 2: Decompose into TodoWrite Checklist

Extract each acceptance criteria scenario as a TodoWrite item:

```
Given [context] When [action] Then [outcome]
→ Todo: "Implement: [short description of scenario]"
```

Also add:
- "Update request-log.md with task entry"
- "Update app-map.md if new components created"
- "Run quality gates"
- "Commit changes"

### Step 3: Execute Each Scenario (Loop)

For each acceptance criteria:

1. **Mark in_progress** in TodoWrite
2. **Implement** the scenario
3. **Self-verify**:
   - Does the code actually do what the scenario describes?
   - If testable, run the relevant test
   - If UI, describe what should happen and confirm it would
4. **If not working**: Debug, fix, retry verification
5. **Mark completed** only when truly working

### Step 4: Run Quality Gates

Read `config.json` → `qualityGates` for task type and verify:

- `tests`: Run test command if configured, ensure passing
- `requestLogEntry`: Verify entry exists in request-log.md
- `appMapUpdate`: Verify new components are in app-map.md
- `noNewFeatures`: (for refactors) Verify no new features added

**If any gate fails**: Fix the issue and re-verify. Do not proceed until all required gates pass.

### Step 5: Finalize

1. Update ready.json: Move task to recentlyCompleted
2. Git add and commit with message: `feat: Complete TASK-XXX - [title]`
3. Show completion summary

### Output

**Start:**
```
✓ Started: TASK-XXX - [Title]

User Story:
As a [user], I want [action], so that [benefit]

Acceptance Criteria (4 scenarios):
□ 1. Given... When... Then...
□ 2. Given... When... Then...
□ 3. Given... When... Then...
□ 4. Given... When... Then...

Technical Notes:
- Components to use: [from app-map]
- Patterns to follow: [from decisions.md]

Beginning implementation loop...
```

**During (for each scenario):**
```
Working on scenario 1/4: [description]
→ Implementing...
→ Verifying...
→ ✓ Scenario complete

Working on scenario 2/4: [description]
→ Implementing...
→ Verifying... ✗ Failed (reason)
→ Fixing...
→ Verifying... ✓ Fixed
→ ✓ Scenario complete
```

**End:**
```
Running quality gates...
  ✓ tests passed
  ✓ requestLogEntry found
  ✓ appMapUpdate verified

✓ Completed: TASK-XXX - [Title]
  4/4 scenarios implemented
  Changes committed: "feat: Complete TASK-XXX - [title]"
```

## Options

### `--no-loop`
Disable the self-completing loop. Just load context and stop (old behavior):
```
/wogi-start TASK-XXX --no-loop
```

### `--max-retries N`
Limit retry attempts per scenario (default: 5):
```
/wogi-start TASK-XXX --max-retries 3
```

### `--pause-between`
Ask for confirmation between scenarios:
```
/wogi-start TASK-XXX --pause-between
```

## When Things Go Wrong

### Scenario keeps failing after max retries
- Stop and report: "Scenario X failed after N attempts. Issue: [description]"
- Leave task in inProgress
- User can investigate and re-run `/wogi-start TASK-XXX` to continue

### Quality gate keeps failing
- Report which gate is failing and why
- Attempt to fix automatically
- If can't fix after 3 attempts, stop and report

### Context getting too large
- After 3+ scenarios, check context size
- If getting large, commit current progress and suggest `/wogi-compact`
- Progress is preserved in files and ready.json

## Important

- **TodoWrite is mandatory**: Use it to track progress through scenarios
- **Self-verification is mandatory**: Don't mark scenarios done without checking they work
- **Quality gates are mandatory**: Task isn't done until gates pass
- **Commits preserve progress**: Even if you stop mid-task, work is saved
