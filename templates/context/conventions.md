# Coding Conventions

Patterns and conventions for this project. AI can propose updates via diff.

---

## Naming Conventions

### Files & Directories
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE_CASE file | `API_ENDPOINTS.ts` |
| Types | PascalCase with `.types.ts` | `User.types.ts` |
| Tests | Same name with `.test.ts` | `UserProfile.test.tsx` |

### Variables & Functions
| Type | Convention | Example |
|------|------------|---------|
| Variables | camelCase | `userName` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |
| Booleans | `is/has/should/can` prefix | `isLoading`, `hasError` |
| Event handlers | `handle` prefix | `handleSubmit` |
| Async functions | verb-noun pattern | `fetchUser`, `createPost` |
| Private | underscore prefix (optional) | `_internalHelper` |

### Components & Classes
| Type | Convention | Example |
|------|------------|---------|
| React Components | PascalCase | `UserProfile` |
| Classes | PascalCase | `ApiClient` |
| Interfaces | PascalCase, no `I` prefix | `User`, `Config` |
| Type aliases | PascalCase | `UserId`, `ApiResponse` |
| Enums | PascalCase, UPPER members | `Status.ACTIVE` |

---

## Code Structure

### File Organization
```
// 1. External imports (React, libraries)
// 2. Internal imports (absolute paths)
// 3. Relative imports
// 4. Type imports
// 5. Asset imports (styles, images)

// Component/Module code

// Exports
```

### Component Structure (React)
```typescript
// 1. Imports
// 2. Types/Interfaces
// 3. Constants
// 4. Helper functions
// 5. Component definition
// 6. Styles (if CSS-in-JS)
// 7. Export
```

---

## Import Order

1. React/framework core imports
2. Third-party library imports
3. Internal modules (absolute paths like `@/`)
4. Relative imports (`./`, `../`)
5. Type-only imports
6. Style imports

---

## Code Patterns

### Error Handling
```typescript
// Prefer try-catch with specific error handling
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof SpecificError) {
    // Handle specific case
  }
  throw error; // Re-throw if unhandled
}
```

### Async/Await
```typescript
// Prefer async/await over .then() chains
const data = await fetchData();

// Use Promise.all for parallel operations
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);
```

### Null Handling
```typescript
// Use optional chaining
const name = user?.profile?.name;

// Use nullish coalescing for defaults
const value = input ?? defaultValue;
```

---

## Documentation

### Comments
- Use JSDoc for public APIs
- Explain "why" not "what"
- Remove commented-out code
- Keep comments up to date

### Code Comments Example
```typescript
// BAD: Increments counter
counter++;

// GOOD: Track retry attempts for rate limit backoff
retryCount++;
```

---

## Testing Conventions

### Test File Location
- Co-located with source: `Component.test.tsx`
- Or in `__tests__` directory

### Test Structure
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

## Git Conventions

### Commit Messages
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming
- Feature: `feature/description`
- Bugfix: `fix/description`
- Hotfix: `hotfix/description`

---

*AI can propose updates to this file via diff. Human approval required for changes.*
