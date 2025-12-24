Create a detailed correction report for a significant bug fix.

Usage: `/wogi-correction [TASK-XXX]`

## When to Use

Based on `config.json` corrections mode:
- **inline**: Only use when explicitly requested
- **hybrid**: Use for significant/complex fixes
- **always-detailed**: Use for every fix

## Steps

1. Read `config.json` to check corrections mode
2. Find next correction number for the task
3. Create correction report at `.workflow/corrections/[TASK-XXX]-correction-[N].md`
4. Add summary to request-log.md with link to detail

## Gather Information

Ask user for:
1. **What was expected?** - The correct behavior
2. **What happened?** - The actual behavior
3. **Error message?** - If applicable
4. **Root cause?** - Why it happened
5. **Solution?** - What was changed
6. **Prevention?** - How to avoid in future

## Output

Create detailed report:

```markdown
# Correction Report: TASK-012-Correction-1

## Problem Description
### What Was Expected
User should see dashboard after login

### What Actually Happened
Redirect failed, stayed on login page

### Error Message
TypeError: Cannot read property 'id' of undefined

## Root Cause Analysis
Auth token not being sent in header

## Solution Applied
| File | Change |
|------|--------|
| api.ts | Added Authorization header |

## Prevention Measures
1. Add integration test for auth flow
2. Update API client documentation
```

Add to request-log.md:

```markdown
### R-045 | 2024-01-15
**Type**: fix
**Tags**: #bug:BUG-003 #task:TASK-012
**Request**: Fix login redirect failure
**Result**: Added auth header to API client
**Correction**: [TASK-012-correction-1](../corrections/TASK-012-correction-1.md)
**Files**: `api.ts`
```

## Template

Use: `.workflow/templates/correction-report.md`
