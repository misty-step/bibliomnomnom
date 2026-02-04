# Bibliomnomnom Color Palette

Our color system creates a warm, bookish atmosphere that feels like a well-loved library.

## Core Palette

### Canvas (Backgrounds)
| Name | Hex | Usage |
|------|-----|-------|
| **Bone** | `#FAF8F5` | Primary background, page canvas |
| **Bone Muted** | `#F2EDE5` | Secondary background, subtle sections |

### Text
| Name | Hex | Usage |
|------|-----|-------|
| **Ink** | `#1C1917` | Primary text, headings |
| **Ink Muted** | `#78716C` | Secondary text, captions |
| **Ink Subtle** | `#A8A29E` | Placeholder text, disabled states |

### Surface
| Name | Hex | Usage |
|------|-----|-------|
| **Dawn** | `#FEFDFB` | Cards, elevated surfaces, modals |

### Line
| Name | Value | Usage |
|------|-------|-------|
| **Ghost** | `rgba(28,25,23,0.08)` | Subtle borders, dividers |
| **Ember** | `rgba(28,25,23,0.15)` | Input borders, stronger dividers |

## Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Ember** | `#DC2626` | Destructive actions, alerts |
| **Favorite** | `#F59E0B` | Stars, favorites, highlights |
| **Rose** | `#E11D48` | Love, premium features |
| **Teal** | `#0D9488` | Success, positive actions |

## Decorative (Gold System)

Our gold palette adds a touch of literary elegance.

| Name | Hex | Usage |
|------|-----|-------|
| **Gold** | `#C5A059` | Primary gold, badges |
| **Gold Light** | `#E6C786` | Highlights, hover states |
| **Gold Dark** | `#AA771C` | Shadows, depth |
| **Gold Shine** | `#D4AF37` | Premium indicators |
| **Plum** | `#9333EA` | Special collections, rare finds |

## Status Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Positive** | `#46D549` | Success messages |
| **Warning** | `#FFB347` | Caution states |
| **Danger** | `#FF4D4F` | Errors, destructive |

## Usage Guidelines

### Do
- Use Bone (`#FAF8F5`) as the primary background
- Use Ink (`#1C1917`) for all primary text
- Apply Gold accents sparingly for premium feel
- Maintain high contrast for accessibility

### Don't
- Use pure white (`#FFFFFF`) as background
- Use pure black (`#000000`) for text
- Overuse accent colors
- Mix warm and cool tones inappropriately

## CSS Variables

All colors are available as CSS custom properties:

```css
var(--color-canvas-bone)
var(--color-text-ink)
var(--color-accent-ember)
var(--color-deco-gold)
```

## Tailwind Classes

```jsx
// Background
className="bg-canvas-bone"

// Text
className="text-text-ink"

// Accent
className="text-accent-ember"
```
