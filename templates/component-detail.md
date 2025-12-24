# [Component Name]

**Path**: `src/components/[path]`
**Status**: complete | in-progress | planned

## Variants

| Variant | Description |
|---------|-------------|
| `primary` | Main action style |
| `secondary` | Secondary action style |

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `variant` | string | no | `primary` | Visual style |
| `size` | `sm` \| `md` \| `lg` | no | `md` | Component size |
| `disabled` | boolean | no | `false` | Disabled state |
| `onClick` | function | no | - | Click handler |

## Usage

```tsx
import { ComponentName } from '@/components/[path]'

<ComponentName variant="primary" size="lg">
  Label
</ComponentName>
```

## Used In

- ScreenName
- ModalName
- OtherComponent

## Notes

- Any special behaviors or gotchas
- Performance considerations
- Accessibility notes
