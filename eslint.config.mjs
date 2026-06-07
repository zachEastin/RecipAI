import nextPlugin from "@next/eslint-plugin-next";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      ".next/**",
      "**/.next/**",
      "node_modules/**",
      "**/next-env.d.ts",
      "**/dist/**",
      "coverage/**",
      "data/**",
      "playwright-report/**"
    ]
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {}
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ]
    }
  }
];
