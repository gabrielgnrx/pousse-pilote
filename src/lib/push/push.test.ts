import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { newVapidKeys, vapidAuthorization, vapidKey } from "./vapid.ts";

test("en-tête VAPID : JWT ES256 signé, vérifiable avec la clé publique", () => {
  const k = newVapidKeys();
  assert.equal(Buffer.from(k.publicKey, "base64url").length, 65);
  assert.equal(Buffer.from(k.privateKey, "base64url").length, 32);
  const key = vapidKey(k.publicKey, k.privateKey);
  const h = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", k.publicKey, key, "https://pousse.test", 1_700_000_000_000);
  const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
  assert.ok(m);
  const claims = JSON.parse(Buffer.from(m[2], "base64url").toString());
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  assert.equal(claims.exp, 1_700_000_000 + 12 * 3600);
  assert.equal(m[4], k.publicKey);
  const raw = Buffer.from(k.publicKey, "base64url");
  const pub = createPublicKey({
    key: { kty: "EC", crv: "P-256", x: raw.subarray(1, 33).toString("base64url"), y: raw.subarray(33).toString("base64url") },
    format: "jwk",
  });
  const sig = Buffer.from(m[3], "base64url");
  assert.equal(sig.length, 64);
  assert.ok(verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: "ieee-p1363" }, sig));
});

test("clés invalides refusées", () => {
  assert.throws(() => vapidKey("abc", "def"));
});
