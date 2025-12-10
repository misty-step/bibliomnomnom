import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import { tokenVars } from "./lib/design/tokens.generated";

const colorVars = tokenVars.colors;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: colorVars.canvas,
        surface: colorVars.surface,
        text: colorVars.text,
        line: colorVars.line,
        status: colorVars.status,
        deco: colorVars.deco,
        // Shadcn-compatible aliases using our monochrome palette
        background: colorVars.canvas.bone,
        foreground: colorVars.text.ink,
        card: {
          DEFAULT: colorVars.surface.dawn,
          foreground: colorVars.text.ink,
        },
        popover: {
          DEFAULT: colorVars.surface.dawn,
          foreground: colorVars.text.ink,
        },
        primary: {
          DEFAULT: colorVars.text.ink,
          foreground: colorVars.surface.dawn,
        },
        secondary: {
          DEFAULT: colorVars.canvas.boneMuted,
          foreground: colorVars.text.ink,
        },
        muted: {
          DEFAULT: colorVars.canvas.boneMuted,
          foreground: colorVars.text.inkMuted,
        },
        accent: {
          ...colorVars.accent,
          DEFAULT: colorVars.text.ink,
          foreground: colorVars.surface.dawn,
        },
        destructive: {
          DEFAULT: colorVars.status.danger,
          foreground: colorVars.surface.dawn,
        },
        border: colorVars.line.ghost,
        input: colorVars.line.ember,
        ring: colorVars.text.ink,
      },
      fontFamily: {
        display: [tokenVars.typography.display],
        sans: [tokenVars.typography.sans],
        mono: [tokenVars.typography.mono],
      },
      spacing: tokenVars.spacing,
      borderRadius: {
        lg: tokenVars.radii.lg,
        md: tokenVars.radii.md,
        sm: tokenVars.radii.sm,
      },
      boxShadow: {
        surface: tokenVars.elevation.soft,
        raised: tokenVars.elevation.raised,
      },
      transitionTimingFunction: {
        fast: tokenVars.motion.fast.easing,
        base: tokenVars.motion.base.easing,
      },
      transitionDuration: {
        fast: tokenVars.motion.fast.duration,
        base: tokenVars.motion.base.duration,
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
