Initialize Wogi Flow in a new project.

Creates the complete workflow structure:

```
.workflow/
  config.json          # Workflow configuration
  state/
    ready.json         # Task queue
    request-log.md     # Change history
    app-map.md         # Component registry
    decisions.md       # Project decisions
    progress.md        # Session handoff notes
    feedback-patterns.md
    components/        # Component detail docs
  changes/             # Feature work
  bugs/                # Bug reports
  tests/flows/         # Browser test flows
  specs/               # Project specs
  archive/             # Completed work

.claude/
  commands/            # Slash commands (this folder)

CLAUDE.md              # AI instructions
agents/                # Agent personas
templates/             # Document templates
scripts/               # CLI tools
```

After init:
1. Edit `.workflow/config.json` with project name
2. Run `/wogi-health` to verify setup
3. Start with `/wogi-feature` or `/wogi-story`
