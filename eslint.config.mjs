// ESLint v9 flat config. M-012.
// Intentionally permissive: catches obvious errors without dictating style.
// M-140 (security review pass) may tighten rules.
// M-141: jsx-a11y plugin layered on for frontend/**/*.tsx to flag obvious
// WCAG violations during lint.
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "src/generated/",
      "extensions/",
      "prisma/migrations/",
      "coverage/",
      "**/*.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  {
    files: ["**/*.test.ts", "tests/**/*.ts", "vitest.config.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["frontend/**/*.{tsx,jsx}"],
    plugins: { "jsx-a11y": jsxA11y },
    rules: {
      ...jsxA11y.configs.recommended.rules,
      // Polaris owns most interactive widgets; we only need to catch the
      // obvious own-code violations (alt text, label associations, etc.).
      "jsx-a11y/no-autofocus": "off",
    },
  },
);
