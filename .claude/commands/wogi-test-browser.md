Execute browser tests using Claude's browser extension.

Usage:
- `/wogi-test-browser [flow-name]` - Run specific flow
- `/wogi-test-browser all` - Run all flows

Load test flow from `.workflow/tests/flows/[name].json`

For each step in the flow:
1. **navigate** - Open the URL in browser
2. **wait** - Wait for selector to appear
3. **type** - Enter text in input field
4. **click** - Click element
5. **verify** - Check element exists or contains text
6. **screenshot** - Capture current state

Output:
```
🧪 Running: login-flow

1. ✓ Navigate to /login
2. ✓ Wait for .login-form
3. ✓ Type email: test@example.com
4. ✓ Type password: ********
5. ✓ Click submit button
6. ✓ Verify .dashboard exists
7. ✓ Screenshot: login-success

Result: PASS ✓

All 7 steps completed successfully.
```

If a step fails:
```
5. ✗ Verify .dashboard exists
   Expected: Element to exist
   Actual: Element not found after 5s timeout

Result: FAIL ✗

Screenshot saved: login-flow-failure.png
```
