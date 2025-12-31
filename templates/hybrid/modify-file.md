{{include _base.md}}

{{include _patterns.md}}

# Task: Modify Existing File

## File to Modify

**CRITICAL - You are modifying this file:**

| Field | Value |
|-------|-------|
| **File Path** | `{{path}}` |
| **Task** | Apply the changes described below |

## Current File Content

```
{{currentContent}}
```

## Required Changes

{{modifications}}

## What You MUST Do

1. Start with ALL existing imports from the current file
2. Apply ONLY the specified changes
3. Preserve ALL existing code not mentioned in changes
4. Output the COMPLETE file (not a diff or snippet)

## What NOT to Do

❌ Do NOT remove existing code unless explicitly told to
❌ Do NOT change import paths
❌ Do NOT reorganize or reformat existing code
❌ Do NOT add features not mentioned in Required Changes
❌ Do NOT output partial code or diffs
❌ Do NOT create new files - modify the existing one

## CRITICAL Requirements

1. [ ] Output is a COMPLETE valid TypeScript file
2. [ ] ALL existing imports are preserved
3. [ ] Only specified changes are applied
4. [ ] File maintains its existing structure and style
5. [ ] Output size is similar to original (not drastically smaller)

## Output

Output the COMPLETE modified file with all changes applied.
The output must be the ENTIRE file content, not a partial snippet.
Start directly with the first import statement.
No markdown code blocks. No explanations.
