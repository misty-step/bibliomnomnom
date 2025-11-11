import type { Config } from "tailwindcss";
import { tokenVars } from "./lib/design/tokens.generated";

const colorVars = tokenVars.colors;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        canvas: colorVars.canvas,
        surface: colorVars.surface,
        text: colorVars.text,
        action: colorVars.action,
        accentPalette: colorVars.accent,
        line: colorVars.line,
        status: colorVars.status,
        paper: {
          DEFAULT: colorVars.canvas.bone,
          secondary: colorVars.canvas.boneMuted
        },
        ink: {
          DEFAULT: colorVars.text.ink,
          faded: colorVars.text.inkMuted
        },
        leather: {
          DEFAULT: colorVars.accent.sunset,
          light: colorVars.accent.nectar
        },
        background: colorVars.canvas.bone,
        foreground: colorVars.text.ink,
        card: {
          DEFAULT: colorVars.surface.dawn,
          foreground: colorVars.text.ink
        },
        popover: {
          DEFAULT: colorVars.surface.dawn,
          foreground: colorVars.text.ink
        },
        primary: {
          DEFAULT: colorVars.action.electric,
          foreground: colorVars.surface.dawn
        },
        secondary: {
          DEFAULT: colorVars.canvas.boneMuted,
          foreground: colorVars.text.ink
        },
        muted: {
          DEFAULT: colorVars.canvas.boneMuted,
          foreground: colorVars.text.inkMuted
        },
        accent: {
          DEFAULT: colorVars.accent.orchid,
          foreground: colorVars.surface.dawn
        },
        destructive: {
          DEFAULT: colorVars.status.danger,
          foreground: colorVars.surface.dawn
        },
        input: colorVars.line.ember,
        border: colorVars.line.ghost,
        ring: colorVars.action.electric
      },
      fontFamily: {
        display: [tokenVars.typography.display],
        sans: [tokenVars.typography.sans],
        mono: [tokenVars.typography.mono]
      },
      spacing: tokenVars.spacing,
      borderRadius: {
        lg: tokenVars.radii.lg,
        md: tokenVars.radii.md,
        sm: tokenVars.radii.sm,
        pill: tokenVars.radii.pill
      },
      boxShadow: {
        surface: tokenVars.elevation.soft,
        raised: tokenVars.elevation.raised,
        overlay: tokenVars.elevation.overlay
      },
      backgroundImage: {
        "gradient-sky": tokenVars.gradients["sky-dawn"],
        "gradient-azure": tokenVars.gradients["azure-orchid"],
        "gradient-twilight": tokenVars.gradients["twilight"],
        "texture-cloud": tokenVars.textures.cloud,
        "texture-matrix": tokenVars.textures.matrix,
        "texture-grain": tokenVars.textures.grain
      },
      blur: {
        frosted: tokenVars.glass.frosted,
        panel: tokenVars.glass.panel
      },
      transitionTimingFunction: {
        snappy: tokenVars.motion.snappy.easing,
        drift: tokenVars.motion.drift.easing,
        pulse: tokenVars.motion.pulse.easing
      },
      transitionDuration: {
        snappy: tokenVars.motion.snappy.duration,
        drift: tokenVars.motion.drift.duration,
        pulse: tokenVars.motion.pulse.duration
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
