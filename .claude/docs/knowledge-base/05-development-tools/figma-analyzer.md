# Figma Analyzer

Match Figma designs to existing components for faster design-to-code.

---

## Purpose

When implementing designs:
1. **Find Existing Components**: Don't recreate what exists
2. **Identify Variants**: Suggest variants over new components
3. **Generate Prompts**: Create implementation prompts

---

## Configuration

```json
{
  "figmaAnalyzer": {
    "enabled": true,
    "thresholds": {
      "exactMatch": 95,          // Score for "use as-is"
      "strongMatch": 80,         // Score for "good match"
      "variantCandidate": 60     // Score for "add variant"
    },
    "componentDirs": [
      "src/components",
      "components",
      "src/ui",
      "ui"
    ],
    "mcpServer": {
      "port": 3847,
      "autoStart": false
    },
    "autoScanOnAnalyze": true,
    "generatePrompts": true
  }
}
```

---

## How It Works

```
Figma Design
      ↓
┌─────────────────────────────────────────┐
│ 1. Extract design metadata              │
│    - Component names                    │
│    - Props/variants                     │
│    - Styles                            │
├─────────────────────────────────────────┤
│ 2. Match against codebase              │
│    - Name similarity                   │
│    - Prop compatibility                │
│    - Style matching                    │
├─────────────────────────────────────────┤
│ 3. Score matches                       │
│    - Exact: 95+                        │
│    - Strong: 80-95                     │
│    - Variant: 60-80                    │
│    - New: <60                          │
├─────────────────────────────────────────┤
│ 4. Generate recommendations            │
│    - Use existing                      │
│    - Add variant                       │
│    - Create new                        │
└─────────────────────────────────────────┘
```

---

## Usage

### Analyze a Frame

```bash
/wogi-figma analyze "Login Screen"
```

### Output

```
📐 Figma Analysis: Login Screen

Found 8 components in design:

1. Button "Submit"
   ✅ EXACT MATCH (97%)
   → Use: src/components/Button.tsx
   → Props: variant="primary", size="lg"

2. Input "Email"
   🔶 STRONG MATCH (85%)
   → Use: src/components/Input.tsx
   → Note: Add "email" variant for icon

3. Card "Login Container"
   🔶 VARIANT CANDIDATE (72%)
   → Base: src/components/Card.tsx
   → Suggestion: Add "auth" variant

4. Logo "AppLogo"
   ❌ NO MATCH
   → Create: src/components/AppLogo.tsx

Implementation prompt generated.
```

---

## Match Scores

| Score | Classification | Action |
|-------|---------------|--------|
| 95+ | Exact Match | Use as-is |
| 80-95 | Strong Match | Minor tweaks needed |
| 60-80 | Variant Candidate | Add variant |
| <60 | No Match | Create new |

---

## Prompt Generation

When `generatePrompts` is enabled:

```markdown
# Implementation Prompt: Login Screen

## Components to Use

### Button
Path: src/components/Button.tsx
Props: variant="primary", size="lg", onClick={handleSubmit}

### Input
Path: src/components/Input.tsx
Props: type="email", placeholder="Email"
Note: Consider adding email icon variant

## Components to Create

### AppLogo
Create at: src/components/AppLogo.tsx
From Figma: AppLogo frame
Specs:
  - Width: 120px
  - Height: 40px
  - SVG export available

## Layout
- Use flex column with gap-4
- Card wrapper with padding-6
- Center aligned, max-width 400px
```

---

## MCP Server Mode

For real-time Figma integration:

```json
{
  "figmaAnalyzer": {
    "mcpServer": {
      "port": 3847,
      "autoStart": true
    }
  }
}
```

### Start Server

```bash
./scripts/flow figma-server start
```

### Connect from Figma

Use the Figma MCP plugin to connect to the running server.

---

## Component Indexing

Figma analyzer uses component index:

```bash
# Ensure index is current
/wogi-map-index scan
```

### What's Indexed

- Component names
- Exported props
- Variants available
- File locations

---

## Commands

| Command | Purpose |
|---------|---------|
| `/wogi-figma analyze <frame>` | Analyze Figma frame |
| `/wogi-figma compare` | Compare design to code |
| `/wogi-figma prompt <frame>` | Generate impl prompt |

---

## Best Practices

1. **Index First**: Run `/wogi-map-index scan` before analysis
2. **Name Consistency**: Use same names in Figma and code
3. **Use Variants**: Add variants instead of new components
4. **Review Matches**: Don't blindly trust scores
5. **Update App-Map**: Register new components

---

## Troubleshooting

### Low Match Scores

- Check naming consistency
- Verify component index is current
- Review threshold settings

### Components Not Found

- Verify `componentDirs` includes your paths
- Run component index scan
- Check file extensions match

### MCP Server Issues

- Check port availability
- Verify Figma plugin installed
- Check firewall settings

---

## Related

- [Component Indexing](../01-setup-onboarding/component-indexing.md)
- [Task Execution](../02-task-execution/) - Using prompts
- [Configuration](../configuration/all-options.md) - All settings
