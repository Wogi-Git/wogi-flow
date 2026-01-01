# Learnings Log

This file is automatically updated when corrections or insights occur.
Each entry captures context, what happened, and what to remember.

---

## What to Capture Here

Capture learnings when:
- **User corrects you** - They say "no, do X instead" or "that's wrong"
- **Something breaks** - Build fails, tests fail, runtime error
- **You discover a project convention** - "Ah, this project uses X pattern"
- **A workaround is needed** - Library bug, platform limitation, edge case
- **Something works unexpectedly well** - Shortcut that's now a pattern

## Good Learning vs Noise

**Worth capturing:**
- "Module imports must use `.js` extension in this ESM project"
- "The auth middleware expects `req.user.id`, not `req.userId`"
- "Tests fail if database isn't seeded first"

**Not worth capturing:**
- "Fixed typo in variable name" (too trivial)
- "Added console.log for debugging" (temporary)
- "Used different CSS color" (preference, not pattern)

## When to Promote to patterns.md or anti-patterns.md

A learning should be promoted when:
1. **Same issue occurs 3+ times** - It's a pattern, not a one-off
2. **It affects multiple files** - Project-wide concern
3. **It cost significant time** - Worth preventing in future

To promote:
1. Move the core insight to `patterns.md` (if positive) or `anti-patterns.md` (if negative)
2. Add code examples if relevant
3. Keep the original learning entry as history

---

## Entry Format

```markdown
### YYYY-MM-DD - Brief title

**Context**: What was being done
**Trigger**: commit | task-complete | correction | manual
**Issue**: What went wrong (or worked well)
**Learning**: Pattern to remember for future
**Files**: Affected files (if any)
**Related**: Link to request-log entry (if any)
```

---

## Recent Learnings

_No learnings recorded yet. This file will be updated automatically as you work._
