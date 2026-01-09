# Wogi Flow Roadmap

**Status**: Active backlog - implement based on user demand

---

## How to Use This Document

This roadmap contains planned features and improvements for Wogi Flow.
Items are organized by priority based on user demand and implementation effort.

**Rules**:
1. Review quarterly - are users asking for any of these?
2. Promote on demand - move items up when users request them
3. Delete if stale - remove items no one has asked about in 6 months
4. Track triggers - note what would make each feature valuable

**Adding Items**: When the user asks to add something to the roadmap, add it to the appropriate priority section with:
- **Source**: Where the idea came from
- **Why**: The problem it solves
- **Trigger**: When to implement
- **Effort**: Estimated effort

---

## Priority 1: Low-Hanging Fruit

Implement when users report specific pain points.

### Failure Category Enum

**Source**: Council §2.3 Enhanced Error Recovery
**Why**: Current error handling uses ad-hoc categories (import/type/syntax/runtime)
**Trigger**: When users report confusing error messages
**Effort**: 1-2 hours

```javascript
const FailureCategory = {
  PARSE_ERROR: 'parse_error',
  IMPORT_ERROR: 'import_error',
  TYPE_ERROR: 'type_error',
  SYNTAX_ERROR: 'syntax_error',
  RUNTIME_ERROR: 'runtime_error',
  RATE_LIMIT: 'rate_limit',
  CONTEXT_OVERFLOW: 'context_overflow',
  CAPABILITY_MISMATCH: 'capability_mismatch'
};
```

---

### Loop Retry Learning ✅

**Source**: User prompt handling documentation (2026-01-08)
**Why**: When tasks require multiple iterations, capture root cause and improve future execution
**Trigger**: When users notice repeated failures on similar tasks
**Effort**: 1-2 days
**Status**: Implemented 2026-01-09 in `scripts/flow-loop-retry-learning.js`

**Behavior**: When a task takes >3 iterations to complete:
1. Analyze iteration failures (what went wrong each time?)
2. Identify root cause category:
   - Unclear requirements in story
   - Missing context (skills, patterns)
   - Bad pattern in decisions.md
   - External issue (API, dependency)
3. Suggest update to appropriate file
4. Track pattern frequency across tasks

**Example output**:
```
Iteration Analysis:
- Iteration 1: Failed - validation schema mismatch
- Iteration 2: Failed - missing error state
- Iteration 3: Success

Root cause: Story didn't specify validation rules
Suggestion: Add to decisions.md - "Forms must specify validation rules in acceptance criteria"

Apply this learning? (y/n)
```

**Config addition**:
```json
"skillLearning": {
  "learnFromLoopRetries": true,
  "retryLearningThreshold": 3
}
```

---

### Cascade Fallback

**Source**: Council §3.7 Failure Handling
**Why**: If primary model fails 3x on same error, try alternate model
**Trigger**: When users report "stuck on same error repeatedly"
**Effort**: 4-6 hours
**Requires**: Users with multiple models configured

```javascript
// Config addition
"cascade": {
  "enabled": false,
  "fallbackModel": null,
  "maxFailuresBeforeEscalate": 3,
  "escalateOnCategories": ["capability_mismatch", "context_overflow"]
}
```

---

### Tiered Learning Thresholds

**Source**: Council Decision 6
**Why**: Smarter auto-application of learned patterns
**Trigger**: When model-adapter.js needs smarter auto-apply logic
**Effort**: 2-3 hours

```javascript
// Thresholds for auto-applying learnings
const LEARNING_TIERS = {
  AUTO_APPLY: { minSuccessRate: 0.9, minSamples: 5 },
  APPLY_WITH_LOG: { minSuccessRate: 0.7, minSamples: 3 },
  QUEUE_FOR_REVIEW: { minSuccessRate: 0, minSamples: 0 }
};
```

---

### Enhanced Model Stats

**Source**: Council §3.2 Model Registry (partial)
**Why**: Track success rates per model/task type
**Trigger**: When users ask "which model is best for X?"
**Effort**: 2-3 hours

```json
{
  "ollama-qwen": {
    "successRate": 0.87,
    "avgLatencyMs": 4500,
    "failuresByCategory": {
      "import_error": 12,
      "type_error": 5
    },
    "byTaskType": {
      "create-component": { "success": 45, "fail": 3 },
      "fix-bug": { "success": 22, "fail": 8 }
    },
    "totalRuns": 156
  }
}
```

