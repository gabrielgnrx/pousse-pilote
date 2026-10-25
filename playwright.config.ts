import { defineConfig, devices } from "@playwright/test";

/**
 * Test de bout en bout du parcours principal, sur une pile Supabase locale (supabase start) et
 * l'application compilée, avec des réponses IA simulées (AI_MOCK=1) : aucun appel réseau à l'IA.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    storageState: "e2e/.auth/salarie.json",
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/connexion",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AI_MOCK: "1" },
  },
});
