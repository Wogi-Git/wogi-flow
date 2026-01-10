# Session Review

Comprehensive code review using 3 parallel agents to analyze session changes.

## Overview

The `/wogi-session-review` command performs a thorough review of all code changes made during a session. It uses 3 parallel agents, each focused on different aspects:

```
┌─────────────────────────────────────────────────────────────┐
│                   SESSION REVIEW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Agent 1    │  │   Agent 2    │  │   Agent 3    │       │
│  │  Code/Logic  │  │   Security   │  │ Architecture │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 ▼                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Consolidated Report                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Triggers

The review can be triggered by:

| Trigger | Example |
|---------|---------|
| Slash command | `/wogi-session-review` |
| Natural language | "please review" |
| Natural language | "review what we did" |
| Natural language | "review the changes" |

## The 3 Review Agents

### Agent 1: Code & Logic Review

Focuses on code quality and correctness:

- **Code Quality**: Naming conventions, readability, structure
- **Logic Correctness**: Algorithm bugs, edge case handling
- **DRY Violations**: Duplicated code that should be extracted
- **Error Handling**: Missing try/catch, unhandled promises
- **Code Smells**: Long methods, deep nesting, magic numbers

### Agent 2: Security Review

Based on `agents/security.md` and OWASP Top 10:

- **Input Validation**: User inputs sanitized?
- **Authentication/Authorization**: Proper access controls?
- **Injection Risks**: SQL, XSS, command injection vulnerabilities
- **Sensitive Data**: Passwords, tokens, PII exposure
- **Error Messages**: Stack traces or secrets in error responses

### Agent 3: Architecture & Conflicts

Checks against project standards:

- **Component Reuse**: Check `app-map.md` for existing components
- **Pattern Consistency**: Check `decisions.md` for coding patterns
- **Redundancies**: Similar implementations that could be consolidated
- **Conflicts**: Code that contradicts existing implementations
- **Dead Code**: Unused imports, variables, unreachable code

## Command Options

```bash
/wogi-session-review              # Review all session changes
/wogi-session-review --commits 3  # Include last 3 commits
/wogi-session-review --staged     # Only staged changes
/wogi-session-review --security-only  # Only run security agent
/wogi-session-review --quick      # Faster, less thorough
```

## Output Format

```
╔══════════════════════════════════════════════════════════╗
║  Session Review                                           ║
╚══════════════════════════════════════════════════════════╝

Files Reviewed: 5
  • src/components/Button.tsx
  • src/utils/validation.ts
  • src/api/users.ts

───────────────────────────────────────────────────────────
CODE & LOGIC REVIEW
───────────────────────────────────────────────────────────
✓ Code quality: Good naming conventions
✓ Error handling: Appropriate try/catch blocks
⚠ Edge case: Missing null check in validation.ts:45
⚠ DRY: Similar validation logic in users.ts and validation.ts

───────────────────────────────────────────────────────────
SECURITY REVIEW
───────────────────────────────────────────────────────────
✓ Input validation: Present on all user inputs
✓ Authentication: Properly checked before data access
⚠ Potential: SQL injection risk in users.ts:78

───────────────────────────────────────────────────────────
ARCHITECTURE & CONFLICTS
───────────────────────────────────────────────────────────
✓ Component reuse: Button follows app-map patterns
✓ Pattern consistency: Follows decisions.md conventions
⚠ Redundancy: validateEmail exists in utils/helpers.ts

───────────────────────────────────────────────────────────
SUMMARY
───────────────────────────────────────────────────────────
Total Issues: 4 (0 critical, 0 high, 4 medium)

Top Recommendations:
1. Add null check in validation.ts:45
2. Use parameterized query in users.ts:78
3. Consolidate email validation logic
```

## Severity Levels

| Level | Description | Action |
|-------|-------------|--------|
| **Critical** | Security vulnerability, data loss risk | Must fix before merge |
| **High** | Bug, logic error, significant issue | Should fix before merge |
| **Medium** | Code quality, DRY violation, minor issue | Recommend fixing |
| **Low** | Style, suggestion, nice-to-have | Optional |

## Integration

### With Quality Gates

Session review can be added to quality gates:

```json
{
  "qualityGates": {
    "feature": {
      "require": ["tests", "sessionReview", "appMapUpdate"]
    }
  }
}
```

### With CI/CD

Run before merge:

```bash
# In CI pipeline
./scripts/flow session-review --commits 1 --json > review.json
```

## Best Practices

1. **Run before committing** - Catch issues early
2. **Use after major changes** - Especially refactors
3. **Focus on security for public-facing code** - Use `--security-only`
4. **Review the summary** - Top recommendations are most important

## Related Commands

- `/wogi-health` - Check workflow integrity
- `/wogi-session-end` - End session and commit
- `./scripts/flow verify all` - Run all verification gates
