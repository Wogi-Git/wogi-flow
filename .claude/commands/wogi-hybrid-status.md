---
description: Show current hybrid mode configuration
---

# Hybrid Mode Status

Let me check the current configuration:

```bash
echo "═══════════════════════════════════════════════════════════"
echo "              HYBRID MODE STATUS"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if enabled
ENABLED=$(jq -r '.hybrid.enabled // false' .workflow/config.json)
echo "Status: $ENABLED"

if [ "$ENABLED" = "true" ]; then
    echo ""
    echo "Configuration:"
    jq '.hybrid' .workflow/config.json

    echo ""
    echo "Testing connection..."
    node scripts/flow-hybrid-detect.js providers

    echo ""
    echo "Session state:"
    # Use durable session (v2.0) - check durable-history.json for active sessions
    if [ -f ".workflow/state/durable-history.json" ]; then
        ACTIVE=$(jq -r '.activeSession // empty' .workflow/state/durable-history.json)
        if [ -n "$ACTIVE" ] && [ "$ACTIVE" != "null" ]; then
            jq '.activeSession' .workflow/state/durable-history.json
        else
            echo "No active session"
        fi
    else
        echo "No durable session history"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
```