---

## Priority 2: Valuable If Proven

Implement when data shows clear need.

### npm Package Distribution

**Source**: Internal discussion (2026-01-09)
**Why**: Enable easy installation, version pinning, and updates via npm
**Trigger**: When user base grows beyond current 3 users, or when v1.0 approaches
**Effort**: 1-2 days

**Approach**:
- Package name: `wogi-flow` (start at 0.x.x, hit 1.0 when roadmap complete)
- Global CLI: `npm install -g wogi-flow`
- Templates in package, runtime state stays per-project
- `flow upgrade` command for migrating projects

**Key requirement**: Every npm update must work perfectly - stability is critical.

---

### CLI Agnosticism

**Source**: User request (2026-01-08)
**Why**: Make wogi-flow work with any AI coding CLI (Claude Code, Gemini CLI, Codex, OpenCode, etc.)
**Trigger**: When users want to use wogi-flow with non-Claude CLIs
**Effort**: 2-4 weeks

**Approach**:
- **Universal structure**: Keep `.workflow/` as source of truth
- **CLI bridges/adapters**: Generate CLI-specific files from universal config
- **Installer asks CLI choice**: First question during `flow install` is "Which CLI are you using?"

**Architecture**:
```
.workflow/                    ← Universal source of truth
├── config.json
├── state/
└── skills/
         │
         ▼ (bridge generates)
┌─────────────────────────────────────────────┐
│  Claude Code    │  Gemini CLI   │  OpenCode │
│  .claude/       │  .gemini/     │  .opencode│
│  CLAUDE.md      │  GEMINI.md    │  config   │
└─────────────────────────────────────────────┘
```

**CLI Selection**:
- **Install-time** (default): Installer asks "Which CLI?" as first question
- **Runtime detection** (advanced): Auto-detect running CLI
- **Multi-CLI** (team scenarios): Generate for multiple CLIs

**Emulation Strategy**:
Skills = context loaders → can be emulated via bridges for CLIs without native skill support

**Downsides** (acknowledged):
- Bridge maintenance per CLI update
- May lose CLI-specific optimizations
- Extra abstraction layer

---

### Multi-Model Mode (Hybrid Evolution)

**Source**: User request (2026-01-08)
**Why**: Intelligent model routing - use best/cheapest model for each task
**Trigger**: When users want cost optimization or model-specific strengths
**Effort**: 3-5 weeks

**Key Concept**: Replaces/evolves Hybrid Mode - "Hybrid" now means "more than one model available"

**Granular Model Registry**:
```json
{
  "models": {
    "claude-opus-4.5": {
      "provider": "anthropic",
      "costTier": "premium",
      "context": {
        "maxTokens": 200000,
        "reliableAt": 150000,
        "hallucinationRisk": "low"
      },
      "languages": {
        "typescript": { "quality": "excellent" },
        "python": { "quality": "excellent" },
        "rust": { "quality": "good" }
      },
      "taskTypes": {
        "architecture": "excellent",
        "debugging": "excellent",
        "boilerplate": "overkill"
      }
    }
  }
}
```

**Intelligent Task Analysis** - Primary model estimates:
- Complexity level
- Token effort (context needed + expected output)
- Domains involved (api, db, frontend, etc.)
- Languages required
- Risk factors
- Recommended model + reasoning

**Routing Strategies**:
- **Task-based**: Route by task type + language
- **Cost-optimized**: Try cheapest first, escalate on failure
- **Quality-first**: Use best model, fallback if unavailable
- **Learned routing**: Track success rates, auto-optimize over time

**Global Learning (All Users Benefit)**:
Model performance data aggregated across ALL wogi-flow users:
- Success rates by task type + language + model
- Hallucination incidents at different context sizes
- Cost efficiency metrics
- Updated on session start (privacy-conscious: no code/prompts shared)

**Orchestrator**:
- **Default**: CLI's native model orchestrates
- **Configurable**: User sets preferred primary model in config

**Model-Specific Configuration & Prompting**:

Each model/provider needs tailored instructions for optimal results:

1. **Folder Structure Conventions**
   - Claude expects `.claude/skills/`, `.claude/rules/`
   - Gemini may expect `.gemini/` or different structure
   - Each CLI has its own hot-reload conventions
   - Universal `.workflow/` → CLI-specific bridge generation

2. **Provider-Level Rules** (e.g., all Gemini models)
   - Response format preferences
   - Tool use conventions
   - Context window handling
   - Known limitations/strengths

