Show a morning briefing with everything needed to start the day.

Run `./scripts/flow morning` to generate the briefing.

This command gathers context from:
1. `.workflow/state/session-state.json` - Where you left off
2. `.workflow/state/ready.json` - Pending tasks sorted by priority
3. `.workflow/state/progress.md` - Key context and blockers
4. Git log - Changes since last session

Output includes:
```
MORNING BRIEFING

Last active: Mon Jan 6, 10:30 AM (14 hours ago)

WHERE YOU LEFT OFF
  Task: wf-a1b2c3d4 - User Profile Page
  Status: in_progress
  Files: src/components/Profile.tsx, src/api/user.ts

KEY CONTEXT
  - API endpoint for preferences not ready yet
  - Using shadcn/ui for modal components

BLOCKERS
  - Waiting on backend team for /preferences endpoint

CHANGES SINCE LAST SESSION
  - 2 new commits
  - 1 new bug filed

RECOMMENDED NEXT
  1. [P0] wf-a1b2c3d4: User Profile Page (in progress)
  2. [P1] wf-c3d4e5f6: Fix null check in API
  3. [P2] wf-e5f6g7h8: Add dark mode toggle

SUGGESTED PROMPT
  Continue implementing wf-a1b2c3d4: User Profile Page.

  Context:
  - API endpoint not ready yet
  - Using shadcn/ui for modal

  Files to review:
  - src/components/Profile.tsx
```

Options:
- `--json` - Output JSON for programmatic access

Configuration in `.workflow/config.json`:
```json
"morningBriefing": {
  "enabled": true,
  "showLastSession": true,
  "showChanges": true,
  "showRecommendedTasks": 3,
  "generatePrompt": true,
  "showBlockers": true,
  "showKeyContext": true
}
```

Set `enabled: false` to disable this command.
