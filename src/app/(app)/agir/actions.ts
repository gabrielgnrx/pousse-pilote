"use server";
import { redirect } from "next/navigation";
import { requireProfile, sqlErrorMessage } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";
import { PROOF_BUCKET } from "@/lib/constants";
import { actionTitle, themeOf, type Theme } from "@/lib/actions-catalog";
import { TEMPLATE_BY_ID, isHabitAction } from "@/lib/co2/challenges.ts";

export interface LoggedAction {
  id: string;
  title: string;
  theme: Theme;
  /** Une bonne habitude que la personne a déjà : 0 kg, mais toutes ses pousses. */
  habit: boolean;
  kg: number;
  points: number;
  /** Nombre de fois et CO₂ cumulé de cette action, ce mois-ci. */
  monthCount: number;
  monthKg: number;
  streak: number;
  /** Total de pousses après l'action. */
  total: number;
  /** CO₂ évité par toute l'entreprise depuis le début du pilote. */
  companyKg: number | null;
  firstName: string;
  unit: { one: string; many: string };
  /** Le défi en cours dans lequel l'action compte. */
  challenge: { id: string; target: number; done: number; startsOn: string; endsOn: string; days: string[] } | null;
  /** Pousses sans multiplicateur, et le multiplicateur appliqué (duel ×1,5, équipe ×2). */
  basePoints: number;
  multiplier: number;
  boost: "duel" | "equipe" | null;
  /** Le duel en cours sur ce geste. */
  duel: { otherName: string; mine: number; theirs: number; target: number; endsOn: string; stakes: boolean } | null;
  /** Achat validé avec un reçu (privé, jamais publié). */
  receipt: boolean;
}

export type LogResult = { ok: true; action: LoggedAction } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  cap_reached: "Déjà compté aujourd'hui : au-delà du plafond du jour, rien n'est compté. Reviens demain !",
  week_cap_reached:
    "Plafond de la semaine atteint, d'après ton bilan (2 trajets par jour de bureau déclaré, 5 jours de télétravail, 3 achats d'occasion). Rendez-vous lundi !",
  unknown_action: "Cette action n'existe pas.",
  teletravail_conflict: "Un jour de télétravail ne se cumule pas avec un trajet domicile-travail le même jour.",
  receipt_required: "Joins ton justificatif (reçu, billet ou facture) pour valider cette action.",
  invalid_photo: "Ce justificatif n'a pas pu être enregistré. Réessaie.",
};

/** Enregistre une action en un tap, sans preuve. Le CO₂ et les pousses sont calculés par la base. */
export async function logAction(templateId: string, variant: string): Promise<LogResult> {
  const { supabase, user, profile } = await requireProfile();
  const { data, error } = await supabase.rpc("log_action", { p_template: templateId, p_variant: variant });
  if (error || !data) {
    const code = error?.message ?? "";
    return { ok: false, error: ERRORS[code] ?? sqlErrorMessage(code) };
  }
  return describe(supabase, user.id, profile.display_name, data);
}

const RECEIPT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Un achat via une appli durable : le reçu est envoyé (privé), puis l'action est enregistrée. */
export async function logActionWithReceipt(form: FormData): Promise<LogResult> {
  const { supabase, user, profile } = await requireProfile();
  const templateId = String(form.get("template") ?? "");
  const variant = String(form.get("variant") ?? "base");
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: ERRORS.receipt_required };
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) return { ok: false, error: "Reçu en photo : JPEG, PNG ou WebP (une capture d'écran convient)." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (5 Mo maximum)." };

  const path = `${user.id}/recu-${crypto.randomUUID()}.${ext}`;
  const { error: upload } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upload) return { ok: false, error: "Envoi du justificatif impossible. Réessaie." };

  const { data, error } = await supabase.rpc("log_action", { p_template: templateId, p_variant: variant, p_receipt: path });
  if (error || !data) {
    await supabase.storage.from(PROOF_BUCKET).remove([path]);
    const code = error?.message ?? "";
    return { ok: false, error: ERRORS[code] ?? sqlErrorMessage(code) };
  }
  return describe(supabase, user.id, profile.display_name, data);
}

