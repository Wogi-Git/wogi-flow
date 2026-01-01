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

## Golden Example (Follow This Pattern)

This example shows the CORRECT output format:

```tsx
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';

interface UserCardProps {
  name: string;
  email: string;
  onEdit?: () => void;
}

/**
 * Displays user information with optional edit action.
 */
export function UserCard({ name, email, onEdit }: UserCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <div
      className="p-4 rounded-lg border"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <h3 className="font-medium">{name}</h3>
      <p className="text-gray-600">{email}</p>
      {onEdit && isHovered && (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </Button>
      )}
    </div>
  );
}
```

**Notice:**
- 'use client' directive at the very top (if needed)
- Standard React imports only (useState, useCallback)
- Project imports use exact paths from "Available Components"
- Props interface defined inline with Props suffix
- JSDoc comment briefly describes the component
- Function exported with `export function`
- All variant/size props use string literals: `variant="ghost"` NOT `variant={variants.ghost}`

## Output

Output the complete file content starting with imports.
No markdown code blocks. No explanations. Just the code.

Start with imports (or 'use client'/'use server' directive if needed for Next.js).
The code must define and export `{{name}}`.
