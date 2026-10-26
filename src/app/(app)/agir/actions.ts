"use server";
import { redirect } from "next/navigation";
import { requireProfile, sqlErrorMessage } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";
import { PROOF_BUCKET } from "@/lib/constants";
import { actionTitle, themeOf, type Theme } from "@/lib/actions-catalog";
import { TEMPLATE_BY_ID, isHabitAction } from "@/lib/co2/challenges.ts";
import { z } from "zod";
import { ACTION_SLUGS } from "@/lib/co2/action-types.data.ts";
import { ACTION_BY_SLUG } from "@/lib/co2/engine.ts";
import { candidatesFor, interpretItems, parsePhrase, type ConfirmCard } from "@/lib/actions/interpret.ts";
import { habitsFromRow, type HabitsRow } from "@/lib/session";

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
  /** Unités comptées (2 repas = 2) ; la distance saisie a été ramenée au trajet déclaré. */
  units?: number;
  capped?: boolean;
  /** Aperçu affiché avant la réponse de la base (interface optimiste). */
  provisional?: boolean;
}

export type LogResult = { ok: true; action: LoggedAction } | { ok: false; error: string };

// --- Saisie libre ------------------------------------------------------------------

const RECEIPT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export type ParseResponse =
  | { ok: true; cards: ConfirmCard[] }
  | { ok: false; reason: "invalid" | "not_understood"; cards: ConfirmCard[] };

const textSchema = z.string().trim().min(2).max(300);

/**
 * Comprend une phrase libre par des règles (mots-clés et quantité, un ou plusieurs gestes) et propose des cartes à confirmer.
 * Rien n'est enregistré ici. Si la phrase n'est pas reconnue, les actions les plus proches sont
 * proposées au choix. Le CO₂ affiché est un aperçu : la base le recalcule à l'enregistrement.
 */
export async function parseActionText(raw: string): Promise<ParseResponse> {
  const parsed = textSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid", cards: [] };
  const text = parsed.data;
  const { supabase, user } = await requireProfile();
  const { data: row } = await supabase.from("habits").select("*").eq("user_id", user.id).maybeSingle<HabitsRow>();
  const habits = row ? habitsFromRow(row) : null;

  const items = parsePhrase(text);
  if (items) return { ok: true, cards: interpretItems(items, text, habits) };

  const suggestions = interpretItems(
    candidatesFor(text, 3).map((slug) => ({ action: slug, quantity: null, unit: "", confidence: 0 })),
    text,
    habits,
  ).map((c) => ({ ...c, needsChoice: c.needsChoice ?? ("low_confidence" as const) }));
  return { ok: false, reason: "not_understood", cards: suggestions.slice(0, 1).map((c) => ({ ...c, candidates: suggestions.map((x) => x.slug) })) };
}

const confirmSchema = z.object({
  slug: z.enum(ACTION_SLUGS as [string, ...string[]]),
  quantity: z.coerce.number().positive().max(10_000).optional(),
});

/** Enregistre une carte confirmée : la base recalcule tout (CO₂, plafonds, pousses). */
export async function logParsedAction(form: FormData): Promise<LogResult> {
  const input = confirmSchema.safeParse({
    slug: form.get("slug"),
    quantity: form.get("quantity") === null || form.get("quantity") === "" ? undefined : form.get("quantity"),
  });
  if (!input.success) return { ok: false, error: "Vérifie l'action et la quantité avant de valider." };
  const action = ACTION_BY_SLUG[input.data.slug];
  const { supabase, user, profile } = await requireProfile();

  let receiptPath: string | null = null;
  const file = form.get("receipt");
  if (file instanceof File && file.size > 0) {
    const ext = RECEIPT_TYPES[file.type];
    if (!ext) return { ok: false, error: "Justificatif en photo : JPEG, PNG ou WebP (une capture d'écran convient)." };
    if (file.size > 5 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (5 Mo maximum)." };
    receiptPath = `${user.id}/recu-${crypto.randomUUID()}.${ext}`;
    const { error: upload } = await supabase.storage.from(PROOF_BUCKET).upload(receiptPath, file, { contentType: file.type, upsert: false });
    if (upload) return { ok: false, error: "Envoi du justificatif impossible. Réessaie." };
  }

  const { data, error } = await supabase.rpc("log_action_slug", {
    p_action: action.slug,
    p_quantity: input.data.quantity ?? null,
    p_receipt: receiptPath,
  });
  if (error || !data) {
    if (receiptPath) await supabase.storage.from(PROOF_BUCKET).remove([receiptPath]);
    const code = error?.message ?? "";
    return { ok: false, error: ERRORS[code] ?? sqlErrorMessage(code) };
  }
  return describe(supabase, user.id, profile.display_name, data);
}

const ERRORS: Record<string, string> = {
  cap_reached: "Déjà compté aujourd'hui : au-delà du plafond du jour, rien n'est compté. Reviens demain !",
  week_cap_reached:
    "Plafond de la semaine atteint, d'après ton bilan (2 trajets par jour de bureau déclaré, 5 jours de télétravail, 3 achats d'occasion). Rendez-vous lundi !",
  unknown_action: "Cette action n'existe pas.",
  teletravail_conflict: "Un jour de télétravail ne se cumule pas avec un trajet domicile-travail le même jour.",
  receipt_required: "Joins ton justificatif (reçu, billet ou facture) pour valider cette action.",
  invalid_photo: "Ce justificatif n'a pas pu être enregistré. Réessaie.",
  quantity_out_of_range: "Cette quantité n'est pas possible pour cette action : corrige-la avant de valider.",
  quantity_required: "Indique la distance avant de valider.",
  quantity_not_allowed: "Cette action ne prend pas de quantité.",
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
    units?: number;
    quantity?: number | null;
    capped?: boolean;
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
      title: titleWithQuantity(r),
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
      units: Number(r.units ?? 1),
      capped: !!r.capped,
    },
  };
}

/** Le titre de l'action, avec la distance ou le nombre d'unités quand la personne les a saisis. */
function titleWithQuantity(r: { template_id: string; variant: string; units?: number; quantity?: number | null }): string {
  const q = r.quantity === null || r.quantity === undefined ? null : Number(r.quantity);
  if (r.template_id === "train" && r.variant === "km" && q) return `Train au lieu de l'avion · ${q.toLocaleString("fr-FR")} km`;
  const base = actionTitle(r.template_id, r.variant);
  if (["velo", "transports", "covoiturage"].includes(r.template_id) && q) return `${base} · ${q.toLocaleString("fr-FR")} km`;
  if ((r.units ?? 1) > 1) return `${base} · ×${r.units}`;
  return base;
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
