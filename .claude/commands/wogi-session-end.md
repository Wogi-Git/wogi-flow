Properly end a work session.

Steps:
1. **Check request-log** - Ensure all changes are logged
2. **Check log size** - If over 50 entries, suggest archiving
3. **Check app-map** - If new components created, verify they're added
4. **Update progress.md** - Add handoff notes for next session
5. **Commit changes** - Stage and commit all workflow files
6. **Offer to push** - Ask if should push to remote

Output:
```
📤 Ending Session

Checking request-log...
  ✓ 3 entries added today
  ⚠ Log has 67 entries - consider: ./scripts/flow archive --keep 50

Checking app-map...
  ✓ 1 new component added (ProfileCard)

Updating progress.md...
  Added handoff notes

Committing...
  ✓ Committed: "chore: End session - 3 changes logged"

Push to remote? (y/n)
```

Progress.md handoff format:
```markdown
## Session End: 2024-01-15 17:30

### Completed
- TASK-012: Forgot password link
- Fixed BUG-004

### In Progress
- TASK-015: User profile (70% done)

### Next Session
- Finish profile page styling
- Start TASK-018

### Notes
- API endpoint for preferences not ready yet
- Decided to use shadcn/ui for modal
```
