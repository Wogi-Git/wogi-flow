---
name: _template
version: 1.0.0
description: Template for creating new skills - DO NOT LOAD
scope: project
lastUpdated: {{DATE}}
learningCount: 0
successRate: 0
template: true
loadable: false
---

<!--
  ⚠️  THIS IS A TEMPLATE - DO NOT LOAD THIS SKILL

  To create a new skill, copy this directory and replace:
  - {{SKILL_NAME}} with your skill name
  - {{SHORT_DESCRIPTION}} with a brief description
  - {{USE_CASE_*}} with actual use cases
  - {{FILE_PATTERN_*}} with file globs
  - {{DATE}} with current date
-->

# {{SKILL_NAME}} Skill

## When to Use

- {{USE_CASE_1}}
- {{USE_CASE_2}}

## Quick Reference

### Key Patterns
- Pattern 1: Description
- Pattern 2: Description

### Common Mistakes to Avoid
- See `knowledge/anti-patterns.md` for details

## Progressive Content

Load these files when relevant:

| File | When to Load |
|------|--------------|
| `knowledge/learnings.md` | Starting a task with this skill |
| `knowledge/patterns.md` | Looking for examples |
| `knowledge/anti-patterns.md` | Reviewing code or fixing issues |
| `rules/conventions.md` | Writing new code |

## File Patterns

This skill applies to files matching:
- `{{FILE_PATTERN_1}}`
- `{{FILE_PATTERN_2}}`

## Commands

| Command | Description |
|---------|-------------|
| `/{{SKILL_NAME}}-{{ACTION}}` | Description |

## Integration

### Dependencies
- None

### Related Skills
- None
