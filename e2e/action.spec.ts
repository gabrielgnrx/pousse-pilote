import { expect, test } from "@playwright/test";

/**
 * Parcours principal : enregistrer une action en saisie libre, la confirmer, voir la célébration,
 * la publier dans le fil.
 */
test("enregistrer une action, la confirmer, la célébrer et la publier", async ({ page }) => {
  await page.goto("/agir");
  await expect(page.getByRole("heading", { name: "Qu'as-tu fait de bien ?" })).toBeVisible();

  // 1. Une phrase libre.
  await page.getByLabel("Décris ton action").fill("Vélo jusqu'au bureau ce matin, 8 km");
  await page.getByRole("button", { name: "Comprendre ma phrase" }).click();

  // 2. La carte de confirmation, éditable : rien n'est enregistré avant « Valider ».
  const card = page.getByRole("list", { name: "Actions à confirmer" }).getByRole("listitem").first();
  await expect(card.getByText("Trajet domicile-travail à vélo ou à pied")).toBeVisible();
  await expect(card.getByRole("spinbutton")).toHaveValue("8");
  await expect(card.getByText(/de CO₂ évités/)).toBeVisible();
  await card.getByRole("button", { name: "Valider" }).click();

  // 3. La célébration, avec les chiffres calculés par la base.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("de CO₂ évités")).toBeVisible();
  await expect(dialog.getByText("0,9 kg")).toBeVisible();
  await expect(dialog.getByText("pousses", { exact: true })).toBeVisible();

  // 4. La publication est proposée, jamais automatique.
  await dialog.getByRole("button", { name: "Publier dans le fil" }).click();
  await dialog.getByLabel("Un mot pour tes collègues (facultatif)").fill("Premier vélotaf de la saison !");
  await dialog.getByRole("button", { name: "Publier dans le fil" }).click();

  // En cas d'échec, le texte de la pop-up (message d'erreur éventuel) aide à comprendre.
  await page.waitForURL(/\/fil\?publie=1/, { timeout: 15_000 }).catch(async (e: Error) => {
    throw new Error(`${e.message}\nPop-up : ${await dialog.innerText().catch(() => "(fermée)")}`);
  });
  await expect(page.getByText("Publié ! Tes collègues peuvent maintenant t'encourager.")).toBeVisible();
  await expect(page.getByText("Premier vélotaf de la saison !")).toBeVisible();
});

test("vêtements d'occasion : choisir quoi et combien, en une seule action", async ({ page }) => {
  await page.goto("/agir");
  await page.getByRole("button", { name: "Achats" }).click();
  await page.getByRole("button", { name: /Vêtement d'occasion/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Un jean de plus" }).click();
  await sheet.getByRole("button", { name: "Un t-shirt de plus" }).click();
  await sheet.getByRole("button", { name: "Un t-shirt de plus" }).click();
  await sheet.getByRole("button", { name: /Valider · \+30/ }).click();
  await expect(page.getByRole("dialog").getByText("Vêtements d'occasion · 1 jean, 2 t-shirt")).toBeVisible();
});