3. **Model Version Adjustments** (e.g., Opus 4.5 vs Opus 4)
   - Different prompting styles per version
   - Capability differences (older may lack features)
   - Cost tier mapping (use Opus 4.5 for planning, Opus 4 for execution)
   - Version-specific optimizations

4. **Prompt Templates per Model**
   - Base prompts adjusted for each model's training
   - System prompt variations
   - Tool call format differences
   - Output parsing expectations

```json
{
  "modelConfig": {
    "providers": {
      "anthropic": {
        "folderStructure": ".claude/",
        "rulesFile": "CLAUDE.md",
        "skillsPath": ".claude/skills/",
        "baseSystemPrompt": "You are Claude...",
        "models": {
          "claude-opus-4.5": {
            "promptStyle": "detailed",
            "costTier": "premium",
            "bestFor": ["planning", "architecture", "complex reasoning"],
            "systemPromptAdditions": "Focus on quality over speed."
          },
          "claude-opus-4": {
            "promptStyle": "detailed",
            "costTier": "standard",
            "bestFor": ["implementation", "code generation"],
            "systemPromptAdditions": ""
          },
          "claude-sonnet-4": {
            "promptStyle": "concise",
            "costTier": "budget",
            "bestFor": ["simple tasks", "boilerplate"],
            "systemPromptAdditions": "Be concise."
          }
        }
      },
      "google": {
        "folderStructure": ".gemini/",
        "rulesFile": "GEMINI.md",
        "skillsPath": ".gemini/skills/",
        "baseSystemPrompt": "You are Gemini...",
        "generalRules": [
          "Gemini prefers shorter context chunks",
          "Use explicit JSON mode for structured output",
          "Avoid nested tool calls"
        ],
        "models": {
          "gemini-2.5-pro": {
            "promptStyle": "structured",
            "costTier": "premium",
            "bestFor": ["planning", "multi-modal"],
            "knownIssues": ["May be verbose"]
          },
          "gemini-2.5-flash": {
            "promptStyle": "direct",
            "costTier": "budget",
            "bestFor": ["quick tasks", "simple edits"]
          }
        }
      }
    },
    "taskRouting": {
      "planning": { "preferModel": "claude-opus-4.5", "fallback": "gemini-2.5-pro" },
      "implementation": { "preferModel": "claude-opus-4", "fallback": "claude-sonnet-4" },
      "review": { "preferModel": "claude-opus-4.5" },
      "boilerplate": { "preferModel": "claude-sonnet-4", "fallback": "gemini-2.5-flash" }
    }
  }
}
```

**Why This Matters**:
- Same prompt yields different quality across models
- Optimal prompts for Opus differ from Sonnet differ from Gemini
- Model versions within same family have capability gaps
- Cost optimization requires knowing which model fits which task

**Hosted Pricing & Performance Table**:

Replace vague cost tiers ("expensive", "cheap") with real-time pricing data and measured performance:

1. **Live Pricing API**
   - Fetch current pricing from provider APIs (Anthropic, Google, OpenAI)
   - Update daily/weekly (prices change)
   - Show $/1M input tokens, $/1M output tokens
   - Calculate estimated cost per task type

2. **Performance Benchmarks per Task Type**
   - Measured success rates (not guesses)
   - Average tokens used per task type
   - Latency measurements
   - Quality scores from user feedback

3. **Cost-Performance Matrix**
   ```
   | Model           | Planning | Implementation | Review | Boilerplate |
   |-----------------|----------|----------------|--------|-------------|
   | claude-opus-4.5 | A ($0.42)| A ($0.38)      | A+     | C (overkill)|
   | claude-sonnet-4 | B ($0.08)| A ($0.07)      | B+     | A ($0.05)   |
   | gemini-2.5-pro  | A ($0.31)| B+ ($0.28)     | B      | C           |
   | gemini-2.5-flash| C ($0.02)| B ($0.02)      | C      | A ($0.01)   |
   ```

4. **Hosted Service Benefits**
   - Central source of truth (no stale local data)
   - Aggregated performance data across all users
   - Automatic model recommendations based on budget
   - Price alerts when models become cheaper/expensive

