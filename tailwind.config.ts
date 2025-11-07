import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Bibliophile color palette
        paper: {
          DEFAULT: "#FDFBF7", // Warm white (aged paper)
          secondary: "#F5F1E8", // Lighter sepia
        },
        ink: {
          DEFAULT: "#1A1A1A", // Near black (ink)
          faded: "#6B5D52", // Warm gray (faded ink)
        },
        leather: {
          DEFAULT: "#8B4513", // Saddle brown (leather)
          light: "#D4A574", // Tan (aged pages)
        },
        border: {
          DEFAULT: "#E8DED0", // Subtle border
        },
      },
      fontFamily: {
        serif: ["Crimson Text", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
