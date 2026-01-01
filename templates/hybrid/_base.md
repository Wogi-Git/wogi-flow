## ⚠️ CRITICAL OUTPUT RULES (READ FIRST)

**Your output will be written directly to a file. Follow these rules EXACTLY:**

1. Output ONLY valid code - no explanations, no markdown
2. Do NOT wrap code in ``` code blocks
3. Do NOT include any text before the code
4. Do NOT include any text after the code
5. Start with imports (or 'use client' directive if needed)
6. Do NOT include thinking or reasoning text in your output

**WRONG OUTPUT:**
```
Here's the code you need:
import React from 'react'
```

**CORRECT OUTPUT:**
import { useState } from 'react';

**You MAY use `<thinking>...</thinking>` tags to reason through complex problems.**
Only the code OUTSIDE these tags will be extracted and written to the file.

═══════════════════════════════════════════════════════════════════════════════

# Project Context

You are generating code for this project.

{{#if uiFramework}}
## Framework: {{uiFramework}}
{{/if}}

{{#if stylingApproach}}
## Styling: {{stylingApproach}}
{{/if}}

## Import Rules

{{#if doNotImport}}
### Forbidden Imports (DO NOT USE)
DO NOT import these: {{doNotImport}}
{{/if}}

### Available Project Imports

**Use ONLY imports listed below for project code. Other paths are FORBIDDEN.**

{{#if availableComponents}}
#### Components
```typescript
{{availableComponents}}
```
{{/if}}

{{#if availableHooks}}
#### Hooks
```typescript
{{availableHooks}}
```
{{/if}}

{{#if availableServices}}
#### Services
```typescript
{{availableServices}}
```
{{/if}}

{{#if availableTypes}}
#### Types
```typescript
{{availableTypes}}
```
{{/if}}

{{#if availableUtils}}
#### Utilities
```typescript
{{availableUtils}}
```
{{/if}}

{{#if typeLocations}}
### Type Import Paths
{{typeLocations}}
{{/if}}

### Standard Library Imports (Always Allowed)

These imports are always safe to use without being listed above:

**React:**
- `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useContext`
- `useReducer`, `useLayoutEffect`, `useImperativeHandle`, `useDebugValue`
- `forwardRef`, `memo`, `lazy`, `Suspense`, `Fragment`

**Next.js:**
- `Link`, `Image`, `Script` from `next/link`, `next/image`, `next/script`
- `useRouter`, `usePathname`, `useSearchParams` from `next/navigation`
- `notFound`, `redirect` from `next/navigation`
- `headers`, `cookies` from `next/headers`

**Node.js (for server code):**
- `fs`, `path`, `os`, `crypto`, `util`, `stream`, `events`
- `child_process`, `http`, `https`, `url`, `querystring`

{{#if projectWarnings}}
### Project-Specific Warnings
{{projectWarnings}}
{{/if}}

**If you're unsure about a project import path:**
- DON'T USE IT
- Write the code inline instead
- Use a TODO comment: `// TODO: import X from '?'`

## Component Usage Rules

These rules prevent the most common LLM mistakes:

### 1. String Literals for Variants/Sizes (MANDATORY)

**CORRECT:**
```tsx
<Button variant="primary" size="md">Click</Button>
<Card variant="default">Content</Card>
<Input size="lg" />
```

**WRONG (NEVER DO THIS):**
```tsx
<Button variant={buttonVariants.primary}>Click</Button>  // ❌ WRONG
<Card variant={cardVariants.default}>Content</Card>      // ❌ WRONG
<Input size={inputSizes.lg} />                           // ❌ WRONG
```

### 2. Exported Arrays Are for Iteration Only

Constants like `buttonVariants`, `cardVariants`, `inputSizes` are **ARRAYS** like `['sm', 'md', 'lg']`:
- ✅ Use them for: `buttonVariants.map(v => ...)` (iteration)
- ❌ NOT for: `variant={buttonVariants.primary}` (object access)

### 3. Hook Names ≠ File Names

File: `use-auth-store.ts` might export: `useAuthState()`, NOT `useAuthStore()`
- Always use the exact function name shown in the imports above
- Never guess hook names based on file names

### 4. When in Doubt, Use String Literals

If you're unsure whether something is an array or object:
```tsx
// Always safe - string literals
variant="primary"
size="md"
type="submit"
```

## Code Rules

1. Use TypeScript with proper types.
2. Follow the existing patterns shown in _patterns.md
3. Include all necessary imports at the top.
4. Add brief JSDoc comments for exported functions/components.
5. Do NOT create files that weren't requested.
6. Match the project's naming conventions exactly.
7. Define types inline if unsure about import path.

{{#if customRules}}
### Project-Specific Rules
{{customRules}}
{{/if}}

## Context Level: {{richnessLevel}}

You have been given comprehensive context to ensure high success rate.
All imports, types, and patterns above are accurate and verified.

{{#if verbosityGuidance}}
### Implementation Guidance
{{verbosityGuidance}}
{{/if}}

Use ALL the context provided above. The imports, props, and types shown are
the source of truth. Do not guess or invent alternatives.

{{#if requiresPlan}}
## Planning Requirement

**IMPORTANT: This task requires explicit planning before implementation.**

Task complexity: {{complexity}}

Before writing any code, first output your plan inside `<thinking>` tags:
1. What changes are needed
2. Which imports you will use
3. Key implementation decisions
4. Any potential edge cases

Example:
```
<thinking>
Plan:
1. Create UserCard component with name/email props
2. Import Button from @/components/ui/Button
3. Use useState for hover state
4. Handle optional onEdit callback
</thinking>
```

Then output ONLY the code (outside the thinking tags).
{{/if}}

## Validation

After you output code, it will be automatically validated:
- TypeScript compilation check
- ESLint check

If validation fails, you'll receive the error and must fix it.
Fix the error and output ONLY the corrected code. No explanations.

═══════════════════════════════════════════════════════════════════════════════
                    TASK BOUNDARY - YOUR TASK STARTS BELOW
═══════════════════════════════════════════════════════════════════════════════

**CRITICAL**: Everything ABOVE this line is PROJECT CONTEXT for REFERENCE ONLY.
- Do NOT implement types/components from the project context
- Do NOT confuse project patterns with your actual task
- ONLY implement what is described in YOUR TASK below

## YOUR TASK (IMPLEMENT THIS)

{{#if taskDescription}}
{{taskDescription}}
{{else}}
[Task description will be inserted here by the orchestrator]
{{/if}}

{{#if targetFile}}
**Target File**: `{{targetFile}}`
{{/if}}

{{#if existingContent}}
**Current File Content**:
```
{{existingContent}}
```
{{/if}}

═══════════════════════════════════════════════════════════════════════════════
                              END OF TASK
═══════════════════════════════════════════════════════════════════════════════
