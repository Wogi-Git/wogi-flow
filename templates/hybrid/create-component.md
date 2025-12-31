{{include _base.md}}

# Task: Create React Component

{{include _patterns.md}}

## Component Specification

**CRITICAL - You are creating this component:**

| Field | Value |
|-------|-------|
| **Component Name** | `{{name}}` |
| **File Path** | `{{path}}` |
| **Props Interface** | `{{name}}Props` |

**Description:**
{{description}}

**Props (if any):**
{{props}}

**Must Use These Existing Components/Hooks:**
{{uses}}

**Expected Behavior:**
{{behavior}}

## What You MUST Create

```
// File: {{path}}
// Component: {{name}}
// Interface: {{name}}Props

import { ... } from 'react';

interface {{name}}Props {
  // props here
}

/**
 * [Brief description of {{name}}]
 */
export function {{name}}({ ...props }: {{name}}Props) {
  return (
    // JSX for {{name}} here
  );
}
```

## What NOT to Create

❌ Do NOT create any component except `{{name}}`
❌ Do NOT create types/interfaces from the project context section
❌ Do NOT create components mentioned as "available" - those already exist
❌ Do NOT output anything except the code for `{{name}}`

## Requirements Checklist

1. [ ] Component is named exactly `{{name}}` (not something else!)
2. [ ] Props interface is named `{{name}}Props`
3. [ ] Exported as: `export function {{name}}`
4. [ ] Uses only imports from "Available Components" or standard React
5. [ ] Follows the component pattern from _patterns.md
6. [ ] Has JSDoc comment
7. [ ] Contains JSX (this is a .tsx file)

## Output

Output the complete file content starting with imports.
No markdown code blocks. No explanations. Just the code.

The FIRST LINE must be an import statement.
The code must define and export `{{name}}`.
