# Figma Analyzer Anti-Patterns

Patterns to avoid when analyzing Figma designs and generating code.

---

## Analysis Anti-Patterns

### Anti-Pattern: Regenerating Existing Components

**Bad**:
```
Figma shows a "Button" → Generate new Button.tsx
```

**Good**:
```
Figma shows a "Button" → Check registry → Match to existing Button.tsx → Reuse or add variant
```

**Why it's bad**: Creates duplicate components, fragments design system, increases maintenance burden

---

### Anti-Pattern: Top-Down Monolithic Analysis

**Bad**:
```
Analyze entire screen as one component → Generate single ScreenComponent.tsx
```

**Good**:
```
Break down: Screen → Organisms → Molecules → Atoms
Match each level independently
```

**Why it's bad**: Misses reuse opportunities, creates unmaintainable code, violates atomic design principles

---

### Anti-Pattern: Ignoring Match Scores

**Bad**:
```
Component has 85% match score → Create new component anyway
```

**Good**:
```
85% match → Use existing with minor adjustments
68% match → Consider as variant
45% match → Create new component
```

**Why it's bad**: Wastes development effort, creates unnecessary component proliferation

---

## Code Generation Anti-Patterns

### Anti-Pattern: Hardcoding Figma Values

**Bad**:
```tsx
const Button = styled.button`
  background: #3B82F6;  /* Hardcoded Figma hex */
  padding: 12px 24px;   /* Hardcoded Figma values */
`;
```

**Good**:
```tsx
const Button = styled.button`
  background: ${theme.colors.primary};
  padding: ${theme.space[3]} ${theme.space[6]};
`;
```

**Why it's bad**: Breaks design system consistency, makes theme changes impossible

---

### Anti-Pattern: Skipping Confirmation Step

**Bad**:
```
Analyze → Generate code immediately
```

**Good**:
```
Analyze → Show matches → Get developer confirmation → Generate code
```

**Why it's bad**: Developers lose control, wrong decisions get implemented, requires rework

---

### Anti-Pattern: Flat Component Output

**Bad**:
```tsx
// All components in one file
export const Button = () => ...
export const Card = () => ...
export const Header = () => ...
```

**Good**:
```
// Structured output
atoms/Button.tsx (import existing)
molecules/Card.tsx (new variant)
organisms/Header.tsx (adjustment)
```

**Why it's bad**: Doesn't integrate with existing codebase structure

---

## Matching Anti-Patterns

### Anti-Pattern: Name-Only Matching

**Bad**:
```
Figma "PrimaryButton" → Search for "PrimaryButton" → No match → Create new
```

**Good**:
```
Figma "PrimaryButton" → Search semantically:
  - "Button" with variant "primary"
  - "PrimaryButton"
  - Components with similar props
→ Found Button.tsx with primary variant
```

**Why it's bad**: Misses existing components due to naming differences

---

### Anti-Pattern: Ignoring Component Hierarchy

**Bad**:
```
Match: Card component
Skip: What's inside the Card (icons, text, buttons)
```

**Good**:
```
Match: Card component
Also match: All nested components (Icon, Typography, Button)
```

**Why it's bad**: Nested components get regenerated, losing reuse opportunities

---

### Anti-Pattern: Binary Match Decisions

**Bad**:
```
Match score < 100% → Create new component
```

**Good**:
```
95%+ → Use directly
80-95% → Minor adjustments
60-80% → Add as variant
<60% → Create new
```

**Why it's bad**: Creates unnecessary components for minor differences

---

## Workflow Anti-Patterns

### Anti-Pattern: Skipping Registry Scan

**Bad**:
```
Receive Figma data → Start matching immediately
```

**Good**:
```
Receive Figma data → Ensure registry is current → Then match
```

**Why it's bad**: Matches against stale component data, misses recent additions

---

### Anti-Pattern: No Decision Persistence

**Bad**:
```
Developer makes decisions → Generate code → Decisions lost
```

**Good**:
```
Developer makes decisions → Save to figma-decisions.json → Generate code
Decisions available for future reference and audit
```

**Why it's bad**: No audit trail, can't review or adjust decisions later

---

_More anti-patterns will be added as they are discovered._
