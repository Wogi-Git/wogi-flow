Import a team workflow profile.

Usage: `/wogi-import [profile.zip]`

Steps:
1. Backup current config (optional)
2. Extract and copy:
   - CLAUDE.md
   - agents/
   - .workflow/config.json
   - .claude/commands/
   - decisions.md (if included)
3. Notify user to restart Claude

Output:
```
📥 Importing profile: team-v2.zip

Create backup of current config? [y/n]: y
  ✓ Backup created: .workflow/backup-2024-01-15/

Importing:
  ✓ CLAUDE.md (replaced)
  ✓ agents/ (11 files)
  ✓ config.json (merged)
  ✓ commands/ (20 files)
  ✓ decisions.md (merged)

✓ Import complete!

⚠️ Please restart Claude to load new commands.

Changes:
- 3 new slash commands added
- config: storybook now enabled
- 2 new decisions added
```

Merge vs Replace:
- Commands: Added (no replace)
- Config: Merged (your overrides preserved)
- Decisions: Merged (appended)
- Agents: Replaced
- CLAUDE.md: Replaced