async function describe(
  supabase: Awaited<ReturnType<typeof requireProfile>>["supabase"],
  userId: string,
  firstName: string,
  data: unknown,
): Promise<LogResult> {
  const r = data as {
    id: string;
    template_id: string;
    variant: string;
    kg: number;
    points: number;
    month_count: number;
    month_kg: number;
    challenge: { id: string; target: number; done: number; starts_on: string; ends_on: string; days: string[] } | null;
    base_points: number;
    multiplier: number;
    boost: "duel" | "equipe" | null;
    duel: { other_name: string; mine: number; theirs: number; target: number; ends_on: string; stakes: boolean } | null;
    receipt: boolean;
  };

  const [me, { data: pulse }] = await Promise.all([
    getEngagement(supabase, userId),
    supabase.rpc("company_pulse"),
  ]);
  const t = TEMPLATE_BY_ID[r.template_id];

  return {
    ok: true,
    action: {
      id: r.id,
      title: actionTitle(r.template_id, r.variant),
      theme: themeOf(r.template_id),
      habit: isHabitAction(r.template_id),
      kg: Number(r.kg),
      points: Number(r.points),
      monthCount: Number(r.month_count),
      monthKg: Number(r.month_kg),
      streak: me.streak,
      total: me.points.total,
      companyKg: pulse ? Number((pulse as { kg: number }).kg) : null,
      firstName,
      unit: t?.unit ?? { one: "fois", many: "fois" },
      challenge: r.challenge
        ? {
            id: r.challenge.id,
            target: Number(r.challenge.target),
            done: Number(r.challenge.done),
            startsOn: r.challenge.starts_on,
            endsOn: r.challenge.ends_on,
            days: r.challenge.days ?? [],
          }
        : null,
      basePoints: Number(r.base_points ?? r.points),
      multiplier: Number(r.multiplier ?? 1),
      boost: r.boost ?? null,
      duel: r.duel
        ? {
            otherName: r.duel.other_name,
            mine: Number(r.duel.mine),
            theirs: Number(r.duel.theirs),
            target: Number(r.duel.target),
            endsOn: r.duel.ends_on,
            stakes: !!r.duel.stakes,
          }
        : null,
      receipt: !!r.receipt,
    },
  };
}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Publie une action du jour dans le fil, avec ou sans photo (la photo rapporte +5 pousses). */
export async function publishAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireProfile();
  const validation = String(form.get("validation") ?? "");
  const caption = String(form.get("caption") ?? "").slice(0, 280);
  const photo = form.get("photo");

  let path: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const ext = IMAGE_TYPES[photo.type];
    if (!ext) return { error: "Photo au format JPEG, PNG ou WebP." };
    if (photo.size > 5 * 1024 * 1024) return { error: "Photo trop lourde (5 Mo maximum)." };
    path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upload } = await supabase.storage.from(PROOF_BUCKET).upload(path, photo, {
      contentType: photo.type,
      upsert: false,
    });
    if (upload) return { error: "Envoi de la photo impossible. Réessaie." };
  }

  const { error } = await supabase.rpc("publish_action", {
    p_validation: validation,
    p_photo_path: path,
    p_caption: caption,
  });
  if (error) {
    if (path) await supabase.storage.from(PROOF_BUCKET).remove([path]);
    return {
      error:
        error.message === "nothing_to_publish"
          ? "Cette action est déjà publiée, ou elle ne date pas d'aujourd'hui."
          : sqlErrorMessage(error.message),
    };
  }
  redirect("/fil?publie=1");
}

/** Partage la réussite d'un défi dans le fil, sur demande. */
export async function shareChallengeDone(challengeId: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireProfile();
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return { ok: false };
  const { error } = await supabase.rpc("share_challenge", { p_challenge: challengeId, p_event: "reussi" });
  return { ok: !error };
}
