# Workflow Steps

Modular workflow engine with declarative YAML-based step definitions, conditional routing, and bounded loops.

---

## Overview

Workflow steps provide a declarative way to define automated workflows. Define steps in YAML, and the engine handles execution, conditions, loops, and error handling.

---

## Step Types

```
┌─────────────────────────────────────────────────────────────────────┐
│                        STEP TYPES                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   COMMAND          Execute shell command                            │
│   ───────          npm run build, git push                         │
│                                                                      │
│   SCRIPT           Run a script file                                │
│   ──────           ./scripts/deploy.sh                             │
│                                                                      │
│   GATE             Require condition before proceeding              │
│   ────             tests must pass, approval required               │
│                                                                      │
│   LOOP             Repeat steps until condition                     │
│   ────             retry up to 5 times                             │
│                                                                      │
│   PARALLEL         Execute steps concurrently                       │
│   ────────         run tests and lint in parallel                  │
│                                                                      │
│   CONDITIONAL      Branch based on condition                        │
│   ───────────      if staging then... else...                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Definition

Workflows are defined in `.workflow/workflows/`:

```yaml
# .workflow/workflows/deploy.yaml
name: deploy
description: Deploy to production
version: 1.0.0

steps:
  - id: build
    type: command
    command: npm run build

  - id: test
    type: command
    command: npm test
    depends: [build]

  - id: deploy
    type: script
    script: ./scripts/deploy.sh
    depends: [test]
    condition: "env.CI === 'true'"
```

---

## Step Properties

| Property | Required | Description |
|----------|----------|-------------|
| `id` | Yes | Unique step identifier |
| `type` | Yes | Step type (command, script, gate, etc.) |
| `depends` | No | Array of step IDs that must complete first |
| `condition` | No | Expression that must be true to run |
| `timeout` | No | Max execution time in milliseconds |
| `retries` | No | Number of retry attempts on failure |

---

## Command Steps

Execute shell commands:

```yaml
- id: install
  type: command
  command: npm install

- id: build
  type: command
  command: npm run build
  timeout: 120000  # 2 minutes
  retries: 2
```

---

## Script Steps

Run script files:

```yaml
- id: migrate
  type: script
  script: ./scripts/migrate.sh
  env:
    DATABASE_URL: ${DATABASE_URL}
```

---

## Gate Steps

Require a condition before proceeding:

```yaml
- id: approval
  type: gate
  gate:
    type: manual
    prompt: "Deploy to production?"

- id: tests-pass
  type: gate
  gate:
    type: check
    command: npm test
    expect: "exit 0"
```

---

## Loop Steps

Repeat until condition is met:

```yaml
- id: retry-deploy
  type: loop
  maxIterations: 5
  steps:
    - id: deploy-attempt
      type: command
      command: ./deploy.sh
  until: "result.exitCode === 0"
```

---

## Parallel Steps

Execute concurrently:

```yaml
- id: quality-checks
  type: parallel
  steps:
    - id: lint
      type: command
      command: npm run lint
    - id: typecheck
      type: command
      command: npm run typecheck
    - id: test
      type: command
      command: npm test
```

---

## Conditional Steps

Branch based on conditions:

```yaml
- id: deploy-target
  type: conditional
  condition: "env.ENVIRONMENT"
  branches:
    staging:
      - id: deploy-staging
        type: command
        command: ./deploy.sh staging
    production:
      - id: deploy-prod
        type: command
        command: ./deploy.sh production
    default:
      - id: deploy-dev
        type: command
        command: ./deploy.sh dev
```

---

## Configuration

```json
{
  "workflows": {
    "enabled": true,
    "directory": ".workflow/workflows",
    "maxIterations": 100,        // Loop iteration limit
    "defaultTimeout": 120000,    // 2 minutes
    "validateOnLoad": true,      // Validate workflow syntax
    "allowUnsafeCommands": false // Block dangerous commands
  }
}
```

---

## CLI Commands

```bash
# List available workflows
flow workflow list

# Run a workflow
flow workflow run deploy

# Run with environment variables
flow workflow run deploy --env ENVIRONMENT=staging

# Validate workflow syntax
flow workflow validate deploy

# Create new workflow from template
flow workflow create my-workflow
```

---

## Context Variables

Available in conditions and templates:

| Variable | Description |
|----------|-------------|
| `env.*` | Environment variables |
| `result.*` | Previous step result |
| `workflow.*` | Workflow metadata |
| `project.*` | Project info |

Example:
```yaml
condition: "env.CI === 'true' && result.build.exitCode === 0"
```

---

## Step Dependencies

Steps can depend on other steps:

```yaml
steps:
  - id: install
    type: command
    command: npm install

  - id: build
    type: command
    command: npm run build
    depends: [install]  # Waits for install

  - id: test
    type: command
    command: npm test
    depends: [build]    # Waits for build
```

---

## Error Handling

### Retries

```yaml
- id: flaky-step
  type: command
  command: ./flaky-operation.sh
  retries: 3
  retryDelay: 5000  # 5 seconds between retries
```

### On Failure

```yaml
- id: deploy
  type: command
  command: ./deploy.sh
  onFailure:
    - id: rollback
      type: command
      command: ./rollback.sh
    - id: notify
      type: command
      command: ./notify-failure.sh
```

---

## Built-in Workflows

| Workflow | Purpose |
|----------|---------|
| `task-complete` | Quality gates on task completion |
| `pre-commit` | Pre-commit checks |
| `deploy-staging` | Deploy to staging environment |

---

## Creating Custom Workflows

```bash
# Create from template
flow workflow create my-workflow

# This creates:
# .workflow/workflows/my-workflow.yaml
```

Template structure:
```yaml
name: my-workflow
description: Description of what this workflow does
version: 1.0.0

steps:
  - id: step-1
    type: command
    command: echo "Step 1"
```

---

## Best Practices

1. **Use meaningful step IDs** - `build` not `step1`
2. **Set appropriate timeouts** - Prevent hanging steps
3. **Use retries for flaky operations** - Network calls, deployments
4. **Keep workflows focused** - One workflow per concern
5. **Validate before running** - `flow workflow validate`

---

## Related

- [Execution Loop](./02-execution-loop.md) - Task execution flow
- [Quality Gates](./03-verification.md) - Verification steps
- [Configuration](../configuration/all-options.md) - Workflow settings
