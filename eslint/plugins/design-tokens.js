const HEX_REGEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})(?![0-9a-fA-F])/;
const RGB_REGEX = /\brgba?\s*\(/i;
const PX_REGEX = /\b\d+(?:\.\d+)?px\b/i;

const DEFAULT_ALLOW = [/node_modules/, /\.next\//, /design-tokens/i, /tokens\.generated/i];

const toRegex = (pattern) => {
  if (pattern instanceof RegExp) {
    return pattern;
  }
  try {
    return new RegExp(pattern);
  } catch (error) {
    throw new Error(`Invalid design token allow pattern: ${pattern}`);
  }
};

const shouldSkipFile = (filename, extraPatterns = []) => {
  const matchers = [...DEFAULT_ALLOW, ...extraPatterns.map(toRegex)];
  return matchers.some((regex) => regex.test(filename));
};

const ALLOWED_JSX_ATTRIBUTES = new Set(["sizes", "media"]);

const isInAllowedJsxAttribute = (node) => {
  const parent = node?.parent;
  if (!parent) {
    return false;
  }
  if (parent.type === "JSXAttribute") {
    if (typeof parent.name?.name === "string") {
      return ALLOWED_JSX_ATTRIBUTES.has(parent.name.name);
    }
  }
  if (parent.type === "TemplateLiteral") {
    return isInAllowedJsxAttribute(parent);
  }
  return false;
};

const inspectValue = (value, context, node, messageSuffix) => {
  if (typeof value !== "string" || isInAllowedJsxAttribute(node)) {
    return;
  }
  if (HEX_REGEX.test(value)) {
    context.report({
      node,
      messageId: "hex",
      data: { suffix: messageSuffix },
    });
    return;
  }
  if (RGB_REGEX.test(value)) {
    context.report({
      node,
      messageId: "rgb",
      data: { suffix: messageSuffix },
    });
    return;
  }
  if (PX_REGEX.test(value)) {
    context.report({
      node,
      messageId: "px",
      data: { suffix: messageSuffix },
    });
  }
};

const designTokensPlugin = {
  rules: {
    "no-raw-design-values": {
      meta: {
        type: "problem",
        docs: {
          description: "Disallow raw color/spacing declarations outside of the design token system",
          recommended: true,
        },
        schema: [
          {
            type: "object",
            properties: {
              allow: {
                type: "array",
                items: { type: "string" },
              },
              messageSuffix: {
                type: "string",
              },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          hex: "Avoid raw hex colors. {{suffix}}",
          rgb: "Avoid raw rgb/rgba colors. {{suffix}}",
          px: "Avoid hard-coded pixel values. {{suffix}}",
        },
      },
      create(context) {
        const filename = context.getFilename();
        const options = context.options[0] ?? {};
        const allowPatterns = options.allow ?? [];
        const messageSuffix =
          options.messageSuffix ??
          "Use the luminous reading lab design tokens (design-tokens.json).";

        if (shouldSkipFile(filename, allowPatterns)) {
          return {};
        }

        return {
          Literal(node) {
            inspectValue(node.value, context, node, messageSuffix);
          },
          TemplateElement(node) {
            inspectValue(node.value.raw, context, node, messageSuffix);
          },
        };
      },
    },
  },
};

export default designTokensPlugin;
