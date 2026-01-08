# Session Persistence

Preserve work and context across sessions.

---

## The Problem

When a session ends:
- AI loses conversation context
- Progress might be forgotten
- Work must be re-explained

---

## The Solution

Session persistence through:
- Session state tracking
- Durable sessions for tasks
- Morning briefing for restoration
- Progress.md for handoff notes

---

## Configuration

```json
{
  "sessionState": {
    "enabled": true,
    "autoRestore": true,
    "maxGapHours": 24,          // Max hours before "cold start"
    "trackFiles": true,
    "trackDecisions": true,
    "maxRecentFiles": 20,
    "maxRecentDecisions": 10
  },
  "durableSteps": {
    "enabled": true,
    "autoResume": true
  },
  "morningBriefing": {
    "enabled": true,
    "showLastSession": true,
    "showChanges": true,
    "showRecommendedTasks": 3
  }
}
```

---

## Session State

Tracked in `.workflow/state/session-state.json`:

```json
{
  "lastActivity": "2024-01-15T14:30:00Z",
  "currentTask": "TASK-015",
  "recentFiles": [
    "src/services/AuthService.ts",
    "src/components/LoginForm.tsx"
  ],
  "recentDecisions": [
    "Use JWT for auth tokens",
    "Store tokens in localStorage"
  ],
  "tasksCompleted": ["TASK-014", "TASK-013"],
  "tasksInProgress": ["TASK-015"]
}
```

---

## Auto-Restore

When `autoRestore` is enabled:

```
New session starts
         ↓
Check last activity time
         ↓
┌─────────────────────────────────────────┐
│ Gap < maxGapHours?                      │
├─────────────────────────────────────────┤
│ YES → Warm restore                      │
│       - Load session state              │
│       - Show recent context             │
│       - Suggest continuing task         │
├─────────────────────────────────────────┤
│ NO  → Cold start                        │
│       - Show morning briefing           │
│       - Summarize changes               │
│       - Recommend tasks                 │
└─────────────────────────────────────────┘
```

---

## Warm Restore

For sessions within `maxGapHours`:

```
🔄 Resuming Session

Last active: 2 hours ago
Current task: TASK-015 (Add authentication)

Recent files:
  - src/services/AuthService.ts
  - src/components/LoginForm.tsx

Recent decisions:
  - Use JWT for auth tokens
  - Store tokens in localStorage

Continue with TASK-015?
```

---

## Durable Sessions

For crash recovery and long-running tasks:

```json
{
  "durableSteps": {
    "enabled": true,
    "autoResume": true,
    "checkSuspensionsOnStart": true
  }
}
```

### How It Works

1. Task start creates `durable-session.json`
2. Each step is tracked with status
3. On crash/restart, session is detected
4. Resume from last completed step

### Resume Context

```
🔄 Resuming from durable session

Task: TASK-015
Progress: 3/7 steps completed
Resuming from: "Add form validation"

Last completed:
  ✓ Create AuthService
  ✓ Create LoginForm
  ✓ Add basic state

Continue?
```

---

## Morning Briefing

Start each day with context:

```bash
/wogi-standup
```

### Output

```
☀️ Morning Briefing - 2024-01-16

═══════════════════════════════════════

📅 Last Session (2024-01-15)
  • Completed: TASK-014 (Fix login bug)
  • In Progress: TASK-015 (Add authentication)
  • Hours worked: 3.5

📝 Changes Since Last Session
  • 2 commits pushed
  • 3 files modified by others

📋 Recommended Tasks
  1. TASK-015 (In Progress) - Add authentication
  2. TASK-016 (Ready) - Add password reset
  3. TASK-017 (Ready) - Dashboard metrics

⚠️ Blockers
  None detected

═══════════════════════════════════════

Ready to continue with TASK-015?
```

---

## Progress.md

Handoff notes for session transitions:

```markdown
# Progress Notes

## Current Focus
Working on TASK-015: Add user authentication

## Where I Left Off
- Created AuthService with login/logout
- LoginForm component renders but not connected
- Need to: Add form validation, connect to API

## Important Context
- Using JWT tokens with 1hr expiry
- Refresh tokens stored in httpOnly cookie
- Auth state managed with Zustand

## Blockers
None

## Next Steps
1. Add form validation
2. Connect to API
3. Handle loading states
4. Test error scenarios

---

*Last updated: 2024-01-15 14:30*
```

### Keep Progress Updated

Update before:
- Ending a session
- Running /compact
- Handing off to teammate

---

## Commands

```bash
# Check session status
flow session status

# Restore previous session
flow session restore

# Clear session (fresh start)
flow session clear

# Morning briefing
/wogi-standup
```

---

## Suspended Tasks

When tasks are suspended:

```bash
flow resume --status

# Output:
# 📊 Task Session Status
# ─────────────────────────────────
# Task: TASK-015
# Status: SUSPENDED
# Type: manual
# Reason: Waiting for design approval
#
# Run: flow resume --approve to continue
```

---

## Session History

Archived sessions for reference:

```
.workflow/state/session-history/
├── session-2024-01-15-001.json
├── session-2024-01-15-002.json
└── session-2024-01-14-001.json
```

### View History

```bash
flow session stats

# Output:
# Session Statistics
# ─────────────────────────────────
# Total sessions: 47
# Completed: 45
# Failed: 2
# Cancelled: 0
# Avg steps: 4.2
```

---

## Best Practices

1. **Update Progress Before Leaving**: Always update progress.md
2. **Commit Before Session End**: Don't leave uncommitted work
3. **Use Morning Briefing**: Start fresh with context
4. **Don't Fight Durable Sessions**: They're there to help
5. **Clear When Needed**: Use `flow session clear` for fresh starts

---

## Troubleshooting

### Session Not Restoring

Check if session state exists:
```bash
cat .workflow/state/session-state.json
```

Check `maxGapHours` setting.

### Durable Session Blocking

If a stale session is blocking:
```bash
flow session clear
```

### Morning Briefing Not Showing

Enable in config:
```json
{
  "morningBriefing": {
    "enabled": true
  }
}
```

---

## Related

- [Context Management](./context-management.md) - Context monitoring
- [Durable Sessions](../02-task-execution/02-execution-loop.md#durable-sessions)
- [Configuration](../configuration/all-options.md) - All settings
