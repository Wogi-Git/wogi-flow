Analyze an existing project and set up workflow with full context.

Usage: `/wogi-onboard`

## When to Use

- Starting to use Wogi Flow on an existing codebase
- After cloning a project you haven't worked on before
- When joining a new team/project

## What It Does

### 1. Analyzes Your Project
- Detects language (TypeScript, Python, Go, etc.)
- Detects framework (Next.js, NestJS, React, FastAPI, etc.)
- Detects database (PostgreSQL, MongoDB, etc.)
- Scans for components, pages, modules, API routes
- Counts lines of code

### 2. Asks About Your Project
- Project name and description
- PRD or documentation (can read files or paste content)
- Current state (early dev, MVP, production, maintenance)
- Goals (add features, fix bugs, refactor, etc.)
- Known issues and tech debt
- Coding conventions

### 3. Generates Workflow Files
- `project.md` - Full project specification with tech stack, goals, docs
- `app-map.md` - Auto-populated component registry
- `decisions.md` - Coding patterns and conventions
- Initial tasks from known issues

### 4. Suggests Skills
Based on detected framework, suggests relevant skills:
- NestJS → nestjs skill
- React/Next.js → react skill
- FastAPI/Django → python skill

## Output

```
🔍 Wogi Flow - Project Onboarding

━━━ Analyzing Project ━━━

  Language:  TypeScript
  Framework: NestJS
  Database:  PostgreSQL (TypeORM)

Scanning for components... ✓ Found 24 components/modules
Scanning for API routes... ✓ Found 15 API routes/controllers

━━━ Project Interview ━━━

[Interactive questions...]

━━━ Generating Workflow Files ━━━

✓ Created project.md
✓ Created app-map.md with 24 entries
✓ Created decisions.md
✓ Created 5 initial tasks from known issues
✓ Recommended skill: nestjs

╔═══════════════════════════════════════════════════════════════╗
║           ✅ Project Onboarding Complete!                     ║
╚═══════════════════════════════════════════════════════════════╝
```

## After Onboarding

The AI now has full context about your project:
- Tech stack and architecture
- Existing components and their locations
- Coding patterns to follow
- Known issues to fix
- Project goals

You can:
- Ask it to analyze specific code
- Ask for improvement suggestions
- Create new features that fit the architecture
- Fix bugs with proper context

## Files Created

| File | Purpose |
|------|---------|
| `.workflow/specs/project.md` | Full project specification |
| `.workflow/state/app-map.md` | Component registry (auto-populated) |
| `.workflow/state/decisions.md` | Coding patterns |
| `.workflow/changes/onboarding/tasks.json` | Initial tasks |

## CLI Equivalent

```bash
./scripts/flow onboard
```
