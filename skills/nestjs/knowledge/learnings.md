# NestJS Learnings Log

This file is automatically updated when corrections or insights occur in NestJS projects.
Each entry captures context, what happened, and what to remember.

---

## What to Capture Here (NestJS-Specific)

Capture learnings when:
- **Dependency injection issues** - Wrong provider scope, circular deps, missing imports
- **Module configuration problems** - forRoot/forAsync patterns, dynamic modules
- **TypeORM/database issues** - Migrations, relations, query builder gotchas
- **Testing challenges** - Mock setup, testing modules, e2e test patterns
- **Decorator behavior** - Custom decorators, guards, interceptors
- **Performance discoveries** - Query optimization, caching patterns

## NestJS-Specific Good Examples

**Worth capturing:**
- "ConfigModule must be imported in EVERY module that needs env vars"
- "TypeORM relations need `eager: true` OR manual `leftJoinAndSelect`"
- "Custom decorators must use `SetMetadata` to be readable by guards"
- "Use `@InjectRepository(Entity)` not `@Inject(Repository)`"

**Not worth capturing:**
- "Changed endpoint path" (configuration, not insight)
- "Added validation pipe" (standard setup)

## When to Promote

Promote to `patterns.md` or `anti-patterns.md` when:
1. Same NestJS issue occurs 3+ times
2. It's a project-wide convention (all modules should do X)
3. Debugging took more than 15 minutes

---

## Entry Format

```markdown
### YYYY-MM-DD - Brief title

**Context**: What was being done
**Trigger**: commit | task-complete | correction | manual
**Issue**: What went wrong (or worked well)
**Learning**: Pattern to remember for future
**Files**: Affected files (if any)
**Related**: Link to request-log entry (if any)
```

---

## Recent Learnings

_No learnings recorded yet. This file will be updated automatically as you work on NestJS projects._
