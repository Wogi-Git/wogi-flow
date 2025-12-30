---
description: Disable hybrid mode and return to normal operation
---

# Disable Hybrid Mode

Turning off hybrid mode. I'll go back to executing everything directly.

```bash
# Update config
cd "$(pwd)" && cat .workflow/config.json | jq '.hybrid.enabled = false' > /tmp/config.tmp && mv /tmp/config.tmp .workflow/config.json

echo "✅ Hybrid mode disabled"
```

## What Changes

- I'll write code directly instead of creating plans
- All execution happens via Claude (no local LLM)
- No token savings, but simpler workflow

## Re-enabling

Run `/wogi-hybrid` to enable again with your previous settings.
