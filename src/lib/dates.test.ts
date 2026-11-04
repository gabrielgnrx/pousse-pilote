import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, dayLabel, parisDay, todayParis } from "./dates.ts";

test("parisDay range un horodatage dans le jour de Paris, pas celui d'UTC", () => {
  // 23 h 30 UTC le 27 octobre 2026 = 0 h 30 le 28 à Paris (heure d'hiver, UTC+1).
  assert.equal(parisDay("2026-10-27T23:30:00Z"), "2026-10-28");
  // 21 h 30 UTC le 15 juillet = 23 h 30 à Paris (heure d'été, UTC+2) : toujours le 15.
  assert.equal(parisDay("2026-07-15T21:30:00Z"), "2026-07-15");
});

test("dayLabel nomme aujourd'hui, hier, puis la date", () => {
  assert.equal(dayLabel(new Date()), "Aujourd'hui");
  assert.equal(dayLabel(`${addDays(todayParis(), -1)}T12:00:00+02:00`), "Hier");
  assert.equal(dayLabel("2026-03-17T10:00:00Z"), "17 mars");
});
