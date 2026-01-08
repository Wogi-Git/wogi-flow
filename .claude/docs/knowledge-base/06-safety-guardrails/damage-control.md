# Damage Control

Pattern-based protection against destructive operations.

---

## Purpose

Damage control prevents:
- Accidental file deletions
- Destructive git operations
- Dangerous system commands
- Configuration overwrites

---

## Configuration

```json
{
  "damageControl": {
    "enabled": false,
    "patternsFile": ".workflow/damage-control.yaml",
    "promptHook": {
      "enabled": false,
      "model": "haiku",
      "timeout": 5000,
      "skipSafeCommands": true
    },
    "onBlock": "error",
    "onAsk": "prompt",
    "logging": true
  }
}
```

---

## Pattern File

Define patterns in `.workflow/damage-control.yaml`:

```yaml
# Damage Control Patterns

block:
  # Block destructive git commands
  - pattern: "git push.*--force"
    message: "Force push is blocked. Use --force-with-lease instead."

  # Block mass deletions
  - pattern: "rm -rf /"
    message: "Root deletion is always blocked."

  - pattern: "rm -rf \\*"
    message: "Wildcard deletion requires explicit approval."

  # Block config overwrites
  - pattern: "config\\.json.*--overwrite"
    message: "Config overwrite requires approval."

ask:
  # Require confirmation for these
  - pattern: "git reset --hard"
    message: "Hard reset will lose uncommitted changes. Continue?"

  - pattern: "drop.*table"
    message: "Dropping database table. Are you sure?"

  - pattern: "rm -rf node_modules"
    message: "Removing node_modules. Reinstall will be needed."

allow:
  # Explicitly allow safe patterns
  - pattern: "git push origin"
  - pattern: "rm -rf dist"
  - pattern: "rm -rf build"
```

---

## How It Works

```
Command Detected
      ↓
┌─────────────────────────────────────────┐
│ Check against block patterns            │
├─────────────────────────────────────────┤
│ Match? → Block with error               │
└─────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────┐
│ Check against ask patterns              │
├─────────────────────────────────────────┤
│ Match? → Prompt for confirmation        │
└─────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────┐
│ Check against allow patterns            │
├─────────────────────────────────────────┤
│ Match? → Allow immediately              │
└─────────────────────────────────────────┘
      ↓
Execute command
```

---

## Actions

### Block

```json
{
  "onBlock": "error"    // Options: "error" | "warn" | "log"
}
```

| Setting | Behavior |
|---------|----------|
| `error` | Stop execution, show error |
| `warn` | Show warning, continue |
| `log` | Log silently, continue |

### Ask

```json
{
  "onAsk": "prompt"    // Options: "prompt" | "block" | "allow"
}
```

| Setting | Behavior |
|---------|----------|
| `prompt` | Ask user for confirmation |
| `block` | Treat ask patterns as blocks |
| `allow` | Treat ask patterns as allowed |

---

## Prompt Hook

For advanced protection, enable AI-powered review:

```json
{
  "damageControl": {
    "promptHook": {
      "enabled": true,
      "model": "haiku",          // Fast model for quick checks
      "timeout": 5000,           // Max wait time
      "skipSafeCommands": true   // Skip obvious safe commands
    }
  }
}
```

### How Prompt Hook Works

1. Command intercepted
2. Sent to AI for risk assessment
3. AI returns: safe, risky, or blocked
4. Action taken based on result

---

## Common Patterns

### Git Protection

```yaml
block:
  - pattern: "git push.*--force$"
    message: "Use --force-with-lease for safer force push"

  - pattern: "git reset --hard HEAD~[0-9]+"
    message: "Multiple commit reset blocked"

ask:
  - pattern: "git reset --hard"
  - pattern: "git clean -fd"
  - pattern: "git checkout -- \\."
```

### File Protection

```yaml
block:
  - pattern: "rm -rf /$"
  - pattern: "rm -rf ~"
  - pattern: "> /dev/sd"

ask:
  - pattern: "rm -rf"
  - pattern: "chmod 777"
  - pattern: "chown -R"
```

### Database Protection

```yaml
block:
  - pattern: "DROP DATABASE"
  - pattern: "TRUNCATE.*CASCADE"

ask:
  - pattern: "DROP TABLE"
  - pattern: "DELETE FROM.*WHERE 1"
  - pattern: "UPDATE.*SET.*WHERE 1"
```

---

## Logging

When `logging` is enabled:

```
.workflow/logs/damage-control.log

2024-01-15 10:30:00 | BLOCKED | git push --force | Force push blocked
2024-01-15 10:31:00 | ASKED   | rm -rf dist | User approved
2024-01-15 10:32:00 | ALLOWED | git push origin | Safe pattern
```

---

## Integration with Auto-Inference

Damage control can work with auto-inference verification:

```json
{
  "damageControl": {
    "enabled": true,
    "integrateWithVerification": true
  }
}
```

Commands run during verification are also checked.

---

## Best Practices

1. **Start Conservative**: Block more, ask for the rest
2. **Customize Patterns**: Add project-specific dangers
3. **Review Logs**: Check what's being caught
4. **Whitelist Safe Ops**: Avoid prompt fatigue
5. **Test Patterns**: Verify regex matches correctly

---

## Troubleshooting

### Pattern Not Matching

Test regex:
```bash
echo "git push --force" | grep -E "git push.*--force"
```

### Too Many Prompts

Add common safe operations to allow:
```yaml
allow:
  - pattern: "npm install"
  - pattern: "npm run build"
  - pattern: "git status"
```

### Blocking Safe Commands

Check pattern specificity:
```yaml
# Too broad:
- pattern: "rm"

# Better:
- pattern: "rm -rf /"
```

---

## Related

- [Security Scanning](./security-scanning.md) - Code security
- [Checkpoint/Rollback](./checkpoint-rollback.md) - Recovery
- [Configuration](../configuration/all-options.md) - All settings
