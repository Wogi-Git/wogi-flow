Display project roadmap with phases and progress.

Usage: `/wogi-roadmap`

## When Available

Only when `config.json` has `phases.enabled: true`

## Steps

1. Check if phase-based planning is enabled
2. Read `.workflow/specs/ROADMAP.md` for phase definitions
3. Read `ready.json` for task statuses
4. Calculate progress per phase
5. Display visual roadmap

## Output

```
🗺️ Project Roadmap

Phase Overview
══════════════════════════════════════════════════════════════

Phase 0: Project Setup           ████████████████████ 100% ✓
  5/5 features completed

Phase 1: Core Infrastructure     ████████████░░░░░░░░  60%
  3/5 features completed
  • F006: Database setup ✓
  • F007: Auth module ✓
  • F008: User service ✓
  • F009: API gateway ← in progress
  • F010: Logging (blocked)

Phase 2: Core Features           ░░░░░░░░░░░░░░░░░░░░   0%
  0/8 features completed
  Blocked by: Phase 1

Phase 3: Business Logic          ░░░░░░░░░░░░░░░░░░░░   0%
  0/6 features completed
  Blocked by: Phase 2

Phase 4: Testing & Docs          ░░░░░░░░░░░░░░░░░░░░   0%
  0/4 features completed
  Blocked by: Phase 3

══════════════════════════════════════════════════════════════

Current: Phase 1 - Core Infrastructure
Next milestone: Phase 1 complete (2 features remaining)
```

## If Phases Not Enabled

```
⚠️ Phase-based planning is not enabled.

To enable:
1. Edit .workflow/config.json
2. Set "phases.enabled": true
3. Create .workflow/specs/ROADMAP.md with phase definitions
4. Add "phase" field to tasks in ready.json

Or run: /wogi-config phases on
```
