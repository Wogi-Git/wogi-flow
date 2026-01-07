# Multi-Model Orchestration Backlog

**Source**: AI Council Review (2026-01-02)
**Council Members**: Claude Opus 4.5, GPT 5.2, Grok 4, Gemini 3 Pro
**Status**: Backlog - implement based on user demand

---

## How to Use This Document

This backlog contains valuable suggestions from a council review of multi-model architecture.
We've organized them by priority based on current Wogi Flow needs.

**Rules**:
1. Review quarterly - are users asking for any of these?
2. Promote on demand - move items up when users request them
3. Delete if stale - remove items no one has asked about in 6 months
4. Track triggers - note what would make each feature valuable

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

### Multi-Model Orchestration

**Source**: oh-my-opencode (Sisyphus) analysis
**Why**: Different AI models excel at different tasks - use the right tool for the job
**Trigger**: When users want to optimize cost/quality tradeoffs or leverage model strengths
**Effort**: 3-5 days
**Risk**: Complexity, API key management, cost tracking

Concept from oh-my-opencode's Sisyphus agent:
- Opus/GPT-5 for complex orchestration and debugging
- Sonnet/Haiku for documentation and exploration
- Gemini for frontend/UI tasks
- Specialized models for specific domains

Would require:
- Model registry with capabilities
- Task-to-model routing logic
- Fallback chains when models fail
- Cost tracking per model
- Config for model preferences

```javascript
// Conceptual routing
"modelRouting": {
  "orchestration": "claude-opus",
  "exploration": "claude-haiku",
  "frontend": "gemini-pro",
  "debugging": "gpt-5",
  "documentation": "claude-sonnet"
}
```

---

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
