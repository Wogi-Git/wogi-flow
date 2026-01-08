# Figma Analyzer Patterns

Patterns for analyzing Figma designs and matching against existing codebases.

---

## Matching Patterns

### Pattern: Atomic Component Priority

**Context**: When analyzing a Figma screen
**Approach**:
1. First identify atoms (buttons, inputs, icons, text)
2. Then molecules (search bars, cards, nav items)
3. Then organisms (headers, sidebars, forms)
4. Finally templates/pages

**Why it works**: Bottom-up analysis ensures foundational components are matched first

---

### Pattern: Match Score Thresholds

| Score | Action | Example |
|-------|--------|---------|
| 95%+ | Use directly | Icon with same name and size |
| 80-95% | Use with minor adjustments | Button with different padding |
| 60-80% | Consider as variant | Card with new layout option |
| <60% | Create new component | Novel component design |

**Why it works**: Clear decision boundaries reduce developer cognitive load

---

### Pattern: Property-Based Matching

**Context**: Calculating match scores
**Approach**:
```
Score = (
  nameMatch * 0.3 +
  typeMatch * 0.2 +
  propsMatch * 0.3 +
  visualMatch * 0.2
)
```

Components to compare:
- Name similarity (case-insensitive, handle synonyms)
- Component type (button, input, card)
- Props overlap (size, variant, color)
- Visual characteristics (dimensions, colors)

---

## Decision Patterns

### Pattern: Variant vs New Component

**When to add variant**:
- Same base functionality
- Similar props/API
- Fits existing component architecture
- Score 60-80%

**When to create new**:
- Different behavior/purpose
- Would require breaking changes
- Doesn't fit existing component patterns
- Score <60%

---

### Pattern: Design Token Preservation

**Context**: Maintaining design system consistency
**Approach**:
1. Map Figma colors to existing tokens first
2. Only create new tokens if truly novel
3. Prefer closest existing size/spacing tokens
4. Document any new tokens needed

Example mapping:
```
Figma #1F2937 → token: gray-800
Figma 16px → token: text-base
Figma 24px spacing → token: space-6
```

---

## Output Patterns

### Pattern: Structured Decision Format

**Context**: Storing developer decisions
**Format**:
```json
{
  "figmaComponent": "Button/Primary",
  "decision": "use" | "variant" | "new" | "skip",
  "matchedTo": "Button.tsx",
  "confidence": 0.92,
  "differences": ["color", "size"],
  "variantName": "large",
  "notes": "Developer chose to add as variant"
}
```

---

### Pattern: Generated Code Structure

**Context**: Code generation output
**Include**:
1. Import statements for existing components
2. Variant definitions (what to add)
3. New component skeletons
4. Composition code showing assembly

**Order**: Atoms → Molecules → Organisms → Page composition

---

## Anti-Patterns to Avoid

### Anti-Pattern: Regenerating Existing Components

**Bad**: Creating new Button.tsx when one exists
**Good**: Identify match, offer variant or adjustment

### Anti-Pattern: Missing Atomic Analysis

**Bad**: Creating monolithic screen component
**Good**: Break into reusable atoms/molecules first

### Anti-Pattern: Ignoring Design Tokens

**Bad**: Hardcoding Figma hex values
**Good**: Map to existing token system

---

_More patterns will be added as they are discovered._
