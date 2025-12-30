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
    if [ -f ".workflow/state/hybrid-session.json" ]; then
        jq '.' .workflow/state/hybrid-session.json
    else
        echo "No active session"
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
```
