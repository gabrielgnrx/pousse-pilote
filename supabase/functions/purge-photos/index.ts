/**
 * Purge des photos (Edge Function Supabase, appelée chaque nuit par pg_cron, migration 0044) :
 *   1. efface les justificatifs déposés il y a plus de 30 jours ;
 *   2. efface les photos publiées dans le fil il y a plus de 90 jours.
 * Promesses faites aux salariés dans /confidentialite. La clé de service est fournie par Supabase à la
 * fonction : elle ne sort jamais de Supabase. L'appel est protégé par la clé « purge » (cron_keys).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "proofs";
const DAY = 24 * 3600 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "configuration" }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: allowed } = await admin.rpc("cron_key_named", { p_name: "purge", p_token: token });
  if (allowed !== true) return json({ error: "non autorisé" }, 401);

  // 1. Justificatifs : 30 jours au plus.
  const { data: receipts, error: e1 } = await admin
    .from("validations")
    .select("id, receipt_path")
    .not("receipt_path", "is", null)
    .lt("created_at", new Date(Date.now() - 30 * DAY).toISOString())
    .limit(500);
  if (e1) return json({ error: e1.message }, 500);
  if (receipts?.length) {
    await admin.storage.from(BUCKET).remove(receipts.map((v) => v.receipt_path as string));
    await admin.from("validations").update({ receipt_path: null }).in("id", receipts.map((v) => v.id));
  }

  // 2. Photos du fil : 90 jours au plus.
  const { data: photos, error: e2 } = await admin
    .from("validations")
    .select("id, proof_photo_path")
    .not("proof_photo_path", "is", null)
    .lt("created_at", new Date(Date.now() - 90 * DAY).toISOString())
    .limit(500);
  if (e2) return json({ error: e2.message }, 500);
  if (photos?.length) {
    await admin.storage.from(BUCKET).remove(photos.map((v) => v.proof_photo_path as string));
    await admin.from("validations").update({ proof_photo_path: null }).in("id", photos.map((v) => v.id));
  }

  return json({ receipts: receipts?.length ?? 0, photos: photos?.length ?? 0 });
});
