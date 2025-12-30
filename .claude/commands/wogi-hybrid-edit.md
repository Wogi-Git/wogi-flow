---
description: Edit the current execution plan before running
---

# Edit Hybrid Plan

Show me the current plan and what you'd like to change.

## Current Plan

```bash
if [ -f ".workflow/state/current-plan.json" ]; then
    jq '.' .workflow/state/current-plan.json
else
    echo "No plan currently loaded"
fi
```

## Edit Options

Tell me what you'd like to change:

1. **Add a step** - Describe what you want to add
2. **Remove a step** - Tell me which step number to remove
3. **Modify a step** - Tell me which step and what to change
4. **Reorder steps** - Specify the new order
5. **Change execution mode** - Mark steps as parallel/sequential

## Example Requests

- "Add a step to create unit tests after the service"
- "Remove step 3, I'll handle that manually"
- "Change step 2 to use React Hook Form instead"
- "Make steps 1-3 run in parallel"

What would you like to change?
