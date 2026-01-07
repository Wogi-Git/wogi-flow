Create a bug report. Provide title: `/wogi-bug Login button not responding`

Run `./scripts/flow bug "<title>"` to create a bug report.

Options:
- `--from <task-id>` - Task ID that discovered this bug (auto-populated if task in progress)
- `--priority <P>` - Priority P0-P4 (auto-boosted to P1 if discovered during task)
- `--severity <s>` - Severity: critical, high, medium, low (default: medium)
- `--json` - Output JSON

Examples:
```bash
flow bug "Login button not responding"
flow bug "Null pointer in Profile API" --from wf-a1b2c3d4 --priority P0
flow bug "Fix auth header" --severity critical
```

Output:
```
Created: wf-f2d409c2

File: .workflow/bugs/wf-f2d409c2.md
Title: Login button not responding
Priority: P1
Severity: medium
Discovered From: wf-a1b2c3d4 (auto-detected)
```

Bug report includes:
- Hash-based ID (wf-XXXXXXXX format)
- Priority (P0-P4, auto-boosted if discovered during task)
- Discovered From tracking (links bug to source task)
- Description
- Steps to reproduce
- Expected vs Actual
- Severity
- Tags (#bug, #screen:X, #component:Y)
- Status tracking

The `discovered-from` field enables learning:
- Track which tasks tend to discover bugs
- Auto-boost priority when bug is found during task work
- Link bugs back to their source for better traceability
