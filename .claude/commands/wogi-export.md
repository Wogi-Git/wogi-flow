Export workflow configuration as a shareable profile.

Usage: `/wogi-export [profile-name]`

Creates a zip containing:
- CLAUDE.md
- agents/ directory
- .workflow/config.json
- .claude/commands/ directory
- Optionally: .workflow/state/decisions.md

Output:
```
📦 Exporting profile: my-team

Include decisions.md? (Contains project-specific patterns)
[y/n]: y

Creating: my-team.zip
  ✓ CLAUDE.md
  ✓ agents/ (11 files)
  ✓ .workflow/config.json
  ✓ .claude/commands/ (20 files)
  ✓ decisions.md

✓ Exported: my-team.zip

Share this with team members.
They can import with: /wogi-import my-team.zip
```

This allows teams to share:
- Refined agent instructions
- Agreed-upon coding decisions
- Custom slash commands
- Quality gate configuration
