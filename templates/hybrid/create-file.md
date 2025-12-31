{{include _base.md}}

# Task: Create File

{{include _patterns.md}}

## File Specification

**CRITICAL - You are creating this file:**

| Field | Value |
|-------|-------|
| **File Path** | `{{path}}` |
| **File Type** | `{{fileType}}` |

**Description:**
{{description}}

**Content Guidance:**
{{content_guidance}}

## What You MUST Create

Create a complete, functional file at the specified path.

{{#if isTypeScript}}
- Include proper TypeScript types
- Add necessary imports at the top
- Export appropriately (named or default as needed)
{{/if}}

{{#if isConfig}}
- Follow the format expected by the tool/framework
- Include all required fields
- Add comments explaining non-obvious settings
{{/if}}

## What NOT to Create

❌ Do NOT create a different file than `{{path}}`
❌ Do NOT output partial content
❌ Do NOT wrap in markdown code blocks

## Requirements

1. Create the complete file content
2. Follow project conventions and patterns from _patterns.md
3. Include proper imports if TypeScript/JavaScript
4. Add appropriate comments/JSDoc if needed
5. Ensure the file is complete and functional

## Output

Output the complete file content.
No markdown code blocks. No explanations. Just the raw file content.
Start directly with the first line of the file.
