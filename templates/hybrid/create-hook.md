{{include _base.md}}

# Task: Create React Hook

{{include _patterns.md}}

## Hook Specification

**CRITICAL - You are creating this hook:**

| Field | Value |
|-------|-------|
| **Hook Name** | `{{name}}` |
| **File Path** | `{{path}}` |
| **Return Type** | `{{name}}Result` or similar |

**Description:**
{{description}}

**Return Values:**
{{returns}}

**Dependencies/Uses:**
{{uses}}

## What You MUST Create

```
// File: {{path}}
// Hook: {{name}}

import { useState, useCallback, ... } from 'react';

interface {{name}}Result {
  // return properties
}

/**
 * [Brief description of {{name}}]
 */
export function {{name}}(/* params */): {{name}}Result {
  // implementation
  return {
    // returned values
  };
}
```

## What NOT to Create

❌ Do NOT create any hook except `{{name}}`
❌ Do NOT create types/interfaces from the project context section
❌ Do NOT create a component - this is a HOOK file
❌ Do NOT output anything except the code for `{{name}}`

## Requirements Checklist

1. [ ] Hook is named exactly `{{name}}` (must start with "use")
2. [ ] Return type interface is defined
3. [ ] Exported as: `export function {{name}}`
4. [ ] Returns an object with named properties (not array)
5. [ ] Handles loading/error states if applicable
6. [ ] Follows the hook pattern from _patterns.md
7. [ ] Has JSDoc comment

## Output

Output the complete file content starting with imports.
No markdown code blocks. No explanations. Just the code.

The FIRST LINE must be an import statement.
The code must define and export `{{name}}`.
