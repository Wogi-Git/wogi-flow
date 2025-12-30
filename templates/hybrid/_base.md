# Universal Rules

You are generating code for this project.

## CRITICAL OUTPUT RULES

1. Output ONLY valid code - no explanations, no markdown
2. Do NOT wrap code in ``` code blocks
3. Do NOT include any text before the first import/export statement
4. Do NOT include any text after the code
5. Start directly with the code (import statements or exports)
6. Do NOT include thinking or reasoning text
7. Do NOT include </think> tags or similar markers

WRONG OUTPUT:
```
Here's the code you need:
import React from 'react'
```

WRONG OUTPUT:
```
We need to implement this feature...
</think>
import React from 'react'
```

CORRECT OUTPUT:
import React from 'react'

## CRITICAL IMPORT RULES

**NEVER INVENT IMPORTS.** Only use imports that:
1. Are explicitly listed in the "Available Imports" section below
2. Are shown in the current file content (for modify-file tasks)
3. Are standard React/library imports (react, styled-components, etc.)

**If you're unsure about an import path:**
- DON'T USE IT
- Write the code inline instead
- Use a TODO comment: `// TODO: import X from '?'`

**Common WRONG patterns to avoid:**
- ❌ `import { useXxx } from '@/hooks/useXxx'` - No global hooks folder
- ❌ `import { Xxx } from '@/components/Xxx'` - Unless explicitly listed
- ❌ `import type { Xxx } from '@/types/xxx'` - Use relative imports

**CORRECT patterns:**
- ✅ `import { useState, useCallback } from 'react'`
- ✅ `import styled from 'styled-components'`
- ✅ `import type { Xxx } from '../api/types'` - Relative to feature
- ✅ `import type { Xxx } from './types'` - Same directory

## Code Rules

1. Use TypeScript with proper types.
2. Follow the existing patterns shown in _patterns.md
3. Include all necessary imports at the top.
4. Add brief JSDoc comments for exported functions/components.
5. Do NOT create files that weren't requested.
6. Match the project's naming conventions exactly.
7. Define types inline if unsure about import path.

## Validation

After you output code, it will be automatically validated:
- TypeScript compilation check
- ESLint check

If validation fails, you'll receive the error and must fix it.
Fix the error and output ONLY the corrected code. No explanations.
