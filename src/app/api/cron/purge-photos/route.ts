import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PROOF_BUCKET } from "@/lib/constants";
import { checkProofNow } from "@/lib/ai/proof/server";

/**
 * Chaque jour (Vercel Cron, vercel.json, protégée par CRON_SECRET) :
 *   1. reprend les justificatifs encore en attente de vérification (IA indisponible au moment de l'action) ;
 *   2. efface les justificatifs de plus de 30 jours (ils sont déjà effacés dès le verdict, sauf « à renvoyer ») ;
 *   3. efface les photos publiées dans le fil après 90 jours.
 * Promesses faites aux salariés dans /confidentialite.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Purge pas encore configurée (variables absentes) : rien à faire.
    return NextResponse.json({ skipped: "CRON_SECRET ou SUPABASE_SERVICE_ROLE_KEY manquant" });
  }
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  // 1. Vérifications en attente depuis plus de 10 minutes.
  const { data: pending } = await admin
    .from("validations")
    .select("id")
    .eq("proof_status", "pending")
    .lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .limit(20);
  let checked = 0;
  for (const p of pending ?? []) {
    if ((await checkProofNow(p.id)) !== "unavailable") checked++;
  }

  const limit = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const receiptLimit = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: old, error } = await admin
    .from("validations")
    .select("id, proof_photo_path")
    .not("proof_photo_path", "is", null)
    .lt("created_at", limit)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // 2. Les justificatifs : 30 jours au plus.
  const { data: receipts } = await admin
    .from("validations")
    .select("id, receipt_path")
    .not("receipt_path", "is", null)
    .lt("created_at", receiptLimit)
    .limit(500);
  if (receipts?.length) {
    await admin.storage.from(PROOF_BUCKET).remove(receipts.map((v) => v.receipt_path as string));
    await admin.from("validations").update({ receipt_path: null }).in("id", receipts.map((v) => v.id));
  }
  if (!old?.length) return NextResponse.json({ checked, purged: 0, receipts: receipts?.length ?? 0 });

  await admin.storage.from(PROOF_BUCKET).remove(old.map((v) => v.proof_photo_path as string));
  await admin
    .from("validations")
    .update({ proof_photo_path: null })
    .in("id", old.map((v) => v.id));

  return NextResponse.json({ checked, purged: old.length, receipts: receipts?.length ?? 0 });
}
