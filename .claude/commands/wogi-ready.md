Read `.workflow/state/ready.json` and show all tasks organized by status:

1. **Ready** - Tasks that can be started (no blockers)
2. **In Progress** - Tasks currently being worked on
3. **Blocked** - Tasks waiting on dependencies

For each task show: ID, title, priority, and dependencies if any.

Recommend which task to work on next based on priority and dependencies.

Format output like:
```
📋 Task Queue

Ready (3)
• TASK-012: Add forgot password link [High]
• TASK-015: User profile page [Medium]
• TASK-018: Settings modal [Low]

In Progress (1)
• TASK-011: Login form validation

Blocked (1)
• TASK-020: Email notifications (waiting on TASK-019)

Recommend: Start TASK-012 (high priority, no dependencies)
```
