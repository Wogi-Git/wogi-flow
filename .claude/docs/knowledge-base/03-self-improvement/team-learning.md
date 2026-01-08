# Team-Level Learning

Knowledge routing, pattern promotion, and shared learning across teams.

---

## Overview

Team learning enables:
- Sharing valuable patterns across projects
- Promoting local learnings to team-wide standards
- Routing new knowledge to appropriate scope
- Maintaining consistent practices

---

## Knowledge Routing

Decide where new learnings should go:

```json
{
  "knowledgeRouting": {
    "autoDetect": true,         // Analyze pattern scope
    "confirmWithUser": true,    // Ask before routing
    "defaultScope": "local",    // local | team | skill
    "modelSpecificLearning": true
  }
}
```

### Routing Flow

```
New Pattern Learned
         ↓
┌─────────────────────────────────────────┐
│ Analyze Pattern:                        │
│ - Project-specific? → Local             │
│ - Framework-related? → Skill            │
│ - General best practice? → Team         │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ Confirm with user (if enabled)          │
│ "This pattern could benefit the team.   │
│  Promote to team scope? [y/n]"          │
└─────────────────────────────────────────┘
         ↓
Route to appropriate location
```

### Scope Determination

| Pattern Type | Example | Scope |
|--------------|---------|-------|
| Project path | "Use /lib/api for calls" | Local |
| Framework pattern | "NestJS services use DI" | Skill |
| General practice | "Always handle errors" | Team |
| Company standard | "Use our component lib" | Team |

---

## Automatic Promotion

Valuable patterns can be auto-promoted:

```json
{
  "automaticPromotion": {
    "enabled": false,
    "threshold": 3,              // Uses before promotion
    "minRelevance": 0.8,         // Relevance score threshold
    "destinations": ["decisions.md"],
    "requireApproval": true,     // Require user approval
    "autoApplyTeamApproved": true
  }
}
```

### Promotion Flow

```
Pattern used successfully 3+ times
         ↓
Relevance score > 0.8
         ↓
┌─────────────────────────────────────────┐
│ Suggest promotion to team:              │
│                                         │
│ "Always use ErrorBoundary for pages"    │
│ Used: 5 times, Success: 100%            │
│                                         │
│ Promote to team decisions? [y/n]        │
└─────────────────────────────────────────┘
         ↓
(If approved)
         ↓
Sync to team backend or shared profile
         ↓
Available to all team members
```

---

## Team Sync

When team features are enabled:

```json
{
  "team": {
    "enabled": true,
    "sync": {
      "decisions": true,
      "skills": true,
      "memory": true
    }
  }
}
```

### What Syncs

| Item | Direction | Purpose |
|------|-----------|---------|
| decisions.md | Bidirectional | Team patterns |
| Skills | Download | Framework knowledge |
| Memory facts | Upload | Discovered patterns |

### Sync Process

```
Local Change
    ↓
Check: Is this team-scoped?
    ↓
Yes → Queue for sync
    ↓
Sync interval (5 min) or manual trigger
    ↓
Push to team backend
    ↓
Other team members receive on next sync
```

---

## Conflict Resolution

When local and team patterns conflict:

```json
{
  "team": {
    "conflictResolution": "newest-wins"
  }
}
```

### Resolution Strategies

| Strategy | Behavior |
|----------|----------|
| `newest-wins` | Latest timestamp wins |
| `local-wins` | Prefer local changes |
| `remote-wins` | Prefer team changes |
| `ask` | Prompt for each conflict |

### Conflict Example

```
Local: "Use axios for API calls"
Team:  "Use fetch for API calls"

With newest-wins:
  - Check timestamps
  - Apply newer pattern
  - Log conflict for review

With ask:
  - Prompt user
  - "Team uses fetch, you use axios. Keep which?"
```

---

## Shared Skills

Skills can be shared team-wide:

```json
{
  "team": {
    "sync": {
      "skills": true
    }
  }
}
```

### Skill Sharing Flow

1. **Create Local**: Developer creates/updates skill
2. **Mark for Sharing**: Promote skill to team
3. **Review**: Team admin approves
4. **Distribute**: Skill syncs to all members
5. **Local Override**: Members can extend locally

---

## Team Memory

Share discovered facts:

```json
{
  "team": {
    "sync": {
      "memory": true
    }
  }
}
```

### What's Shared

- Architectural patterns
- Common solutions
- Performance findings
- Security patterns

### What's NOT Shared

- Project-specific paths
- Personal preferences
- Temporary workarounds

---

## Manual Sharing

Without team backend, use profile export:

```bash
# Export learnings
/wogi-export

# Share file with team
# (via git, Slack, email, etc.)

# Import on other machine
/wogi-import
```

### Git-Based Sharing

```bash
# Include shared decisions in repo
git add .workflow/state/decisions.md
git commit -m "Update team patterns"
git push

# Team members pull changes
git pull
```

---

## Cross-Project Learning

For teams with multiple projects:

```json
{
  "team": {
    "projectScope": false    // Share across projects
  }
}
```

### Cross-Project Flow

```
Project A learns pattern
         ↓
Pattern promoted to team
         ↓
Project B syncs
         ↓
Pattern available in Project B
```

### Scoped vs Global

| Setting | Behavior |
|---------|----------|
| `projectScope: true` | Learnings stay in project |
| `projectScope: false` | Learnings share across projects |

---

## Knowledge Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Local Discovery                                           │
│        ↓                                                    │
│   Project decisions.md                                      │
│        ↓ (if valuable)                                      │
│   Team decisions (promoted)                                 │
│        ↓ (if framework-specific)                            │
│   Shared skill patterns                                     │
│                                                             │
│   ────────────────────────────────────────                  │
│                                                             │
│   Team patterns flow DOWN to new projects                   │
│   Local discoveries flow UP to team (with approval)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **Start Local**: Don't over-share immediately
2. **Validate First**: Pattern should work consistently
3. **Get Consensus**: Team should agree before promotion
4. **Document Why**: Include rationale with patterns
5. **Review Periodically**: Remove outdated team patterns

---

## Related

- [Project Learning](./project-learning.md) - Local patterns
- [Skill Learning](./skill-learning.md) - Framework patterns
- [Team Setup](../01-setup-onboarding/team-setup.md) - Team configuration
