# Security Scanning

Pre-commit security checks for vulnerabilities.

---

## Purpose

Security scanning detects:
- Hardcoded secrets
- SQL/XSS injection patterns
- Known npm vulnerabilities
- Sensitive data exposure

---

## Configuration

```json
{
  "security": {
    "scanBeforeCommit": true,
    "blockOnHigh": true,
    "checkPatterns": {
      "secrets": true,
      "injection": true,
      "npmAudit": true
    },
    "ignoreFiles": ["*.test.ts", "*.spec.ts"]
  }
}
```

---

## Scan Types

### Secrets Detection

Finds hardcoded credentials:

| Pattern | Example |
|---------|---------|
| API Keys | `api_key: "sk-..."` |
| Passwords | `password = "secret123"` |
| Tokens | `AUTH_TOKEN=eyJhbG...` |
| Private Keys | `-----BEGIN RSA PRIVATE KEY-----` |

### Injection Patterns

Detects vulnerable code:

| Type | Example |
|------|---------|
| SQL Injection | `query("SELECT * FROM users WHERE id=" + userId)` |
| XSS | `innerHTML = userInput` |
| Command Injection | `exec(userInput)` |

### NPM Audit

Checks dependencies for known vulnerabilities:

```bash
npm audit --production
```

---

## When Scans Run

| Trigger | Condition |
|---------|-----------|
| Before Commit | `scanBeforeCommit: true` |
| Quality Gates | `security` in qualityGates |
| Manual | `flow security scan` |

---

## Scan Results

### Clean Scan

```
Security scan results:
  ✓ No secrets detected
  ✓ No injection patterns found
  ✓ npm audit: 0 vulnerabilities

All checks passed!
```

### Issues Found

```
Security scan results:

  ⚠️ Potential secret detected:
     src/config.ts:15
     const API_KEY = "sk-abc123..."

  ⚠️ SQL injection pattern:
     src/services/UserService.ts:42
     const query = "SELECT * FROM users WHERE id=" + id;

  ❌ npm audit: 3 vulnerabilities
     2 moderate, 1 high
     Run: npm audit fix

Block commit? Yes (blockOnHigh: true)
```

---

## Severity Levels

| Level | Blocking | Description |
|-------|----------|-------------|
| Critical | Always | Severe vulnerability |
| High | If `blockOnHigh` | Significant risk |
| Moderate | Warning | Should fix |
| Low | Info | Minor issue |

---

## Ignoring Files

Exclude test files and other non-production code:

```json
{
  "security": {
    "ignoreFiles": [
      "*.test.ts",
      "*.spec.ts",
      "*.mock.ts",
      "fixtures/*",
      "cypress/*"
    ]
  }
}
```

---

## False Positives

### Inline Ignore

```typescript
// security-ignore: example API key for tests
const EXAMPLE_KEY = "sk-example-not-real";
```

### Pattern Whitelist

```json
{
  "security": {
    "whitelist": [
      "EXAMPLE_KEY",
      "TEST_TOKEN"
    ]
  }
}
```

---

## Custom Patterns

Add project-specific patterns:

```json
{
  "security": {
    "customPatterns": [
      {
        "name": "internal-token",
        "pattern": "INTERNAL_.*=\\w{32,}",
        "severity": "high",
        "message": "Internal token should not be hardcoded"
      }
    ]
  }
}
```

---

## Fixing Issues

### Secrets

Replace with environment variables:

```typescript
// Before
const API_KEY = "sk-abc123...";

// After
const API_KEY = process.env.API_KEY;
```

### SQL Injection

Use parameterized queries:

```typescript
// Before
const query = "SELECT * FROM users WHERE id=" + id;

// After
const query = "SELECT * FROM users WHERE id = ?";
db.query(query, [id]);
```

### NPM Vulnerabilities

```bash
# Auto-fix
npm audit fix

# Force fix (may include breaking changes)
npm audit fix --force

# Manual update
npm update vulnerable-package
```

---

## Integration with CI/CD

Run scans in pipeline:

```yaml
# .github/workflows/security.yml
- name: Security Scan
  run: ./scripts/flow security scan --ci
```

### CI Mode

```bash
flow security scan --ci

# Exit code 1 if high severity found
# JSON output for parsing
```

---

## Best Practices

1. **Scan Before Commit**: Catch issues early
2. **Block on High**: Don't let serious issues through
3. **Update Dependencies**: Run npm audit regularly
4. **Use .env Files**: Never commit secrets
5. **Review False Positives**: Update whitelist

---

## Troubleshooting

### Too Many False Positives

- Add to ignoreFiles
- Update whitelist
- Use inline ignores

### Scan Too Slow

- Reduce files scanned
- Disable npmAudit for each commit
- Run full scan on CI only

### npm audit Fails

Check npm is installed and node_modules exists:
```bash
npm install
npm audit
```

---

## Related

- [Damage Control](./damage-control.md) - Command protection
- [Commit Gates](./commit-gates.md) - Approval workflow
- [Quality Gates](../02-task-execution/03-verification.md) - Verification
