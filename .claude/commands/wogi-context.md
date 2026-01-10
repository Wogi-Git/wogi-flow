Load all context needed to implement a task. Provide task ID: `/wogi-context wf-012`

Gather:
1. **Story** - From `.workflow/changes/*/wf-XXX.md` or tasks.json
2. **Related history** - Search request-log for task ID and related tags
3. **Components** - Load details for any components mentioned in technical notes
4. **Decisions** - Show relevant patterns from decisions.md

Output:
```
📚 Context for wf-012

═══════════════════════════════════════
STORY
═══════════════════════════════════════
[Full story content with acceptance criteria]

═══════════════════════════════════════
RELATED HISTORY
═══════════════════════════════════════
• R-038: Added AuthForm component
• R-032: Created login screen

═══════════════════════════════════════
COMPONENTS
═══════════════════════════════════════
Button (primary, secondary):
  Path: components/ui/Button
  Used in: LoginForm, SignupForm

Link (default, subtle):
  Path: components/ui/Link

═══════════════════════════════════════
DECISIONS
═══════════════════════════════════════
• Use Link component for navigation, not button
• Form validation uses react-hook-form

Ready to implement.
```