```json
{
  "pricingService": {
    "endpoint": "https://api.wogi-flow.io/pricing",
    "refreshInterval": "daily",
    "features": {
      "livePricing": true,
      "performanceBenchmarks": true,
      "costEstimates": true,
      "modelRecommendations": true
    }
  },
  "localCache": {
    "pricingData": ".workflow/cache/pricing.json",
    "maxAge": "24h"
  }
}
```

**Example Output**:
```
Model Recommendations for your task (implementation, TypeScript):

1. claude-sonnet-4    - $0.07 est. | Quality: A  | Best value
2. claude-opus-4      - $0.38 est. | Quality: A+ | Premium
3. gemini-2.5-flash   - $0.02 est. | Quality: B  | Budget

Based on 12,847 similar tasks across wogi-flow users.
```

**Auth & Team Management**:

| Tier | Setup | API Keys | Limits |
|------|-------|----------|--------|
| **Individual** | User adds own keys (env vars or config) | Personal | None |
| **Team** | Admin adds keys via web UI | Shared | Per-user limits, usage dashboard |

Team flow: Business owner adds API keys → team members use via proxy → admin controls limits via web UI

---

### Skill Library Marketplace

**Source**: Enhanced Installation Experience project (2026-01-08)
**Why**: Enable community sharing, discovery, and installation of curated skills
**Trigger**: When users ask "is there a skill for X?" or want to share learnings
**Effort**: 3-4 weeks
**Requires**: Remote hosting (GitHub-based initially), skill versioning

**Features**:

1. **Remote Skill Repository**
   - GitHub-hosted skill library (community skills repo)
   - Version control for skills with semantic versioning
   - Community contributions via PR

2. **Skill Discovery**
   - `/wogi-skills search [keyword]` - Search available skills
   - Browse by framework, category, popularity
   - Ratings and reviews from users

3. **Skill Installation**
   - `./scripts/flow skill install react-query` - One-command install
   - Dependency resolution (skill A requires skill B)
   - Automatic updates with `./scripts/flow skill update`

4. **Skill Publishing**
   - `./scripts/flow skill publish [name]` - Publish to community
   - Validation before publish (required files, quality checks)
   - Author attribution and version management

5. **Team Skills (Private)**
   - Private team skill repositories
   - Shared learnings synced across team members
   - Skill sync via team backend (requires team tier)

**Architecture**:
```
Community Repo (GitHub)           Team Repo (Private)
┌─────────────────────┐           ┌─────────────────────┐
│ skills/             │           │ team-skills/        │
│ ├── react-query/    │           │ ├── company-auth/   │
│ ├── stripe/         │           │ └── internal-api/   │
│ └── playwright/     │           └─────────────────────┘
└─────────────────────┘                     ↑
          ↓                                 │
    ┌─────────────────┐                     │
    │ flow skill      │ ────────────────────┘
    │ install/search  │
    │ publish/update  │
    └─────────────────┘
```

**CLI Commands**:
```bash
# Discovery
./scripts/flow skill search "state management"
./scripts/flow skill browse --category=react

# Installation
./scripts/flow skill install zustand        # From community
./scripts/flow skill install @team/auth    # From team repo

# Publishing
./scripts/flow skill publish my-skill --description "..."

# Management
./scripts/flow skill list                  # List installed
./scripts/flow skill update --all          # Update all skills
./scripts/flow skill remove zustand        # Remove skill
```

**Would implement when**: Users actively share skills or ask for pre-made skills for common libraries.

---

### Jira/Linear Integration

**Source**: Augment Code analysis (2026-01-08)
**Why**: See assigned tasks from project management tools, sync completed tasks back
**Trigger**: When users ask for task management integration
**Effort**: 1-2 days per integration
**Risk**: API changes, authentication complexity

Features:
- `/wogi-external-tasks` - List assigned tasks from Jira/Linear
- `/wogi-external-tasks --sync` - Sync completed tasks back
- `/wogi-external-tasks PROJ-123` - Import and start specific task
- Auto-create stories in ready.json from external tasks

```json
"integrations": {
  "jira": {
    "enabled": false,
    "baseUrl": "https://company.atlassian.net",
    "projectKey": "PROJ",
    "apiToken": "$JIRA_API_TOKEN"
  },
  "linear": {
    "enabled": false,
    "apiKey": "$LINEAR_API_KEY",
    "teamId": "TEAM-123"
  }
}
```

**Would implement when**: Users request integration with their project management tools.

---

### Quality Gate Confidence

**Source**: Council §3.6 Result Aggregation
**Why**: Don't apply low-confidence changes automatically
**Trigger**: When we see many bad outputs applied
**Effort**: 2-3 hours

