import { test } from "node:test";
import assert from "node:assert/strict";
import { nextBilanAllowed } from "./bilan-lock.ts";

test("bilan : une fois tous les 30 jours, 24 h de corrections après le premier", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  assert.equal(nextBilanAllowed(null, null, now), null, "premier bilan : libre");
  assert.equal(nextBilanAllowed("2026-10-22T08:00:00Z", "2026-10-22T09:00:00Z", now), null, "le premier jour : corrections libres");
  assert.equal(nextBilanAllowed("2026-10-01T08:00:00Z", "2026-10-10T08:00:00Z", now)?.toISOString(), "2026-11-09T08:00:00.000Z");
  assert.equal(nextBilanAllowed("2026-09-01T08:00:00Z", "2026-09-15T08:00:00Z", now), null, "plus de 30 jours : libre");
});
