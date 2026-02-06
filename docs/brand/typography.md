# Bibliomnomnom Typography

Our typography balances literary elegance with modern readability.

## Font Families

### Display (Headings)
```css
font-family: "Playfair Display", "Times New Roman", serif;
```
**Playfair Display** - A transitional serif with high contrast and elegant letterforms. Used for headings and hero text to evoke the feel of classic book typography.

### Sans (Body)
```css
font-family: "Geist", "Söhne", "Neue Montreal", system-ui, sans-serif;
```
**Geist** - A clean, modern sans-serif optimized for screen reading. Used for body text, UI elements, and anything that needs to be easily scannable.

### Mono (Code)
```css
font-family: "JetBrains Mono", "IBM Plex Mono", monospace;
```
**JetBrains Mono** - Used for ISBN numbers, technical data, and any monospaced content.

## Type Scale

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 | Display | 2.5rem | 700 | 1.2 |
| H2 | Display | 2rem | 600 | 1.25 |
| H3 | Display | 1.5rem | 600 | 1.3 |
| H4 | Sans | 1.25rem | 600 | 1.4 |
| Body | Sans | 1rem | 400 | 1.6 |
| Small | Sans | 0.875rem | 400 | 1.5 |
| Caption | Sans | 0.75rem | 400 | 1.4 |

## Usage Guidelines

### Headings
- Use Playfair Display for all major headings (H1-H3)
- Reserve Display font for content that benefits from elegance
- Headings should be concise and scannable

### Body Text
- Use Geist for all body copy
- Maintain generous line height (1.5-1.6) for readability
- Limit line length to 65-75 characters

### UI Elements
- Buttons, labels, and navigation use Sans
- Keep UI text short and action-oriented
- Use sentence case for most UI text

## Tailwind Classes

```jsx
// Display font (headings)
className="font-display"

// Sans font (body, UI)
className="font-sans"

// Mono font (ISBN, code)
className="font-mono"
```

## Examples

### Hero Headline
```jsx
<h1 className="font-display text-4xl font-bold text-text-ink">
  Your Digital Reading Garden
</h1>
```

### Body Paragraph
```jsx
<p className="font-sans text-base text-text-ink leading-relaxed">
  Track what you read, capture your thoughts, and never forget a book again.
</p>
```

### Book ISBN
```jsx
<span className="font-mono text-sm text-text-inkMuted">
  ISBN: 978-0-06-112008-4
</span>
```
