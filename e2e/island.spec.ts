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
 * L'île : une action enregistrée donne une graine ; on la plante, elle reste après un rechargement ;
 * on peut la déplacer puis l'arracher (sa graine revient dans le bac).
 */
test("une action donne une graine, qu'on plante, déplace et arrache sur l'île", async ({ page }) => {
  // 1. Une action de la famille « repas » : une graine de potager.
  await page.goto("/agir");
  await page.getByRole("button", { name: "Repas", exact: true }).click();
  await page.getByRole("button", { name: /Repas végé/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("pousses", { exact: true })).toBeVisible();

  // 2. « Super ! » mène sur l'île.
  await dialog.getByRole("button", { name: /Super !|Je continue !/ }).click();
  await page.waitForURL(/\/ile$/);
  await expect(page.locator("svg.pi")).toBeVisible();

  // 3. Choisir la graine, laisser l'appli choisir la case.
  const before = await occupied(page);
  const graines = page.getByRole("region", { name: /Tes graines/ });
  await graines.getByRole("button", { name: /Potager/ }).click();
  await graines.getByRole("button", { name: "Planter pour moi" }).click();
  await expect(page.getByText(/Nouvelle plante : Potager|Potager : \d+ graines/)).toBeVisible();

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
  await expect(page.getByText(/Plante arrachée : \d+ graines? de retour/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: /Tes graines/ }).getByRole("button", { name: /Potager/ })).toBeVisible();
});
