import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.ts";

test("CSV : BOM, point-virgule, virgule décimale, cellule vide pour une valeur masquée", () => {
  const csv = toCsv(["mois", "km"], [["2026-09", 12.5], ["2026-10", null]]);
  assert.equal(csv, "﻿mois;km\r\n2026-09;12,5\r\n2026-10;\r\n");
});

test("CSV : guillemets échappés et formules neutralisées", () => {
  assert.equal(toCsv(["a"], [['dit "oui"; ok']]), '﻿a\r\n"dit ""oui""; ok"\r\n');
  assert.equal(toCsv(["a"], [["=SOMME(A1)"]]), "﻿a\r\n'=SOMME(A1)\r\n");
});
