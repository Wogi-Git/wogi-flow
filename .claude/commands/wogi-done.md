Complete a task. Provide the task ID: `/wogi-done TASK-XXX`

Steps:
1. Read `.workflow/config.json` for quality gates
2. Check required gates for the task type:
   - tests: Verify tests pass (run `npm test` if configured)
   - requestLogEntry: Check `.workflow/state/request-log.md` has entry for this task
   - appMapUpdate: If new components created, verify they're in app-map.md
3. Read `.workflow/state/ready.json`
4. Move task from inProgress to recentlyCompleted
5. Update lastUpdated timestamp
6. Save ready.json
7. Git commit if there are staged changes

Output:
```
Running quality gates...
  ✓ tests passed
  ✓ requestLogEntry found
  ✓ appMapUpdate verified

✓ Completed: TASK-XXX

Committing changes...
✓ Changes committed: "feat: Complete TASK-XXX"
```

If gates fail, show what needs to be fixed before completing.
