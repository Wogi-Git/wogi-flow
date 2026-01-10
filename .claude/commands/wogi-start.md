Start working on a task. Provide the task ID as argument: `/wogi-start wf-XXXXXXXX`

## Structured Execution (v2.1)

This command implements a **structured execution loop**:
- **Model-invoked skills**: Auto-loads relevant skills based on task context
- **Specification mode**: Generates spec before coding (for medium/large tasks)
- **Four-phase loop**: Spec → Test → Implement → Verify
- **File-based validation**: Every phase produces artifacts
- **Self-reflection**: Checkpoints to pause and verify approach

### Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│  /wogi-start wf-XXXXXXXX                                │
├─────────────────────────────────────────────────────────┤
│  1. Load context + Match skills (auto-invoke)           │
│  2. Generate specification (if medium/large task)       │
│  3. SPEC PHASE: Plan implementation steps               │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🪞 Reflection: Does spec fully address needs?    │  │
│  └───────────────────────────────────────────────────┘  │
│  4. TEST PHASE: Write/update tests first                │
│  5. IMPLEMENT PHASE: Code each acceptance criteria      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  FOR EACH scenario:                               │  │
│  │    → Mark in_progress                             │  │
│  │    → Implement                                    │  │
│  │    → Verify (run tests, typecheck)                │  │
│  │    → Save verification artifact                   │  │
│  │    → If failing: fix and retry                    │  │
│  │    → Mark completed                               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🪞 Reflection: Any bugs or regressions?          │  │
│  └───────────────────────────────────────────────────┘  │
│  6. VERIFY PHASE: Run all quality gates                 │
│  7. Save final verification artifact                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  🪞 Reflection: Does this match user request?     │  │
│  └───────────────────────────────────────────────────┘  │
│  8. Update request-log, app-map, ready.json             │
│  9. Commit changes                                      │
│  10. ✓ Task complete                                    │
└─────────────────────────────────────────────────────────┘
```

### Step 1: Load Context + Match Skills

1. Read `.workflow/state/ready.json`
2. Find the task in the ready array
3. Move it to inProgress array, save ready.json
4. Load task context:
   - Find story file in `.workflow/changes/*/wf-XXXXXXXX.md` or tasks.json
   - Extract user story, acceptance criteria, technical notes
5. Check `.workflow/state/app-map.md` for components mentioned
6. Check `.workflow/state/decisions.md` for relevant patterns
7. **Auto-invoke skills** based on task context:
   - Run skill matcher against task description
   - Load matched skills (patterns.md, anti-patterns.md, learnings.md)
   - Display matched skills with scores

**Skill Matching Output:**
```
🔧 Matched Skills:
   nestjs [●●●●○]
   keyword: "service", "entity", task type: "feature"
   react [●●○○○]
   keyword: "component"
```

### Step 1.5: Generate Specification (Medium/Large Tasks)

For medium/large tasks (check `config.json → specificationMode`):

1. Generate specification to `.workflow/specs/wf-XXXXXXXX.md`:
   - Acceptance criteria (structured Given/When/Then)
   - Implementation steps
   - Files to change (auto-detected)
   - Test strategy
   - Verification commands
2. Display spec summary
3. **Reflection checkpoint**: "Does this spec fully address the requirements?"
4. Wait for implicit approval (continue = approved)

**Spec Output:**
```
📋 Generated Specification:

Acceptance Criteria: 4 scenarios
Implementation Steps: 6 steps
Files to Change: 3 files (medium confidence)
Verification Commands: 4 commands

🪞 Reflection: Does this spec fully address the requirements?
   - Are there any edge cases not covered?
   - Is the scope clear and achievable?
```

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
2. **Implement** the scenario following matched skill patterns
3. **Run verification** (saves artifact to `.workflow/verifications/`):
   - Run lint: `npm run lint`
   - Run typecheck: `npm run typecheck` or `npx tsc --noEmit`
   - Run related tests if they exist
4. **Save verification artifact** (JSON file with exit codes, output)
5. **If not working**: Debug, fix, retry verification (max 5 attempts)
6. **Mark completed** only when verification passes

**Verification Artifact:**
```json
{
  "taskId": "wf-abc123",
  "phase": "implementation",
  "timestamp": "2026-01-10T...",
  "results": [
    {"command": "npm run lint", "exitCode": 0, "passed": true},
    {"command": "npm run typecheck", "exitCode": 0, "passed": true}
  ],
  "allPassed": true
}
```

### Step 4: Run Quality Gates + Final Verification

Read `config.json` → `qualityGates` for task type and verify:

- `tests`: Run test command if configured, ensure passing
- `requestLogEntry`: Verify entry exists in request-log.md
- `appMapUpdate`: Verify new components are in app-map.md
- `noNewFeatures`: (for refactors) Verify no new features added

**Save final verification artifact** to `.workflow/verifications/wf-XXXXXXXX-final.json`

**Reflection checkpoint:**
```
🪞 Reflection: Have I introduced any bugs or regressions?
   - Does the code follow project patterns from decisions.md?
   - Is there any code that could be simplified?
```

**If any gate fails**: Fix the issue and re-verify. Do not proceed until all required gates pass.

### Step 5: Final Reflection + Finalize

1. **Pre-completion reflection:**
   ```
   🪞 Reflection: Does this match what the user asked for?
      - Have all acceptance criteria been met?
      - Are there any loose ends to address?
   ```
2. Update ready.json: Move task to recentlyCompleted
3. Git add and commit with message: `feat: Complete wf-XXXXXXXX - [title]`
4. Show completion summary with verification results

### Output

**Start:**
```
✓ Started: wf-XXXXXXXX - [Title]

🔧 Matched Skills:
   nestjs [●●●●○] - keyword: "service", task type: "feature"

📋 Specification generated: .workflow/specs/wf-XXXXXXXX.md
   Acceptance Criteria: 4 scenarios
   Implementation Steps: 6 steps
   Files to Change: 3 (medium confidence)

User Story:
As a [user], I want [action], so that [benefit]

Acceptance Criteria (4 scenarios):
□ 1. Given... When... Then...
□ 2. Given... When... Then...
□ 3. Given... When... Then...
□ 4. Given... When... Then...

🪞 Reflection: Does spec fully address requirements? ✓

Beginning structured execution loop...
```

**During (for each scenario):**
```
[IMPLEMENT] Working on scenario 1/4: [description]
→ Implementing...
→ Running verification...
   ✓ lint passed
   ✓ typecheck passed
→ Artifact saved: .workflow/verifications/wf-XXXXXXXX-scenario-1.json
→ ✓ Scenario complete

[IMPLEMENT] Working on scenario 2/4: [description]
→ Implementing...
→ Running verification...
   ✗ typecheck failed: Property 'x' does not exist
→ Fixing...
→ Running verification... ✓
→ Artifact saved: .workflow/verifications/wf-XXXXXXXX-scenario-2.json
→ ✓ Scenario complete
```

**Reflection checkpoint (post-implementation):**
```
🪞 Reflection: Have I introduced any bugs or regressions?
   - Code follows patterns from decisions.md ✓
   - No unnecessary complexity detected ✓
```

**End:**
```
[VERIFY] Running final quality gates...
  ✓ tests passed (12/12)
  ✓ lint passed
  ✓ typecheck passed
  ✓ requestLogEntry found
  ✓ appMapUpdate verified

Final verification artifact: .workflow/verifications/wf-XXXXXXXX-final.json

🪞 Reflection: Does this match user request? ✓

✓ Completed: wf-XXXXXXXX - [Title]
  4/4 scenarios implemented
  Verification artifacts: 5 files
  Changes committed: "feat: Complete wf-XXXXXXXX - [title]"
```

## Options

### `--no-loop`
Disable the self-completing loop. Just load context and stop (old behavior):
```
/wogi-start wf-XXXXXXXX --no-loop
```

### `--no-spec`
Skip specification generation (for small tasks or quick fixes):
```
/wogi-start wf-XXXXXXXX --no-spec
```

### `--no-skills`
Skip automatic skill loading:
```
/wogi-start wf-XXXXXXXX --no-skills
```

### `--no-reflection`
Skip reflection checkpoints (faster but less thorough):
```
/wogi-start wf-XXXXXXXX --no-reflection
```

### `--max-retries N`
Limit retry attempts per scenario (default: 5):
```
/wogi-start wf-XXXXXXXX --max-retries 3
```

### `--pause-between`
Ask for confirmation between scenarios:
```
/wogi-start wf-XXXXXXXX --pause-between
```

### `--verify-only`
Only run verification without implementation (for debugging):
```
/wogi-start wf-XXXXXXXX --verify-only
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