```javascript
// Detect confidence markers in output
const confidenceMarkers = {
  high: ["I'm confident", "This will work", "Straightforward"],
  low: ["I think", "might work", "not entirely sure", "assuming"]
};
```

---

### Context Priority Scoring

**Source**: Council §3.5 Context Budgeter
**Why**: Smarter context selection than "include everything"
**Trigger**: If context overflow becomes common
**Effort**: 4-6 hours

```javascript
// Priority weights for context items
const CONTEXT_PRIORITIES = {
  required_types: 1.0,      // Always include
  target_file: 0.95,        // Almost always
  related_imports: 0.8,     // Usually helpful
  patterns: 0.7,            // Good to have
  examples: 0.5,            // Nice to have
  full_files: 0.3           // Only if space
};
```

---

### Formalized Model Registry

**Source**: Council §3.2 Model Registry
**Why**: Structured capability definitions for each model
**Trigger**: When supporting 5+ executor models
**Effort**: 3-4 hours

```json
{
  "models": {
    "gpt-4o-mini": {
      "provider": "openai",
      "contextWindow": 128000,
      "costTier": "cheap",
      "capabilities": ["code-generation", "structured-output"],
      "structuredOutputReliability": "high"
    }
  }
}
```

---

## Priority 3: Multi-Model Demand

Only implement if users have 3+ models configured.

### Task Router

**Source**: Council §3.3 Task Router
**Why**: Route different task types to optimal models
**Trigger**: When users have 3+ models and ask for routing
**Effort**: 1-2 days
**Risk**: Over-engineering for single-model users

---

### Parallel Dispatch

**Source**: Council Phase 4
**Why**: Execute independent subtasks on multiple models simultaneously
**Trigger**: When users request parallel execution for speed
**Effort**: 2-3 days
**Risk**: Complexity for unclear gain

---

### Prompt Fragment System

**Source**: Council §2.2 Prompt Template Modularization
**Why**: Composable prompt fragments vs monolithic templates
**Trigger**: When templates become unmanageable (20+ templates)
**Effort**: 1-2 days
**Risk**: Current Handlebars templates work fine

---

### Background Sync Daemon

**Source**: Beads framework analysis (Steve Yegge)
**Why**: Keep SQLite cache/state in sync with git when multiple agents work in parallel
**Trigger**: When users have multiple agents on different branches needing real-time awareness
**Effort**: 2-3 days
**Risk**: Over-engineering for single-agent workflows

The Beads framework uses a background daemon for:
- Watching .workflow/state/ and related paths for changes
- Syncing on branch switch (git checkout)
- Heartbeat monitoring (every 5 seconds)
- Automatic cache invalidation

```javascript
// Conceptual - watches for changes and syncs
const daemon = {
  watchPaths: ['.workflow/state/', '.beads/'],
  syncOnChange: true,
  syncOnBranchSwitch: true,
  heartbeatMs: 5000,
  onFileChange: (path) => {
    invalidateCache(path);
    notifyOtherAgents(path);
  }
};
```

**Would implement if**: Users report stale data when switching between agent contexts or branches.

---

### Team Observability Web UI

**Source**: Vercel Workflow DevKit analysis (2026-01-07)
**Why**: Real-time visibility into task progress, step status, execution history
**Trigger**: When team features launch with paid tier
**Effort**: 2-3 weeks
**Requires**: Team database hosting, authentication

Features inspired by Workflow DevKit:
- Web UI showing all runs with status
- Per-step spans with inputs/outputs
- Retry history and failure context
- Team-wide task dashboard
- Role-based access (admin, lead, member)

```javascript
// Conceptual - observability dashboard
const dashboard = {
  views: ['all-runs', 'my-tasks', 'team-overview'],
  filters: ['status', 'assignee', 'date-range'],
  stepDetails: {
    showInputs: true,
    showOutputs: true,
    showRetryHistory: true,
    showDuration: true
  },
  roles: {
    admin: ['view-all', 'cancel-any', 'reassign'],
    lead: ['view-team', 'cancel-team'],
    member: ['view-own', 'cancel-own']
  }
};
```

**Would implement when**: Team tier launches with shared database hosting.

---

## Priority 4: Skip Unless Compelling

We're skeptical these add value. Would need strong evidence.

### Structured JSON Contract

