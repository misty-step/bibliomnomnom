/**
 * Auto-generated from design-tokens.json. Do not edit manually.
 */

export const designTokens = {
  "colors": {
    "canvas": {
      "bone": "#FAF8F5",
      "boneMuted": "#F2EDE5"
    },
    "text": {
      "ink": "#1C1917",
      "inkMuted": "#78716C",
      "inkSubtle": "#A8A29E"
    },
    "surface": {
      "dawn": "#FEFDFB"
    },
    "line": {
      "ghost": "rgba(28,25,23,0.08)",
      "ember": "rgba(28,25,23,0.15)"
    },
    "accent": {
      "ember": "#DC2626"
    },
    "status": {
      "positive": "#46D549",
      "warning": "#FFB347",
      "danger": "#FF4D4F"
    }
  },
  "typography": {
    "display": "\"Canela\", \"Times New Roman\", serif",
    "sans": "\"Söhne\", \"Neue Montreal\", system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    "mono": "\"JetBrains Mono\", \"IBM Plex Mono\", monospace"
  },
  "spacing": {
    "3xs": "0.25rem",
    "2xs": "0.375rem",
    "xs": "0.5rem",
    "sm": "0.75rem",
    "md": "1rem",
    "lg": "1.5rem",
    "xl": "2rem",
    "2xl": "3rem",
    "3xl": "4rem"
  },
  "layout": {
    "spine": "12.5rem"
  },
  "radii": {
    "sm": "0.5rem",
    "md": "0.75rem",
    "lg": "1rem"
  },
  "elevation": {
    "flat": "none",
    "soft": "0 4px 16px rgba(12,22,38,0.06)",
    "raised": "0 8px 24px rgba(5,8,16,0.12)"
  },
  "motion": {
    "fast": {
      "duration": "150ms",
      "easing": "cubic-bezier(0.4, 0, 0.2, 1)"
    },
    "base": {
      "duration": "300ms",
      "easing": "cubic-bezier(0.16, 0.84, 0.44, 1)"
    }
  }
} as const;

export type DesignTokens = typeof designTokens;

type TokenVars<T> = {
  [K in keyof T]: T[K] extends string ? string : TokenVars<T[K]>;
};

export const tokenVars = {
  "colors": {
    "accent": {
      "ember": "var(--color-accent-ember)"
    },
    "canvas": {
      "bone": "var(--color-canvas-bone)",
      "boneMuted": "var(--color-canvas-bone-muted)"
    },
    "line": {
      "ember": "var(--color-line-ember)",
      "ghost": "var(--color-line-ghost)"
    },
    "status": {
      "danger": "var(--color-status-danger)",
      "positive": "var(--color-status-positive)",
      "warning": "var(--color-status-warning)"
    },
    "surface": {
      "dawn": "var(--color-surface-dawn)"
    },
    "text": {
      "ink": "var(--color-text-ink)",
      "inkMuted": "var(--color-text-ink-muted)",
      "inkSubtle": "var(--color-text-ink-subtle)"
    }
  },
  "typography": {
    "display": "var(--font-display)",
    "mono": "var(--font-mono)",
    "sans": "var(--font-sans)"
  },
  "spacing": {
    "2xl": "var(--space-2xl)",
    "2xs": "var(--space-2xs)",
    "3xl": "var(--space-3xl)",
    "3xs": "var(--space-3xs)",
    "lg": "var(--space-lg)",
    "md": "var(--space-md)",
    "sm": "var(--space-sm)",
    "xl": "var(--space-xl)",
    "xs": "var(--space-xs)"
  },
  "layout": {
    "spine": "var(--layout-spine)"
  },
  "radii": {
    "lg": "var(--radius-lg)",
    "md": "var(--radius-md)",
    "sm": "var(--radius-sm)"
  },
  "elevation": {
    "flat": "var(--elevation-flat)",
    "raised": "var(--elevation-raised)",
    "soft": "var(--elevation-soft)"
  },
  "motion": {
    "base": {
      "duration": "var(--motion-base-duration)",
      "easing": "var(--motion-base-easing)"
    },
    "fast": {
      "duration": "var(--motion-fast-duration)",
      "easing": "var(--motion-fast-easing)"
    }
  }
} as TokenVars<DesignTokens>;

export type TokenVarsMap = typeof tokenVars;
