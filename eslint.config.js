import { fileURLToPath } from "node:url";
import path from "node:path";
import { FlatCompat } from "@eslint/eslintrc";
import designTokensPlugin from "./eslint/plugins/design-tokens.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname
});

const tokenRuleConfig = {
  plugins: {
    "design-tokens": designTokensPlugin
  },
  rules: {
    "design-tokens/no-raw-design-values": [
      "error",
      {
        allow: [
          "design-tokens\\.json$",
          "design-tokens\\.css$",
          "tokens\\.generated"
        ],
        messageSuffix:
          "Use luminous reading lab tokens (design-tokens.json) so surfaces stay consistent."
      }
    ]
  }
};

export default [
  {
    name: "global-ignores",
    ignores: ["node_modules/**", ".next/**", "dist/**"]
  },
  ...compat.extends("next/core-web-vitals"),
  {
    name: "design-system-enforcement",
    ...tokenRuleConfig,
    files: ["**/*.{js,jsx,ts,tsx}"]
  }
];
