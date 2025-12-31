{{include _base.md}}

# Task: Create Service

{{include _patterns.md}}

## Service Specification

**CRITICAL - You are creating this service:**

| Field | Value |
|-------|-------|
| **Service Name** | `{{name}}` |
| **File Path** | `{{path}}` |

**Description:**
{{description}}

**Methods:**
{{methods}}

**Types to Define:**
{{types}}

## What You MUST Create

```
// File: {{path}}
// Service: {{name}}

// Type definitions
interface SomeInput { ... }
interface SomeOutput { ... }

/**
 * [Brief description of {{name}}]
 */
export const {{name}} = {
  /**
   * [Method description]
   */
  async someMethod(input: SomeInput): Promise<SomeOutput> {
    // implementation
  },
  // ... other methods
};
```

## What NOT to Create

❌ Do NOT create any service except `{{name}}`
❌ Do NOT create types/interfaces from the project context section
❌ Do NOT create a React component or hook - this is a SERVICE file
❌ Do NOT output anything except the code for `{{name}}`

## Requirements Checklist

1. [ ] Service is named exactly `{{name}}`
2. [ ] All TypeScript types are defined for parameters and returns
3. [ ] Exported as: `export const {{name}}` or `export class {{name}}`
4. [ ] Errors are handled appropriately
5. [ ] Follows the service pattern from _patterns.md
6. [ ] Has JSDoc comments for each method

## Output

Output the complete file content starting with imports (if any).
No markdown code blocks. No explanations. Just the code.

The code must define and export `{{name}}`.
