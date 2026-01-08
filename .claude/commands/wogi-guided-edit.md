Guide through multi-file changes step by step.

Usage:
- `/wogi-guided-edit "rename Button to BaseButton"` - Start guided edit
- `/wogi-guided-edit --from schema.prisma` - Detect affected files from schema change

## Examples

```
/wogi-guided-edit "rename UserService to UserManager"
/wogi-guided-edit "replace console.log with logger.debug"
/wogi-guided-edit "find deprecated API calls"
/wogi-guided-edit "update all imports from @old/lib to @new/lib"
```

## Workflow

1. **Analyze**: Find all files affected by the change
2. **Plan**: Show list of files with match counts
3. **Step Through**: For each file:
   - Show current match locations
   - Show proposed diff (if replace operation)
   - User: approve / reject / skip
4. **Apply**: Make approved changes
5. **Summary**: Show completion stats

## Commands During Session

Once a session starts, use these commands:

| Command | Action |
|---------|--------|
| `next` / `n` | Show next file to review |
| `approve` / `a` | Approve and apply changes |
| `reject` / `r` | Reject file, skip changes |
| `skip` / `s` | Skip for now (review later) |
| `status` | Show progress |
| `abort` / `q` | Cancel session |

## Session Persistence

Progress is saved to `.workflow/state/guided-edit-session.json`. You can:
- Close Claude and resume later
- Use `status` to see where you left off
- Use `abort` to cancel and start fresh

## Use Cases

### Large Refactors
Rename a component across 20+ files with confidence:
```
/wogi-guided-edit "rename Button to BaseButton"
```

### Library Upgrades
Update imports everywhere:
```
/wogi-guided-edit "replace import { X } from 'old-lib' with import { X } from 'new-lib'"
```

### Code Cleanup
Find and review deprecated patterns:
```
/wogi-guided-edit "find componentWillMount"
```

### Schema Changes
After changing an entity, update all related files:
```
/wogi-guided-edit "find UserEntity"
```

## Claude's Role

When running this command, Claude will:

1. Parse the description to understand the operation
2. Run the script to find affected files
3. Present each file for your review
4. Apply changes only when you approve
5. Track progress and provide summary

The goal is methodical, confident multi-file editing with human oversight.
