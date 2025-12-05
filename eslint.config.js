import nextConfig from "eslint-config-next/core-web-vitals";
import designTokensPlugin from "./eslint/plugins/design-tokens.js";

const tokenRuleConfig = {
  plugins: {
    "design-tokens": designTokensPlugin,
  },
  rules: {
    "design-tokens/no-raw-design-values": [
      "error",
      {
        allow: ["design-tokens\\.json$", "design-tokens\\.css$", "tokens\\.generated"],
        messageSuffix:
          "Use luminous reading lab tokens (design-tokens.json) so surfaces stay consistent.",
      },
    ],
  },
};

const eslintConfig = [
  {
    name: "global-ignores",
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "coverage/**",
      "convex/_generated/**",
    ],
  },
  ...nextConfig,
  {
    name: "design-system-enforcement",
    ...tokenRuleConfig,
    files: ["**/*.{js,jsx,ts,tsx}"],
  },
  {
    name: "react-hooks-relaxed",
    files: ["**/*.{jsx,tsx}"],
    rules: {
      // These patterns are valid for hydration, localStorage sync, and auth state
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
];

export default eslintConfig;
