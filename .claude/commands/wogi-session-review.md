Comprehensive code review of session changes using 3 parallel agents.

**Triggers**: `/wogi-session-review`, "please review", "review what we did"

## Usage

```bash
/wogi-session-review              # Review all session changes
/wogi-session-review --commits 3  # Include last 3 commits
/wogi-session-review --staged     # Only staged changes
```

## How It Works

1. **Identify changed files** from git (staged + unstaged + recent commits if specified)
2. **Launch 3 parallel Explore agents** each with a specific focus
3. **Consolidate results** into a single report with severity ratings

## The 3 Review Agents

### Agent 1: Code & Logic Review
Launch a Task agent with subagent_type=Explore focusing on:
- **Code Quality**: Naming conventions, readability, structure
- **Logic Correctness**: Algorithm correctness, edge case handling
- **DRY Violations**: Duplicated logic that should be extracted
- **Error Handling**: Are errors caught and handled appropriately?
- **Code Smells**: Long methods, deep nesting, magic numbers

Prompt template:
```
Review the following files for code quality and logic issues:
[FILE_LIST]

Check for:
1. Naming conventions - are names clear and consistent?
2. Logic correctness - any bugs or edge cases missed?
3. DRY violations - any duplicated code?
4. Error handling - are errors handled appropriately?
5. Code smells - long methods, deep nesting, magic numbers?

For each issue found, report:
- File and line number
- Issue type (quality/logic/dry/error/smell)
- Severity (critical/high/medium/low)
- Description and recommendation
```

### Agent 2: Security Review
Launch a Task agent with subagent_type=Explore focusing on:
- **Input Validation**: User inputs sanitized?
- **Authentication/Authorization**: Proper access controls?
- **Injection Risks**: SQL, XSS, command injection?
- **Sensitive Data**: Passwords, tokens, PII exposed?
- **Error Messages**: Do errors leak sensitive info?

Refer to `agents/security.md` for OWASP Top 10 checklist.

Prompt template:
```
Security review of the following files:
[FILE_LIST]

Check for OWASP Top 10 vulnerabilities:
1. Injection (SQL, XSS, command injection)
2. Broken authentication
3. Sensitive data exposure
4. Security misconfiguration
5. Insufficient input validation

For each issue found, report:
- File and line number
- Vulnerability type
- Severity (critical/high/medium/low)
- Description and remediation
```

### Agent 3: Architecture & Conflicts
Launch a Task agent with subagent_type=Explore focusing on:
- **Component Reuse**: Check `app-map.md` for existing components
- **Pattern Consistency**: Check `decisions.md` for coding patterns
- **Redundancies**: Similar implementations that could be consolidated
- **Conflicts**: Code that contradicts existing implementations
- **Dead Code**: Unused imports, variables, unreachable code

Prompt template:
```
Architecture review of the following files:
[FILE_LIST]

Check:
1. Read app-map.md - are there existing components that should be reused?
2. Read decisions.md - do changes follow established patterns?
3. Look for redundant implementations across the codebase
4. Look for conflicting code (different approaches to same problem)
5. Find dead code (unused imports, variables, unreachable code)

For each issue found, report:
- File and line number
- Issue type (reuse/pattern/redundancy/conflict/dead-code)
- Severity (critical/high/medium/low)
- Description and recommendation
```

## Execution Steps

When `/wogi-session-review` is invoked:

1. **Get changed files**:
   ```bash
   git diff --name-only HEAD  # Unstaged
   git diff --name-only --staged  # Staged
   git diff --name-only HEAD~N HEAD  # If --commits N specified
   ```

2. **Launch 3 agents in parallel** (single message with 3 Task tool calls):
   - Agent 1: Code & Logic (subagent_type=Explore)
   - Agent 2: Security (subagent_type=Explore)
   - Agent 3: Architecture (subagent_type=Explore)

3. **Wait for all agents to complete**

4. **Consolidate and display results** in this format:

```
╔══════════════════════════════════════════════════════════╗
║  Session Review                                           ║
╚══════════════════════════════════════════════════════════╝

Files Reviewed: N
  • path/to/file1.ts
  • path/to/file2.ts
  ...

───────────────────────────────────────────────────────────
CODE & LOGIC REVIEW
───────────────────────────────────────────────────────────
[Results from Agent 1]
✓ Good: [what's good]
⚠ Issue: [description] (file:line)

───────────────────────────────────────────────────────────
SECURITY REVIEW
───────────────────────────────────────────────────────────
[Results from Agent 2]
✓ Good: [what's secure]
⚠ Issue: [description] (file:line)

───────────────────────────────────────────────────────────
ARCHITECTURE & CONFLICTS
───────────────────────────────────────────────────────────
[Results from Agent 3]
✓ Good: [what follows patterns]
⚠ Issue: [description] (file:line)

───────────────────────────────────────────────────────────
SUMMARY
───────────────────────────────────────────────────────────
Total Issues: N (X critical, Y high, Z medium, W low)

Top Recommendations:
1. [Most important fix]
2. [Second most important]
3. [Third most important]
```

## Options

| Flag | Description |
|------|-------------|
| `--commits N` | Include last N commits in review scope |
| `--staged` | Only review staged changes |
| `--security-only` | Only run security agent |
| `--quick` | Faster review with reduced thoroughness |

## When No Changes Found

If no changes are detected:
```
No changes found to review.

To review recent commits: /wogi-session-review --commits 3
To review specific files: Please stage them first with git add
```

## Integration with Other Commands

- After `/wogi-done` - Optionally suggest review
- After major refactors - Recommend security review
- Before commits - Can be run as pre-commit check