**Source**: Council §2.1
**Why We're Skeptical**: Local LLMs can't reliably produce JSON
**Would Reconsider If**: New models achieve 95%+ JSON reliability
**Current Solution**: `flow-response-parser.js` handles messy output

---

### SQLite Telemetry

**Source**: Council §2.4
**Why We're Skeptical**: JSON files work fine for 50 runs/day
**Would Reconsider If**: Users need complex queries across runs
**Concerns**: Native dependency, not human-readable, overkill

---

### 12-Week Implementation Roadmap

**Source**: Council §4
**Why We're Skeptical**: Too long for uncertain ROI
**Would Reconsider If**: Clear user demand emerges for full multi-model
**Current Approach**: Cherry-pick valuable pieces incrementally

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-09 | Added: Hosted Pricing & Performance Table - live pricing API, performance benchmarks, cost-performance matrix, model recommendations |
| 2026-01-09 | Added: Model-Specific Configuration & Prompting - folder structures, provider rules, version adjustments, prompt templates per model |
| 2026-01-09 | Added: npm Package Distribution - easy install/update via npm (Priority 2) |
| 2026-01-09 | ✅ Implemented: Loop Retry Learning - analyzes tasks >3 iterations, identifies root causes, suggests pattern updates |
| 2026-01-08 | Added: Loop Retry Learning - learn from excessive loop iterations to improve future executions |
| 2026-01-08 | Added: Skill Library Marketplace - community skills sharing and discovery |
| 2026-01-08 | ✅ Implemented: Enhanced Installation Experience - hub-spoke skills, tech stack wizard |
| 2026-01-08 | Added: CLI Agnosticism - universal structure with CLI bridges |
| 2026-01-08 | Added: Multi-Model Mode - evolution of hybrid with intelligent routing, global learning |
| 2026-01-08 | Removed: Multi-Model Orchestration (superseded by Multi-Model Mode) |
| 2026-01-08 | Added: Jira/Linear Integration (from Augment Code analysis) |
| 2026-01-08 | ✅ Implemented: agent_requested rule type in flow-rules-sync.js |
| 2026-01-08 | ✅ Implemented: Component Index Freshness (afterTask, staleCheck, gitHooks) |
| 2026-01-08 | ✅ Implemented: Guided Edit Mode (flow-guided-edit.js, wogi-guided-edit command) |
| 2026-01-07 | Added: Team Observability Web UI (from Vercel Workflow DevKit analysis) |
| 2026-01-06 | Added: Multi-Model Orchestration (from oh-my-opencode analysis) |
| 2026-01-06 | Added: Background Sync Daemon (from Beads analysis) |
| 2026-01-02 | Initial backlog created from council review |
| 2026-01-02 | ✅ Implemented: Failure Category Enum (as ERROR_CATEGORIES) |
| 2026-01-02 | ✅ Implemented: Strategy effectiveness tracking |
| 2026-01-02 | ✅ Implemented: Learning deduplication (7-day window) |
| 2026-01-02 | ✅ Implemented: Auto-PR contribution mechanism |

## Implemented Items (Moved from Backlog)

### Failure Category Enum ✅
- **Implemented in**: `scripts/flow-adaptive-learning.js`
- **As**: `ERROR_CATEGORIES` with IMPORT_ERROR, TYPE_ERROR, SYNTAX_ERROR, MARKDOWN_POLLUTION, INCOMPLETE_OUTPUT, HALLUCINATION

### Strategy Effectiveness Tracking ✅
- **Implemented in**: `scripts/flow-adaptive-learning.js`
- **Features**: Tracks success/failure per strategy per model
- **Command**: `./scripts/flow hybrid learning effectiveness`

### Learning Deduplication ✅
- **Implemented in**: `scripts/flow-adaptive-learning.js`
- **Behavior**: Skips recording duplicate learnings within 7-day window

### Community Contribution ✅
- **Implemented in**: `scripts/flow-adaptive-learning.js`
- **Commands**: `flow hybrid learning contribute` and `--auto-pr` option

### Loop Retry Learning ✅
- **Implemented in**: `scripts/flow-loop-retry-learning.js`
- **Features**: Analyzes tasks taking >3 iterations, categorizes root causes (validation failures, missing context, etc.), suggests pattern updates
- **Config**: `skillLearning.learnFromLoopRetries`, `skillLearning.loopRetryThreshold`
- **Commands**: `node scripts/flow-loop-retry-learning.js stats|suggestions|test`
