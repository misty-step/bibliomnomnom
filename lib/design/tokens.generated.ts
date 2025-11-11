/**
 * Auto-generated from design-tokens.json. Do not edit manually.
 */

export const designTokens = {
  "colors": {
    "canvas": {
      "bone": "#F6F1E5",
      "boneMuted": "#ECE2D1",
      "night": "#0B1E3C"
    },
    "text": {
      "ink": "#0F1115",
      "inkMuted": "#4B5563",
      "inkSubtle": "#7F8897"
    },
    "surface": {
      "dawn": "#FDF8EF",
      "twilight": "#111827",
      "glass": "rgba(255,255,255,0.68)"
    },
    "action": {
      "electric": "#2F6BFF",
      "electricMuted": "#5C8BFF"
    },
    "accent": {
      "orchid": "#A86BFF",
      "nectar": "#FFB36B",
      "sunset": "#FF8A5C"
    },
    "line": {
      "ghost": "rgba(15,17,21,0.08)",
      "ember": "rgba(15,17,21,0.15)"
    },
    "status": {
      "positive": "#46D549",
      "warning": "#FFB347",
      "danger": "#FF4D4F"
    }
  },
  "gradients": {
    "sky-dawn": "linear-gradient(120deg, var(--color-action-electric) 0%, var(--color-accent-orchid) 60%, var(--color-accent-nectar) 100%)",
    "azure-orchid": "linear-gradient(135deg, var(--color-action-electric) 0%, var(--color-accent-orchid) 100%)",
    "twilight": "linear-gradient(160deg, rgba(5,8,16,0.9) 0%, rgba(11,30,60,0.4) 70%, transparent 100%)"
  },
  "typography": {
    "display": "\"Canela\", \"Times New Roman\", serif",
    "sans": "\"Söhne\", \"Neue Montreal\", \"Inter\", system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
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
    "3xl": "4rem",
    "heroInset": "1.25rem",
    "coverColumn": "12.5rem",
    "notePanel": "15.625rem",
    "formFieldMin": "6rem",
    "toastMax": "26.25rem"
  },
  "radii": {
    "xs": "0.35rem",
    "sm": "0.55rem",
    "md": "0.75rem",
    "lg": "1rem",
    "pill": "999px"
  },
  "elevation": {
    "flat": "none",
    "soft": "0 6px 24px rgba(12,22,38,0.08)",
    "raised": "0 16px 40px rgba(5,8,16,0.18)",
    "overlay": "0 24px 60px rgba(5,8,16,0.22)"
  },
  "glass": {
    "frosted": "blur(32px)",
    "panel": "blur(24px)"
  },
  "motion": {
    "snappy": {
      "duration": "180ms",
      "easing": "cubic-bezier(0.4, 0, 0.2, 1)"
    },
    "drift": {
      "duration": "420ms",
      "easing": "cubic-bezier(0.16, 0.84, 0.44, 1)"
    },
    "pulse": {
      "duration": "900ms",
      "easing": "cubic-bezier(0.37, 0, 0.63, 1)"
    }
  },
  "textures": {
    "cloud": "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.45), rgba(255,255,255,0))",
    "matrix": "repeating-linear-gradient(0deg, rgba(15,17,21,0.08) 0, rgba(15,17,21,0.08) 1px, transparent 1px, transparent 3px)",
    "grain": "linear-gradient(0deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05))"
  }
} as const;

export type DesignTokens = typeof designTokens;

type TokenVars<T> = {
  [K in keyof T]: T[K] extends string ? string : TokenVars<T[K]>;
};

export const tokenVars = {
  "colors": {
    "accent": {
      "nectar": "var(--color-accent-nectar)",
      "orchid": "var(--color-accent-orchid)",
      "sunset": "var(--color-accent-sunset)"
    },
    "action": {
      "electric": "var(--color-action-electric)",
      "electricMuted": "var(--color-action-electric-muted)"
    },
    "canvas": {
      "bone": "var(--color-canvas-bone)",
      "boneMuted": "var(--color-canvas-bone-muted)",
      "night": "var(--color-canvas-night)"
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
      "dawn": "var(--color-surface-dawn)",
      "glass": "var(--color-surface-glass)",
      "twilight": "var(--color-surface-twilight)"
    },
    "text": {
      "ink": "var(--color-text-ink)",
      "inkMuted": "var(--color-text-ink-muted)",
      "inkSubtle": "var(--color-text-ink-subtle)"
    }
  },
  "gradients": {
    "azure-orchid": "var(--gradient-azure-orchid)",
    "sky-dawn": "var(--gradient-sky-dawn)",
    "twilight": "var(--gradient-twilight)"
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
    "coverColumn": "var(--space-cover-column)",
    "formFieldMin": "var(--space-form-field-min)",
    "heroInset": "var(--space-hero-inset)",
    "lg": "var(--space-lg)",
    "md": "var(--space-md)",
    "notePanel": "var(--space-note-panel)",
    "sm": "var(--space-sm)",
    "toastMax": "var(--space-toast-max)",
    "xl": "var(--space-xl)",
    "xs": "var(--space-xs)"
  },
  "radii": {
    "lg": "var(--radius-lg)",
    "md": "var(--radius-md)",
    "pill": "var(--radius-pill)",
    "sm": "var(--radius-sm)",
    "xs": "var(--radius-xs)"
  },
  "elevation": {
    "flat": "var(--elevation-flat)",
    "overlay": "var(--elevation-overlay)",
    "raised": "var(--elevation-raised)",
    "soft": "var(--elevation-soft)"
  },
  "glass": {
    "frosted": "var(--glass-frosted)",
    "panel": "var(--glass-panel)"
  },
  "motion": {
    "drift": {
      "duration": "var(--motion-drift-duration)",
      "easing": "var(--motion-drift-easing)"
    },
    "pulse": {
      "duration": "var(--motion-pulse-duration)",
      "easing": "var(--motion-pulse-easing)"
    },
    "snappy": {
      "duration": "var(--motion-snappy-duration)",
      "easing": "var(--motion-snappy-easing)"
    }
  },
  "textures": {
    "cloud": "var(--texture-cloud)",
    "grain": "var(--texture-grain)",
    "matrix": "var(--texture-matrix)"
  }
} as TokenVars<DesignTokens>;

export type TokenVarsMap = typeof tokenVars;
