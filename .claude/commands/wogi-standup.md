Generate a daily standup summary.

Gather from:
1. `.workflow/state/request-log.md` - Recent entries (last 24h or specify days)
2. `.workflow/state/ready.json` - In progress and ready tasks
3. `.workflow/state/progress.md` - Any noted blockers

Output format:
```
📅 Standup Summary

Yesterday:
  • Completed TASK-011: Login form validation
  • Fixed bug BUG-003: Password reset email
  • Added Button variants to app-map

Today:
  • Continue TASK-012: Forgot password link
  • Start TASK-015: User profile page

Blockers:
  • Waiting on API endpoint for user preferences

Notes:
  • Decided to use React Query for data fetching (see decisions.md)
```

Optional: Pass number of days to look back `/wogi-standup 3`
