Complete a task manually. Provide the task ID: `/wogi-done wf-XXXXXXXX`

**Note:** This is usually not needed. `/wogi-start` now auto-completes tasks when all acceptance criteria pass and quality gates are met. Use `/wogi-done` only if:
- You used `--no-loop` with `/wogi-start`
- You want to force-complete a stuck task
- You're completing work done outside the loop

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

✓ Completed: wf-XXXXXXXX

Committing changes...
✓ Changes committed: "feat: Complete wf-XXXXXXXX"
```

If gates fail, show what needs to be fixed before completing.
