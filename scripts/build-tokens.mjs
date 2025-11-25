#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, "..");
const SOURCE_PATH = path.join(ROOT_DIR, "design-tokens.json");
const CSS_OUTPUT = path.join(ROOT_DIR, "app", "design-tokens.css");
const TS_OUTPUT = path.join(ROOT_DIR, "lib", "design", "tokens.generated.ts");

const CATEGORY_PREFIX = {
  colors: "color",
  gradients: "gradient",
  typography: "font",
  spacing: "space",
  radii: "radius",
  elevation: "elevation",
  glass: "glass",
  motion: "motion",
  textures: "texture",
};

const raw = JSON.parse(readFileSync(SOURCE_PATH, "utf8"));

const toKebab = (value) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

const sortedKeys = (obj) => Object.keys(obj).sort((a, b) => a.localeCompare(b));

const flattenEntries = (obj, prefixSegments = []) => {
  const lines = [];
  for (const key of sortedKeys(obj)) {
    const value = obj[key];
    const nextSegments = [...prefixSegments, toKebab(key)];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      lines.push(...flattenEntries(value, nextSegments));
    } else {
      lines.push([nextSegments.join("-"), value]);
    }
  }
  return lines;
};

const buildVarObject = (obj, prefixSegments = []) => {
  const result = {};
  for (const key of sortedKeys(obj)) {
    const value = obj[key];
    const nextSegments = [...prefixSegments, toKebab(key)];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = buildVarObject(value, nextSegments);
    } else {
      result[key] = `var(--${nextSegments.join("-")})`;
    }
  }
  return result;
};

const cssEntries = [];
const varRefs = {};
for (const [category, values] of Object.entries(raw)) {
  const prefix = CATEGORY_PREFIX[category] ?? toKebab(category);
  cssEntries.push(...flattenEntries(values, [prefix]));
  varRefs[category] = buildVarObject(values, [prefix]);
}

cssEntries.sort(([a], [b]) => a.localeCompare(b));

const cssLines = ["/* Auto-generated from design-tokens.json. Do not edit manually. */", ":root {"];
for (const [name, value] of cssEntries) {
  cssLines.push(`  --${name}: ${value};`);
}
cssLines.push("}", "");

mkdirSync(path.dirname(CSS_OUTPUT), { recursive: true });
mkdirSync(path.dirname(TS_OUTPUT), { recursive: true });
writeFileSync(CSS_OUTPUT, cssLines.join("\n"), "utf8");

const banner = `/**\n * Auto-generated from design-tokens.json. Do not edit manually.\n */`;
const jsonTokens = JSON.stringify(raw, null, 2);
const jsonVarRefs = JSON.stringify(varRefs, null, 2);
const tsFile = `${banner}\n\nexport const designTokens = ${jsonTokens} as const;\n\nexport type DesignTokens = typeof designTokens;\n\ntype TokenVars<T> = {\n  [K in keyof T]: T[K] extends string ? string : TokenVars<T[K]>;\n};\n\nexport const tokenVars = ${jsonVarRefs} as TokenVars<DesignTokens>;\n\nexport type TokenVarsMap = typeof tokenVars;\n`;

writeFileSync(TS_OUTPUT, tsFile, "utf8");
console.log(`✨ Generated ${cssEntries.length} CSS variables and TypeScript token maps.`);
