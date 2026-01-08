# Checkpoint & Rollback

Recovery system for undoing changes.

---

## Purpose

Checkpoints provide:
- Periodic snapshots during work
- Quick rollback on mistakes
- State preservation
- Git commit backups

---

## Configuration

```json
{
  "checkpoint": {
    "enabled": true,
    "interval": 5,                // Create every N steps
    "maxCheckpoints": 20,         // Keep last 20
    "autoCommit": true,           // Git commit at checkpoint
    "commitPrefix": "[checkpoint]",
    "includeStateFiles": true     // Include workflow state
  }
}
```

---

## How It Works

```
Step 1   Step 2   Step 3   Step 4   Step 5
   │        │        │        │        │
   ▼        ▼        ▼        ▼        ▼
   ○────────○────────○────────○────────●
                                    checkpoint

Step 6   Step 7   Step 8   Step 9   Step 10
   │        │        │        │        │
   ▼        ▼        ▼        ▼        ▼
   ○────────○────────○────────○────────●
                                    checkpoint
```

Every N steps (configured by `interval`), a checkpoint is created.

---

## What's Saved

### Git State

If `autoCommit` is true:
- All changes committed
- Commit message: `[checkpoint] Auto checkpoint at step N`
- Commit hash stored in checkpoint

### Workflow State

If `includeStateFiles` is true:
- `ready.json` - Task queues
- `request-log.md` - Change history
- `app-map.md` - Component registry
- `decisions.md` - Patterns
- `progress.md` - Progress notes
- `durable-session.json` - Session state
- `config.json` - Configuration

---

## Commands

### Create Checkpoint

```bash
flow checkpoint create "Before risky refactor"

# Output:
# ✅ Checkpoint created: cp-2024-01-15T10-30-00
#    Git commit: abc1234
```

### List Checkpoints

```bash
flow checkpoint list

# Output:
# Checkpoints
# ────────────────────────────────────────────────────────
#
# cp-2024-01-15T10-30-00
#   Time: 1/15/2024, 10:30:00 AM
#   Step: 10
#   Message: Before risky refactor
#   Includes: git, state
#
# cp-2024-01-15T10-00-00
#   Time: 1/15/2024, 10:00:00 AM
#   Step: 5
#   Message: Auto checkpoint at step 5
#   Includes: git, state
```

### Rollback

```bash
flow checkpoint rollback cp-2024-01-15T10-30-00

# Output:
# Rolling back to cp-2024-01-15T10-30-00...
# ✅ State files restored
# ✅ Git rolled back to abc1234
#
# Changes since checkpoint are now unstaged.
# Review with: git status
```

### Cleanup

```bash
flow checkpoint cleanup

# Output:
# ✅ Cleanup complete. 15 checkpoints remaining
```

### Status

```bash
flow checkpoint status

# Output:
# Checkpoint Status
# ────────────────────────────────────────
#   Enabled: Yes
#   Interval: Every 5 steps
#   Current step: 12
#   Last checkpoint: Step 10
#   Total checkpoints: 4
```

---

## Rollback Details

### What Happens

1. **State Files Restored**: Workflow files replaced with snapshot
2. **Git Soft Reset**: Changes since checkpoint become unstaged
3. **Session Updated**: Durable session updated to match

### What's Preserved

- Changes become unstaged (not lost)
- Can still see diff of what was undone
- Can re-apply changes selectively

### What's Lost

- Commits after checkpoint (can be recovered from reflog)
- State file changes (replaced with snapshot)

---

## Checkpoint Storage

```
.workflow/checkpoints/
├── checkpoint-log.json      # Checkpoint metadata
├── cp-2024-01-15T10-30-00/  # Snapshot directory
│   ├── state_ready.json
│   ├── state_request-log.md
│   ├── state_app-map.md
│   ├── state_decisions.md
│   └── config.json
└── cp-2024-01-15T10-00-00/
    └── ...
```

---

## Auto-Cleanup

Old checkpoints are automatically removed:

```json
{
  "checkpoint": {
    "maxCheckpoints": 20
  }
}
```

When limit exceeded:
1. Oldest checkpoint deleted
2. Snapshot directory removed
3. Log updated

---

## Manual vs Auto Checkpoints

### Automatic

- Created every N steps
- Message: "Auto checkpoint at step N"
- Happens during task execution

### Manual

```bash
flow checkpoint create "Before database migration"
```

- Created on demand
- Custom message
- Good before risky operations

---

## Best Practices

1. **Create Before Risk**: Manual checkpoint before dangerous work
2. **Keep Interval Reasonable**: 5-10 steps is good
3. **Review Before Rollback**: Check what you'll lose
4. **Don't Over-Rely**: Git history is still your friend
5. **Cleanup Regularly**: Don't let checkpoints pile up

---

## Troubleshooting

### Rollback Failed

Check checkpoint exists:
```bash
flow checkpoint list
```

Check state files are readable:
```bash
ls -la .workflow/checkpoints/cp-XXX/
```

### Git Rollback Issues

If git reset fails:
```bash
# Check git status
git status

# Manual reset
git reset --soft <commit-hash>
```

### State Mismatch

If state seems wrong after rollback:
```bash
# Compare files
diff .workflow/state/ready.json .workflow/checkpoints/cp-XXX/state_ready.json
```

---

## Recovery Without Checkpoints

If no checkpoint exists:

### From Git

```bash
# Find old commit
git log --oneline

# Restore file from commit
git checkout <commit-hash> -- path/to/file
```

### From Reflog

```bash
# See all git actions
git reflog

# Restore to previous state
git reset --hard HEAD@{N}
```

---

## Related

- [Damage Control](./damage-control.md) - Prevention
- [Durable Sessions](../02-task-execution/02-execution-loop.md#durable-sessions) - Session recovery
- [Configuration](../configuration/all-options.md) - All settings
