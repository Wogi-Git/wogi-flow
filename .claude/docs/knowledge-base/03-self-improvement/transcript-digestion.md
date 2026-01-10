# Transcript Digestion

A multi-pass extraction system for processing large transcripts and unstructured inputs with zero assumptions.

---

## Overview

The Transcript Digestion skill methodically extracts every requirement from large inputs (meeting transcripts, spec documents) using a 4-pass algorithm that ensures 100% coverage with source tracing.

---

## When to Use

- Processing meeting transcripts (1-2+ hours of discussion)
- Large spec documents or requirements lists
- Any input > 2000 words with multiple topics
- When you need 100% coverage with source tracing

---

## The 4-Pass Algorithm

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSCRIPT DIGESTION                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PASS 1: Topic Extraction                                          │
│   ─────────────────────────                                          │
│   → Identify distinct features/themes                               │
│   → Create topic hierarchy                                           │
│                                                                      │
│   PASS 2: Statement Association                                      │
│   ────────────────────────────                                       │
│   → Map every statement to a topic                                   │
│   → Track source locations                                           │
│                                                                      │
│   PASS 3: Orphan Check                                               │
│   ───────────────────                                                │
│   → Find unmapped statements                                         │
│   → Ensure 100% coverage                                             │
│                                                                      │
│   PASS 4: Contradiction Resolution                                   │
│   ──────────────────────────────                                     │
│   → Detect mind-changes in discussion                               │
│   → Ask for clarification                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Configuration

```json
{
  "transcriptDigestion": {
    "enabled": true,
    "autoTriggerThreshold": 2000,    // Word count to auto-trigger
    "clarificationStyle": "grouped", // "grouped" | "inline" | "batch"
    "verificationLevel": "statement", // "statement" | "topic" | "document"
    "supportedLanguages": ["en", "uk", "ru", "he"]
  }
}
```

### Settings Explained

| Setting | Default | Purpose |
|---------|---------|---------|
| `autoTriggerThreshold` | 2000 | Min words to auto-invoke skill |
| `clarificationStyle` | "grouped" | How to ask clarifying questions |
| `verificationLevel` | "statement" | Granularity of verification |

---

## Auto-Trigger Conditions

The skill auto-triggers when:

1. User input exceeds `autoTriggerThreshold` words
2. Content is classified as requirements/specs/transcript
3. Risk of missing items is detected

---

## State Files

Digestion sessions are stored in `.workflow/state/digests/`:

```
.workflow/state/digests/
├── active-digest.json         # Current session tracker
└── [digest-id]/
    ├── transcript.md          # Original input
    ├── topics.json            # Extracted topics
    ├── statement-map.json     # Statement tracking
    ├── orphans.json           # Unmapped statements
    └── clarifications.json    # Q&A log
```

---

## Core Principles

### Statement-Level Tracking

Every meaningful statement from the transcript maps to a spec item:

```json
{
  "statement": "Users should be able to reset their password",
  "sourceLocation": "15:42",
  "topic": "authentication",
  "mappedTo": "US-003",
  "confidence": 0.95
}
```

### No Assumptions

The system asks questions until crystal clear:

```
Found ambiguity in statement at 23:15:
"Make the login fast"

What does "fast" mean specifically?
- [ ] Under 500ms
- [ ] Under 1 second
- [ ] Under 2 seconds
- [ ] Other: ___
```

### Source Tracing

Every requirement links back to the original transcript:

```markdown
## US-003: Password Reset

**Source**: Transcript 15:42-16:30
> "Users should be able to reset their password via email..."
```

---

## Commands

| Command | Description |
|---------|-------------|
| `/transcript-digest` | Start digestion process on provided input |

---

## Example Flow

1. **User provides transcript** (meeting notes, voice recording)
2. **Pass 1**: System identifies 8 distinct topics
3. **Pass 2**: Maps 142 statements to topics
4. **Pass 3**: Finds 3 orphan statements, asks for classification
5. **Pass 4**: Detects 2 contradictions, asks for resolution
6. **Output**: 15 user stories with full source tracing

---

## Integration

| Feature | Integration |
|---------|-------------|
| Voice Input | Accepts output from `flow voice-input` |
| Story Creation | Generates stories in wogi-flow format |
| ready.json | Approved stories added automatically |
| Durable Sessions | Integrates with `/wogi-resume` |

---

## File Patterns

Automatically triggers for:
- `*.transcript.md` - Markdown transcript files
- `*.vtt` - Web Video Text Tracks
- `*.srt` - SubRip Subtitle files

---

## Best Practices

1. **Provide raw transcripts** - Don't pre-process, let the system extract
2. **Review orphans carefully** - They often contain important edge cases
3. **Verify contradictions** - The latest statement isn't always correct
4. **Keep clarifications** - Q&A log is valuable for future reference

---

## Related

- [Skill Learning](./skill-learning.md) - How skills are created and updated
- [Task Planning](../02-task-execution/01-task-planning.md) - Story creation from digested content
- [Voice Input](../05-development-tools/voice-input.md) - Capturing meeting audio
