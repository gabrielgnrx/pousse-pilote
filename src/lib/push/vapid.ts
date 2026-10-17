/**
 * Notifications Web Push sans dépendance : signature VAPID (RFC 8292) avec le module crypto de Node.
 * Les notifications partent vides (pas de chiffrement de contenu à faire) : à la réception, le téléphone
 * vient lire le texte du rappel sur /api/rappel avec sa propre session. Rien de personnel ne transite
 * par le service de push (Google, Apple, Mozilla).
 */
import { createPrivateKey, generateKeyPairSync, sign, type KeyObject } from "node:crypto";

const b64url = (buf: Buffer | Uint8Array | string) =>
  Buffer.from(typeof buf === "string" ? Buffer.from(buf) : buf).toString("base64url");

/** Clé publique VAPID (65 octets, point non compressé) → coordonnées x, y. */
function publicXY(publicKey: string) {
  const raw = Buffer.from(publicKey, "base64url");
  if (raw.length !== 65 || raw[0] !== 0x04) throw new Error("clé publique VAPID invalide");
  return { x: b64url(raw.subarray(1, 33)), y: b64url(raw.subarray(33)) };
}

export function vapidKey(publicKey: string, privateKey: string): KeyObject {
  const d = Buffer.from(privateKey, "base64url");
  if (d.length !== 32) throw new Error("clé privée VAPID invalide");
  return createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64url(d), ...publicXY(publicKey) }, format: "jwk" });
}

/** En-tête Authorization pour un service de push donné (valable 12 h). */
export function vapidAuthorization(endpoint: string, publicKey: string, key: KeyObject, subject: string, now = Date.now()) {
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64url(
    JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${publicKey}`;
}

export type PushResult = "sent" | "gone" | "error";

/** Envoie une notification vide ; « gone » si l'abonnement n'existe plus (à retirer). */
export async function sendEmptyPush(
  endpoint: string,
  auth: { publicKey: string; key: KeyObject; subject: string },
): Promise<PushResult> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(endpoint, auth.publicKey, auth.key, auth.subject),
        TTL: String(6 * 3600),
        Urgency: "normal",
        "Content-Length": "0",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "sent" : "error";
  } catch {
    return "error";
  }
}

/** Pour créer une paire de clés VAPID (une fois) : node src/lib/push/vapid.ts */
export function newVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  const pub = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x!, "base64url"), Buffer.from(pub.y!, "base64url")]);
  return { publicKey: b64url(raw), privateKey: jwk.d! };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const k = newVapidKeys();
  console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}`);
}
