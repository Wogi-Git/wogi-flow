Show dependency tree for a task. Provide task ID: `/wogi-deps TASK-015`

Search all tasks.json files in `.workflow/changes/` to find:
1. What this task depends on
2. What other tasks depend on this task

Output:
```
🔗 Dependencies for TASK-015

Depends On:
  ✓ TASK-012: Add forgot password link (completed)
  → TASK-014: User API endpoint (in progress)

Blocking:
  • TASK-018: Profile settings modal
  • TASK-020: Account deletion

Status: BLOCKED (waiting on TASK-014)
```

If task has no dependencies, show:
```
🔗 Dependencies for TASK-015

Depends On: None

Blocking:
  • TASK-018: Profile settings modal

Status: READY
```
