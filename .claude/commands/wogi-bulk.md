Execute multiple tasks in sequence, following all workflow rules.

Usage:
- `/wogi-bulk` - Work through all ready tasks
- `/wogi-bulk 3` - Work through next 3 tasks
- `/wogi-bulk TASK-001 TASK-003 TASK-005` - Work specific tasks in order

## Execution Flow

1. **Plan the order**:
   - Read `ready.json` for available tasks
   - Sort by: dependencies first, then priority (high→medium→low)
   - Skip blocked tasks
   - Show plan and get user confirmation

2. **For each task**:
   ```
   ═══════════════════════════════════════
   TASK 1 of 5: TASK-012 - Add forgot password link
   ═══════════════════════════════════════
   ```
   
   a. **Before** (load context):
      - Check app-map.md for components
      - Check decisions.md for patterns
      - Load acceptance criteria
   
   b. **Implement**:
      - Follow acceptance criteria exactly
      - Reuse existing components
      - Follow coding patterns
   
   c. **After** (quality gates):
      - Update request-log.md
      - Update app-map.md if new components
      - Verify all acceptance criteria
      - Run tests if configured
      - Update ready.json
   
   d. **Checkpoint**:
      - Commit changes
      - Check context size
      - Compact if needed (after every 2-3 tasks)

3. **Between tasks**:
   - Brief summary of what was done
   - Ask: "Continue to next task?" (unless running unattended)

4. **Final summary**:
   ```
   ═══════════════════════════════════════
   BULK EXECUTION COMPLETE
   ═══════════════════════════════════════
   
   Completed: 5 tasks
   - TASK-012: Add forgot password link ✓
   - TASK-015: User profile page ✓
   - TASK-018: Settings modal ✓
   - TASK-020: Email preferences ✓
   - TASK-022: Notification settings ✓
   
   Skipped: 1 task
   - TASK-025: Blocked by TASK-024
   
   Request-log: 5 entries added
   Components: 2 new, 3 reused
   Commits: 5
   ```

## Example Output

```
📋 Bulk Execution Plan

Order (by dependencies + priority):
1. TASK-012: Add forgot password link [High] - no deps
2. TASK-014: Password reset API [High] - depends on TASK-012
3. TASK-015: User profile page [Medium] - no deps
4. TASK-018: Settings modal [Low] - depends on TASK-015

Skipping (blocked):
- TASK-025: Waiting on external API

Proceed with 4 tasks? (y/n)
```

## Options

- **Unattended mode**: `/wogi-bulk --auto` - Don't pause between tasks
- **Dry run**: `/wogi-bulk --plan` - Show order without executing
- **Feature only**: `/wogi-bulk --feature auth` - Only tasks in auth feature

## Important Rules

1. **Always follow Task Execution Rules** from CLAUDE.md
2. **Compact proactively** - After every 2-3 tasks to avoid context overflow
3. **Commit after each task** - Don't batch commits
4. **Stop on failure** - If a task fails quality gates, stop and report
5. **Respect dependencies** - Never start a task before its dependencies are done
