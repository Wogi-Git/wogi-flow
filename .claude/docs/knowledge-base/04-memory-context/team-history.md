# Team History

Shared logs, audit trails, and team memory.

---

## Overview

Team history enables:
- Shared change logs across team members
- Audit trails for compliance
- Cross-project knowledge access
- Institutional memory

---

## Configuration

```json
{
  "team": {
    "enabled": false,
    "sync": {
      "requestLog": "recent",    // "recent" | "all" | false
      "memory": true
    }
  },
  "requestLog": {
    "enabled": true,
    "autoArchive": true,
    "maxRecentEntries": 50,
    "keepRecent": 30,
    "createSummary": true
  }
}
```

---

## Request Log

The primary audit trail:

```markdown
# Request Log

### R-047 | 2024-01-15 14:30
**Type**: new
**Tags**: #screen:login #component:AuthService #feature:authentication
**Request**: "Add user authentication with login form"
**Result**: Created AuthService and LoginForm components
**Files**: src/services/AuthService.ts, src/components/LoginForm.tsx

### R-046 | 2024-01-15 10:15
**Type**: fix
**Tags**: #screen:dashboard #bugfix
**Request**: "Fix chart rendering on mobile"
**Result**: Added responsive breakpoints to Chart component
**Files**: src/components/Chart.tsx
```

---

## Searching History

```bash
/wogi-search #component:Button

# Output:
# Found 5 entries:
#
# R-042 | 2024-01-14 | new | Created Button component
# R-039 | 2024-01-13 | change | Added loading state to Button
# R-035 | 2024-01-12 | fix | Fixed Button disabled style
# ...
```

### Search by Tag

| Tag Type | Example | Purpose |
|----------|---------|---------|
| `#screen:` | `#screen:login` | Changes to screens |
| `#component:` | `#component:Button` | Component changes |
| `#feature:` | `#feature:auth` | Feature-related |
| `#bugfix` | `#bugfix` | Bug fixes |

---

## Auto-Archive

Old entries are archived automatically:

```json
{
  "requestLog": {
    "autoArchive": true,
    "maxRecentEntries": 50,
    "keepRecent": 30
  }
}
```

### Archive Location

```
.workflow/state/
├── request-log.md          # Recent entries
└── archive/
    ├── request-log-2024-01.md
    ├── request-log-2024-02.md
    └── summary.md
```

### Summary Creation

When `createSummary` is enabled:

```markdown
# Request Log Archive Summary

## 2024-01 (45 entries)

### By Type
- new: 20 entries
- fix: 15 entries
- change: 8 entries
- refactor: 2 entries

### Top Tags
- #screen:dashboard (12)
- #component:Button (8)
- #feature:auth (7)

### Key Changes
- Added user authentication (R-047)
- Implemented dashboard charts (R-038)
- Fixed mobile responsiveness (R-032)
```

---

## Team Sync

When team features are enabled:

### Sync Options

```json
{
  "team": {
    "sync": {
      "requestLog": "recent"    // Options:
                                // "recent" - last 50 entries
                                // "all" - full history
                                // false - don't sync
    }
  }
}
```

### What Syncs

| Setting | What Syncs |
|---------|-----------|
| `"recent"` | Last N entries only |
| `"all"` | Complete history |
| `false` | Nothing (local only) |

---

## Audit Trail

Request log serves as audit trail:

### Required Fields

| Field | Purpose |
|-------|---------|
| ID | Unique identifier |
| Timestamp | When change occurred |
| Type | Kind of change |
| Request | What was asked |
| Result | What was done |
| Files | What was changed |

### Optional Fields

| Field | Purpose |
|-------|---------|
| Tags | Categorization |
| Author | Who made request |
| Duration | Time taken |
| Tokens | Tokens used |

---

## Cross-Project Access

With team sync, access history from other projects:

```bash
# (Future) Search across projects
flow team search "authentication"

# Output:
# Found in 3 projects:
#
# project-a:
#   R-047 | Add authentication
#
# project-b:
#   R-023 | Implement OAuth
#
# project-c:
#   R-089 | Add SSO support
```

---

## Privacy Considerations

### What's Safe to Share

- General patterns and approaches
- Component references
- File structure changes

### What's NOT Safe to Share

- Sensitive business logic
- API keys or secrets
- Personal data references

### Privacy Controls

```json
{
  "team": {
    "sync": {
      "requestLog": "recent",
      "sanitize": true,           // Remove sensitive data
      "excludeTags": ["#internal", "#sensitive"]
    }
  }
}
```

---

## Retention Policies

### Local Retention

```json
{
  "requestLog": {
    "keepRecent": 30,             // Days in active log
    "archiveRetention": 365       // Days in archive
  }
}
```

### Team Retention

Managed by team backend:
- Recent: Always available
- Archive: Configurable retention
- Deletion: On project removal

---

## Best Practices

1. **Use Consistent Tags**: Standardize tag naming
2. **Be Descriptive**: Clear request/result summaries
3. **Tag Everything**: Makes searching easier
4. **Review Archives**: Periodically check for patterns
5. **Protect Sensitive Data**: Use privacy controls

---

## Commands

| Command | Purpose |
|---------|---------|
| `/wogi-log` | Add log entry |
| `/wogi-search` | Search history |
| `/wogi-changelog` | Generate changelog |

---

## Generating Changelogs

```bash
/wogi-changelog

# Output:
# Generated CHANGELOG from request log
#
# ## 2024-01-15
#
# ### Added
# - User authentication (R-047)
# - Dashboard charts (R-038)
#
# ### Fixed
# - Mobile chart rendering (R-046)
# - Login button alignment (R-044)
```

---

## Related

- [Project Learning](../03-self-improvement/project-learning.md) - Learning from history
- [Team Setup](../01-setup-onboarding/team-setup.md) - Team configuration
- [Configuration](../configuration/all-options.md) - All settings
