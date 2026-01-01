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

## Golden Example (Follow This Pattern)

This example shows the CORRECT output format for a data-fetching hook:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

interface UseUserResult {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetches and manages user data for the given user ID.
 */
export function useUser(userId: string): UseUserResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
  };
}
```

**Notice:**
- 'use client' directive at the very top (if needed for client-side React)
- Hook name starts with "use"
- Return type interface clearly defines all returned values
- JSDoc comment briefly describes the hook's purpose
- Returns object with named properties (NOT array like `[user, setUser]`)
- Handles loading and error states
- Memoizes callbacks with useCallback
- Exports with `export function`

## Output

Output the complete file content starting with imports.
No markdown code blocks. No explanations. Just the code.

Start with imports (or 'use client' directive if needed for Next.js client hooks).
The code must define and export `{{name}}`.
