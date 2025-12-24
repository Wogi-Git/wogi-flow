View and manage project coding rules.

Usage:
- `/wogi-rules` - List all rules
- `/wogi-rules [name]` - View specific rule
- `/wogi-rules add [name]` - Create new rule file

## What Are Rules?

Rules are coding standards and conventions stored in `.claude/rules/`.
They're automatically loaded and applied when relevant.

## Structure

```
.claude/rules/
  typescript.md      # TypeScript conventions
  api-design.md      # API patterns
  testing.md         # Testing standards
  security.md        # Security practices
  database.md        # Database patterns
  [custom].md        # Your project-specific rules
```

## Output - List

```
📋 Project Rules

Core Rules:
  • typescript.md - TypeScript conventions
  • testing.md - Testing patterns

Skill Rules (from installed skills):
  • nestjs/conventions.md - NestJS architecture
  • nestjs/database.md - TypeORM patterns

Custom Rules:
  • our-api-style.md - Company API standards

Use: /wogi-rules [name] to view a rule
     /wogi-rules add [name] to create new rule
```

## Output - View Rule

```
📜 Rule: typescript

# TypeScript Conventions

## Naming
- Files: kebab-case
- Classes: PascalCase
- Variables: camelCase
- Constants: SCREAMING_SNAKE_CASE

## Types
- Prefer interfaces over types for objects
- Use strict null checks
- No `any` without justification

[... full rule content ...]
```

## Creating Rules

When you identify a pattern that should be followed:

1. Create rule file:
   ```
   /wogi-rules add component-patterns
   ```

2. Document the pattern:
   - What: The rule/pattern
   - Why: Reason for the rule
   - Examples: Good and bad examples

3. Rule is automatically applied in future work

## Auto-Loading

Rules are loaded when:
- Starting a task that relates to the rule
- Creating files in a domain covered by a rule
- Skill rules load when skill is installed
