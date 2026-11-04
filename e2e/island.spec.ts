import { expect, test, type Page } from "@playwright/test";

/** Touche la case (x, z) de l'île : un clic au centre de son losange (sx = (x − z) × 34, sy = (x + z) × 19). */
async function tapTile(page: Page, x: number, z: number) {
  await page.evaluate(
    ([tx, tz]) => {
      const svg = document.querySelector("svg.pi") as SVGSVGElement;
      const p = new DOMPoint((tx - tz) * 34, (tx + tz) * 19).matrixTransform(svg.getScreenCTM()!);
      svg.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: p.x, clientY: p.y }));
    },
    [x, z] as const,
  );
}

/** Les cases occupées, lues sur les plantes dessinées. */
async function occupied(page: Page): Promise<string[]> {
  return page.locator("svg.pi [data-tile]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-tile") ?? ""));
}

/**
 * L'île : quatre plantes de départ ; une action rapporte des pousses ; on plante un potager avec, il
 * reste après un rechargement ; on peut le déplacer puis l'arracher (ses pousses reviennent).
 */
test("une action rapporte des pousses, qu'on dépense pour planter, puis on déplace et arrache", async ({ page }) => {
  // 1. Une action de la famille « repas » : des pousses.
  await page.goto("/agir");
  await page.getByRole("button", { name: "Repas", exact: true }).click();
  await page.getByRole("button", { name: /Repas végé/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("pousses", { exact: true })).toBeVisible();

  // 2. « Voir mon île » mène sur l'île.
  await dialog.getByRole("button", { name: /Voir mon île|Super !|Je continue !/ }).click();
  await page.waitForURL(/\/ile$/);
  await expect(page.locator("svg.pi")).toBeVisible();

  // 3. Les quatre plantes de départ sont là. Choisir le potager, laisser l'appli choisir la case.
  await expect.poll(() => occupied(page)).toHaveLength(4);
  // Une carte de récompense (migrateur de l'équipe, défi réussi…) peut s'ouvrir sur l'île : on la ferme.
  // La règle du jeu s'ouvre à la première visite, comme les cartes de récompense : on la ferme aussi.
  const card = page.getByRole("button", { name: /^(Super !|Plus tard|C'est parti)$/ });
  for (let i = 0; i < 4; i++) {
    const shown = await card.first().waitFor({ state: "visible", timeout: 2000 }).then(() => true, () => false);
    if (!shown) break;
    await card.first().click();
  }
  const before = await occupied(page);
  const graines = page.getByRole("region", { name: /Tes graines/ });
  await graines.getByRole("button", { name: /Potager/ }).click();
  await graines.getByRole("button", { name: "Planter pour moi" }).click();
  await expect(page.getByText(/Nouvelle plante : Potager · −10 pousses/)).toBeVisible();

  // 4. La plante est enregistrée : elle est encore là après un rechargement.
  await page.reload();
  await expect(page.getByRole("img", { name: /Ton île/ })).toHaveAttribute("aria-label", /Potager/);

  // 5. Retrouver sa case, la déplacer vers une case libre, puis l'arracher.
  const after = await occupied(page);
  const planted = after.find((t) => !before.includes(t)) ?? after[0]!;
  const [px, pz] = planted.split(",").map(Number) as [number, number];
  // Les cases de la zone du potager (le potager ne pousse que là, ou au centre).
  const free = [
    [-1, 1],
    [0, 1],
    [-2, 1],
    [-1, 2],
    [0, 2],
    [-2, 2],
    [-3, 1],
    [-1, 3],
    [0, 3],
  ].find(([x, z]) => !after.includes(`${x},${z}`))!;

  await tapTile(page, px, pz);
  await page.getByRole("button", { name: "Déplacer" }).click();
  await expect(page.getByText(/Touche une case libre pour déplacer/)).toBeVisible();
  await tapTile(page, free[0]!, free[1]!);
  await expect(page.getByText("Plante déplacée")).toBeVisible();

  await tapTile(page, free[0]!, free[1]!);
  await page.getByRole("button", { name: "Arracher" }).click();
  await page.getByRole("button", { name: "Arracher" }).last().click();
  await expect(page.getByText("Plante arrachée : 10 pousses rendues")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: /Tes graines/ }).getByRole("button", { name: /Potager/ })).toBeVisible();
});
