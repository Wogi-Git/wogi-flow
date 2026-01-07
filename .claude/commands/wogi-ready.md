Read `.workflow/state/ready.json` and show all tasks organized by status:

Run `./scripts/flow ready` to see the task queue.

1. **Ready** - Tasks that can be started (sorted by priority P0-P4)
2. **In Progress** - Tasks currently being worked on
3. **Blocked** - Tasks waiting on dependencies
4. **Recently Completed** - Last 5 completed tasks

For each task show: ID, title, priority (P0-P4), and dependencies if any.

Options:
- `--json` - Output JSON for programmatic access

Format output like:
```
Task Queue
===========

READY
  [P0] wf-a1b2c3d4: Critical bug fix
  [P1] wf-b2c3d4e5: Add forgot password link
  [P2] wf-c3d4e5f6: User profile page

IN PROGRESS
  wf-d4e5f6g7: Login form validation

BLOCKED
  wf-e5f6g7h8: Email notifications (waiting on wf-d4e5f6g7)

RECENTLY COMPLETED
  wf-f6g7h8i9: Setup authentication

Total active: 4 (2 ready, 1 in progress, 1 blocked)
```

Priority levels:
- P0: Critical (drop everything)
- P1: High (do today)
- P2: Medium (do this week)
- P3: Low (do when possible)
- P4: Backlog (someday)

Tasks are automatically sorted by priority, then by creation date.
