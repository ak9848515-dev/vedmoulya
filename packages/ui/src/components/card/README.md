# Card Components

## Usage

```tsx
import { Card, AICard, KnowledgeCard, MemoryCard, CareerCard, BusinessCard, MarketplaceCard, LifeOSCard } from '@vedmoulya/ui';

// Standard card
<Card variant="standard" padding="md">
  <h3>Title</h3>
  <p>Content goes here.</p>
</Card>

// Interactive card (clickable with keyboard support)
<Card variant="interactive" onClick={handleClick}>
  Click me
</Card>

// AI card with confidence
<AICard confidence={85} source="User Profile" onTalk={handleTalk}>
  AI-generated insight here.
</AICard>

// Module-specific card
<KnowledgeCard
  title="Design Tokens"
  summary="Visual atoms of the design system"
  tags={['css', 'foundations']}
  connections={5}
  onExpand={handleExpand}
/>
```

## Card Props

| Prop    | Type                                                   | Default      | Description                        |
| ------- | ------------------------------------------------------ | ------------ | ---------------------------------- |
| variant | `'standard' \| 'elevated' \| 'ghost' \| 'interactive'` | `'standard'` | Card visual style                  |
| padding | `'none' \| 'sm' \| 'md' \| 'lg'`                       | `'md'`       | Inner padding                      |
| as      | `'div' \| 'article' \| 'section'`                      | `'div'`      | Semantic HTML element              |
| onClick | `() => void`                                           | —            | Click handler (sets role="button") |

## Card Variants

| Variant         | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| **standard**    | White background, #E8EDF5 border, subtle shadow                |
| **elevated**    | White background, no border, stronger shadow (floating effect) |
| **ghost**       | Transparent, dashed border (for empty/drop zones)              |
| **interactive** | Standard + hover lift + active press + keyboard support        |

## Best Practices

- Use **Card** as a generic container; prefer module-specific cards for domain content
- **Interactive** variant adds `role="button"`, `tabIndex={0}`, and keyboard handlers automatically
- Set `as="article"` for standalone content items (blog posts, news)
- Set `as="section"` for grouped content within a page

## Accessibility

- Interactive cards have `role="button"`, `tabIndex={0}`, and keyboard support (Enter, Space)
- Focus-visible ring is applied to interactive cards via `focusRing.base`
- AICard uses `aria-hidden="true"` on decorative elements (glow, icons)
- All module cards use semantic heading hierarchy (`h4` for titles)

## Performance Notes

- Module cards are pure components — no internal state
- AICard confidence dots are simple div elements
- Cards support `className` for custom styling extension

## Engineering Notes

- Standard variant uses 24px border-radius (DES-001 Constitution)
- Module cards share an internal `ActionButton` component
- Cards use Tailwind CSS v4 with inline shadow values
- AICard uses gradient background with purple accent border

## Design References

- DES-001 Constitution v1.0 — Card section (24px radius, #E8EDF5 border)
- DES-010A/D07 Component Behaviour — Card interaction specifications
- Shadow: 0 8px 30px rgba(15,23,42,0.06) for standard
