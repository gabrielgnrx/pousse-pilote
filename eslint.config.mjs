import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// La clé de l'API Claude ne peut pas atteindre le navigateur : lib/ai/client.ts importe « server-only »,
// ce qui fait échouer la compilation si un composant client l'importe.
const config = [
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "playwright-report/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
