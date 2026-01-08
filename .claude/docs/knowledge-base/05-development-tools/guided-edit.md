# Guided Edit Mode

Step-by-step guided editing for multi-file changes.

---

## Purpose

Guided Edit solves the challenge of large refactors:
- **Visibility**: See exactly which files will change
- **Control**: Approve or reject each change individually
- **Safety**: No bulk changes without review
- **Persistence**: Resume interrupted sessions

---

## Quick Start

```bash
# Start a guided edit session
/wogi-guided-edit "rename Button to BaseButton"

# Review files one by one
# Use: approve / reject / skip for each file
```

---

## Use Cases

### Large Refactors

Rename a component across many files:

```bash
/wogi-guided-edit "rename UserService to UserManager"
```

### Library Upgrades

Update imports everywhere:

```bash
/wogi-guided-edit "replace import { X } from 'old-lib' with import { X } from 'new-lib'"
```

### Code Cleanup

Find and review deprecated patterns:

```bash
/wogi-guided-edit "find componentWillMount"
```

### Schema Changes

After modifying an entity, find all usages:

```bash
/wogi-guided-edit "find UserEntity"
```

---

## Session Commands

Once a session starts:

| Command | Shortcut | Action |
|---------|----------|--------|
| `next` | `n` | Show next file to review |
| `approve` | `a`, `y` | Approve and apply changes |
| `reject` | `r` | Reject file, skip changes |
| `skip` | `s` | Skip for now |
| `status` | - | Show progress |
| `abort` | `q` | Cancel session |

---

## Workflow

```
1. Start Session
   └── Analyze description (rename/replace/find)
   └── Search codebase for matches
   └── Show file list with match counts

2. Review Loop
   └── Show file with match locations
   └── Show proposed diff (if replace)
   └── Wait for: approve / reject / skip

3. Complete
   └── Show summary (approved/rejected/skipped)
   └── Changes already applied to approved files
```

---

## Configuration

```json
{
  "guidedEdit": {
    "enabled": true,
    "sessionFile": ".workflow/state/guided-edit-session.json",
    "extensions": ["ts", "tsx", "js", "jsx", "vue", "svelte"],
    "srcDir": null  // null = auto-detect (src/ or project root)
  }
}
```

---

## Session Persistence

Progress is saved to `.workflow/state/guided-edit-session.json`:

```json
{
  "id": "ge-1704729600000",
  "description": "rename Button to BaseButton",
  "type": "rename",
  "search": "Button",
  "replace": "BaseButton",
  "files": [
    { "path": "src/components/Button.tsx", "status": "approved" },
    { "path": "src/pages/Home.tsx", "status": "pending" }
  ],
  "currentIndex": 1,
  "stats": { "approved": 1, "rejected": 0, "skipped": 0 }
}
```

You can:
- Close Claude and resume later
- Run `status` to see where you left off
- Run `abort` to cancel and start fresh

---

## Pattern Recognition

The tool recognizes common patterns:

| Pattern | Type | Example |
|---------|------|---------|
| `rename X to Y` | rename | "rename Button to BaseButton" |
| `replace X with Y` | replace | "replace console.log with logger.debug" |
| `find X` | find | "find deprecated API" |
| `update X` | update | "update imports from old-lib" |

---

## CLI Usage

```bash
# Via flow script
node scripts/flow-guided-edit.js start "description"
node scripts/flow-guided-edit.js next
node scripts/flow-guided-edit.js approve
node scripts/flow-guided-edit.js reject
node scripts/flow-guided-edit.js status
node scripts/flow-guided-edit.js abort
```

---

## Related

- [Code Traces](./code-traces.md) - Understanding code flow
- [Task Execution](../02-task-execution/) - Task workflow
- [Configuration](../configuration/all-options.md) - All options
