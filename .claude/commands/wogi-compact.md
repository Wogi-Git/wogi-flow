Compact the conversation to free up context space.

Before compacting, save current state:

1. **Update progress.md** with:
   - Current task being worked on
   - What's been done this session
   - Next steps
   - Any decisions made

2. **Ensure request-log is current** - All changes logged

3. **Save any in-progress work** - Commit or stash

Then trigger compaction with a summary that includes:
- Session goal
- Tasks completed
- Current task and its state
- Key decisions made
- Files modified

Format for compact summary:
```
## Session Summary for Compaction

**Goal**: [What user wanted to accomplish]

**Completed**:
- [Task/change 1]
- [Task/change 2]

**In Progress**:
- TASK-XXX: [description] - [current state, what's left]

**Key Decisions**:
- [Decision 1]
- [Decision 2]

**Files Modified**:
- [file1.tsx] - [what changed]
- [file2.tsx] - [what changed]

**Next Steps**:
1. [Step 1]
2. [Step 2]

**Context to Preserve**:
- [Important context that should survive compaction]
```

After providing this summary, tell user: "Ready to compact. Please run /compact or continue and I'll auto-compact when needed."
