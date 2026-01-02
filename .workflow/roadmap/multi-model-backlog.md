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
