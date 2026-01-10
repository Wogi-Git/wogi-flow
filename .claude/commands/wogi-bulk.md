Execute multiple tasks in sequence, following all workflow rules.

**v2.1**: Now uses task queue for automatic continuation between tasks.

## Usage

- `/wogi-bulk` - Work through all ready tasks
- `/wogi-bulk 3` - Work through next 3 tasks
- `/wogi-bulk wf-001 wf-002 wf-003` - Work specific tasks in order

**Natural Language Alternative** (no slash command needed):
- "do story 1-3" or "work on tasks 1-5"
- "do wf-001, wf-002, wf-003"
- "work on these 3 stories"

## How It Works (v2.1)

1. **Initialize Queue**:
   - Parse task IDs from arguments or natural language
   - Store in durable session's `taskQueue`
   - Run `flow queue init <task-ids>`

2. **Start First Task**:
   - Run `/wogi-start <first-task-id>`
   - Full execution loop with all quality gates

3. **Automatic Continuation**:
   - When task completes, stop hook checks queue
   - If more tasks, outputs next task instruction
   - Continues until queue is empty

4. **Quality Per Task**:
   - Each task runs complete execution loop
   - Spec generation (if needed)
   - All acceptance criteria verification
   - Quality gates and validation
   - Request log and app-map updates

## Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│  /wogi-bulk 3                                               │
├─────────────────────────────────────────────────────────────┤
│  1. Get 3 ready tasks sorted by priority                    │
│  2. Initialize task queue: [wf-001, wf-002, wf-003]         │
│  3. Start wf-001 (full loop)                                │
│     → All scenarios implemented and verified                │
│     → Quality gates pass                                    │
│     → Committed                                             │
│  4. Stop hook detects queue has more tasks                  │
│  5. Auto-continue to wf-002 (full loop)                     │
│     → ...                                                   │
│  6. Auto-continue to wf-003 (full loop)                     │
│     → ...                                                   │
│  7. Queue empty - stop                                      │
└─────────────────────────────────────────────────────────────┘
```

## Output

**Start:**
```
📋 Task Queue Initialized

Tasks (3):
  1. wf-001 - Add user login [P1]
  2. wf-002 - Password reset [P2]
  3. wf-003 - Session management [P2]

Starting first task...
```

**Between Tasks (automatic):**
```
✓ Task complete!

Continuing to next task in queue: wf-002
(2 task(s) remaining)

Run: /wogi-start wf-002
```

**Final (after last task):**
```
✓ All tasks complete!

Queue Summary:
  ✓ wf-001 - Add user login
  ✓ wf-002 - Password reset
  ✓ wf-003 - Session management

3/3 tasks completed successfully.
```

## Options

- `--auto` - Don't pause between tasks (default behavior in v2.1)
- `--pause` - Pause and ask before each task
- `--plan` - Show order without executing
- `--feature <name>` - Only tasks in specified feature

## Configuration

In `config.json`:
```json
{
  "taskQueue": {
    "enabled": true,
    "autoContinue": true,
    "pauseBetweenTasks": false,  // Default: automatic
    "maxQueueSize": 10,
    "showProgressSummary": true
  }
}
```

## CLI Commands

```bash
# Initialize queue directly
flow queue init wf-001 wf-002 wf-003

# Check queue status
flow queue status

# Parse natural language
flow queue parse "do story 1-3"

# Clear queue
flow queue clear

# Advance manually
flow queue advance
```

## Important Rules

1. **Full loop per task** - Each task runs complete execution with all quality gates
2. **Automatic continuation** - Default is no pause between tasks
3. **Commit after each task** - Progress saved even if interrupted
4. **Stop on failure** - If quality gates fail, stop and report
5. **Respect dependencies** - Tasks sorted by dependencies then priority
6. **Context management** - Consider `/wogi-compact` after 3+ tasks
