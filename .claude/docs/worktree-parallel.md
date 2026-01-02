# Worktree Isolation & Parallel Execution

## Worktree Isolation (Safe Parallel Execution)

Worktree isolation provides safe task execution by running work in isolated git worktrees. This enables:

- **Parallel execution** - Multiple tasks can run simultaneously without conflicts
- **Safe rollback** - On failure, discard the worktree without affecting main branch
- **Clean history** - Squash commits on merge for clean git history
- **No pollution** - Main working directory stays clean during task execution

### Enable Worktree Isolation

```bash
./scripts/flow worktree enable
```

### How It Works

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│    Main      │ ──▶ │  Create Worktree  │ ──▶ │   Execute    │
│   Branch     │     │  (isolated branch)│     │    Task      │
└──────────────┘     └───────────────────┘     └──────────────┘
                                                      │
                                               ┌──────┴──────┐
                                               ▼             ▼
                                         ┌──────────┐  ┌──────────┐
                                         │ Success  │  │ Failure  │
                                         │ → Merge  │  │ → Discard│
                                         └──────────┘  └──────────┘
```

1. Task starts → Create isolated worktree on a new branch
2. All work happens in the worktree (safe from main)
3. On success → Squash-merge changes back to main branch
4. On failure → Simply discard the worktree, main is untouched

### Configuration

In `config.json`:
```json
{
  "worktree": {
    "enabled": true,
    "autoCleanupHours": 24,
    "keepOnFailure": false,
    "squashOnMerge": true
  }
}
```

| Option | Description |
|--------|-------------|
| `enabled` | Enable/disable worktree isolation |
| `autoCleanupHours` | Auto-cleanup worktrees older than this (default: 24) |
| `keepOnFailure` | Keep failed worktrees for debugging (default: false) |
| `squashOnMerge` | Squash commits when merging (default: true) |

### Managing Worktrees

```bash
# List active task worktrees
./scripts/flow worktree list

# Cleanup stale worktrees (>24h old)
./scripts/flow worktree cleanup

# Show configuration
./scripts/flow worktree status
```

### When to Use

- **Recommended for**: Production projects, team environments, risky changes
- **Optional for**: Solo development, small projects, exploratory work
- **Automatic with**: Hybrid mode (if both enabled), bulk task execution

---

## Parallel Execution

Execute multiple independent tasks simultaneously for faster development.

### Enable Parallel Execution

```bash
./scripts/flow parallel enable
```

### How It Works

1. **Dependency Detection** - Automatically detects task dependencies
2. **Parallelizable Tasks** - Identifies tasks that can run simultaneously
3. **Controlled Concurrency** - Limits concurrent tasks (default: 3)
4. **Progress Tracking** - Real-time visibility into running tasks

### Configuration

In `config.json`:
```json
{
  "parallel": {
    "enabled": true,
    "maxConcurrent": 3,
    "autoApprove": false,
    "requireWorktree": true,
    "showProgress": true
  }
}
```

| Option | Description |
|--------|-------------|
| `enabled` | Enable/disable parallel execution |
| `maxConcurrent` | Maximum concurrent tasks (default: 3) |
| `autoApprove` | Skip approval prompt for parallel runs |
| `requireWorktree` | Require worktree isolation for parallel tasks |
| `showProgress` | Show real-time progress indicator |

### Auto-Approve Mode

Skip the approval prompt for parallel execution:
```bash
./scripts/flow parallel auto-approve
```

This is useful for CI/CD or when you trust the dependency detection.

### Check Parallelizable Tasks

```bash
./scripts/flow parallel check
```

Shows which tasks can run in parallel and their dependency graph.

### Best Practices

- **Enable worktree isolation** when running tasks in parallel
- **Start with maxConcurrent: 2-3** to avoid overwhelming resources
- **Use auto-approve** only for well-tested task sets
- **Review dependency graph** before large parallel runs
