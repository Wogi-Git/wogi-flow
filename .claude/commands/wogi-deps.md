Show dependency tree for a task. Provide task ID: `/wogi-deps wf-015`

Search all tasks.json files in `.workflow/changes/` to find:
1. What this task depends on
2. What other tasks depend on this task

Output:
```
🔗 Dependencies for wf-015

Depends On:
  ✓ wf-012: Add forgot password link (completed)
  → wf-014: User API endpoint (in progress)

Blocking:
  • wf-018: Profile settings modal
  • wf-020: Account deletion

Status: BLOCKED (waiting on wf-014)
```

If task has no dependencies, show:
```
🔗 Dependencies for wf-015

Depends On: None

Blocking:
  • wf-018: Profile settings modal

Status: READY
```
