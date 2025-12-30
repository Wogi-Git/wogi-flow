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

## Code Rules

1. Use TypeScript with proper types.
2. Follow the existing patterns shown in _patterns.md
3. Include all necessary imports at the top.
4. Add brief JSDoc comments for exported functions/components.
5. Do NOT create files that weren't requested.
6. Match the project's naming conventions exactly.

## Validation

After you output code, it will be automatically validated:
- TypeScript compilation check
- ESLint check

If validation fails, you'll receive the error and must fix it.
Fix the error and output ONLY the corrected code. No explanations.
