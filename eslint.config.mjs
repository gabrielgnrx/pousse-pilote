import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Les composants client ne peuvent pas importer le module IA (qui lit ANTHROPIC_API_KEY).
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["@/lib/ai/client", "**/lib/ai/client"], message: "lib/ai/client est réservé au serveur." }] },
      ],
    },
  },
];

export default config;
