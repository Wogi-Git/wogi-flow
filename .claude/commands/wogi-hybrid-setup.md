---
description: Set up hybrid mode - generates templates and configures local LLM
---

# Hybrid Mode Setup

This command sets up everything needed for hybrid mode in your project.

## Step 1: Generate Project Templates

Analyzing your codebase and generating customized templates:

```bash
node scripts/flow-templates.js generate
```

## Step 2: Enable Hybrid Mode

Running the interactive setup wizard to configure your local LLM:

```bash
node scripts/flow-hybrid-interactive.js
```

## What This Does

1. **Analyzes your project**
   - Detects framework (React, Next.js, Vue, Angular, etc.)
   - Detects state management (Zustand, Redux, MobX, etc.)
   - Detects styling (Tailwind, Styled Components, etc.)
   - Finds code examples from your components, hooks, services

2. **Generates templates** in `templates/hybrid/`
   - `_base.md` - Universal rules for your stack
   - `_patterns.md` - Your actual coding patterns
   - Task-specific templates (create-component, create-hook, etc.)

3. **Configures local LLM**
   - Detects Ollama and/or LM Studio
   - Lists available models
   - Tests the connection
   - Saves configuration to `config.json`

4. **Creates state file**
   - `hybrid-session.json` for tracking execution

## Requirements

Before running, ensure you have a local LLM running:

**Ollama:**
```bash
ollama serve
ollama pull nemotron-3-nano  # or your preferred model
```

**LM Studio:**
- Open the app
- Download a model
- Start the local server

## After Setup

Use these commands:
- `/wogi-hybrid-status` - Check configuration
- `/wogi-hybrid-off` - Disable hybrid mode
- `/wogi-hybrid-edit` - Edit plans before execution

## Token Savings

| Task Size | Normal | Hybrid | Savings |
|-----------|--------|--------|---------|
| Small | ~8K | ~1.2K | 85% |
| Medium | ~20K | ~1.8K | 91% |
| Large | ~45K | ~2.5K | 94% |

Let me set up hybrid mode for your project now...
