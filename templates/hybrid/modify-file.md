{{include _base.md}}

{{include _patterns.md}}

# Task: Modify Existing File

## File to Modify

**Path:** {{path}}

## Current File Content

```
{{currentContent}}
```

## Required Changes

{{modifications}}

## CRITICAL Requirements

1. Make ONLY the specified changes
2. Preserve ALL existing code, imports, and formatting
3. Keep ALL existing imports - do NOT remove or change them
4. Add new imports only if needed for the new code
5. Keep the file's existing style exactly
6. The output must be a COMPLETE valid TypeScript file

## Output

Output the COMPLETE modified file with all changes applied.
Do NOT output a diff or partial content.
Output the entire file content, starting with imports.
No markdown code blocks.
Start directly with the first import statement.
