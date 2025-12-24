Start working on a task. Provide the task ID as argument: `/wogi-start TASK-XXX`

**Note:** The Task Execution Rules in CLAUDE.md apply whether you use this command or just ask to work on something. This command is a convenience for loading context.

Steps:
1. Read `.workflow/state/ready.json`
2. Find the task in the ready array
3. Move it to inProgress array
4. Save the updated ready.json
5. Load the task context:
   - Find story file in `.workflow/changes/*/TASK-XXX.md` or tasks.json
   - Show the user story, acceptance criteria, and technical notes
6. Check `.workflow/state/app-map.md` for components mentioned in technical notes
7. Check `.workflow/state/decisions.md` for relevant patterns

Output:
```
✓ Started: TASK-XXX - [Title]

User Story:
As a [user], I want [action], so that [benefit]

Acceptance Criteria:
1. Given... When... Then...
2. Given... When... Then...

Technical Notes:
- Components to use: [from app-map]
- Components to create: [list]
- Patterns to follow: [from decisions.md]

Ready to implement. What would you like to start with?
```

**Remember:** After completing, you must:
- Update request-log.md
- Update app-map.md (if new components)
- Verify acceptance criteria
- Run quality gates
- Update ready.json
