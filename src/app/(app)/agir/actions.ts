"use server";
import { redirect } from "next/navigation";
import { requireProfile, sqlErrorMessage } from "@/lib/session";
import { getEngagement } from "@/lib/engagement-data";
import { PROOF_BUCKET } from "@/lib/constants";
import { actionTitle, themeOf, type Theme } from "@/lib/actions-catalog";
import { TEMPLATE_BY_ID } from "@/lib/co2/challenges.ts";

export interface LoggedAction {
  id: string;
  title: string;
  theme: Theme;
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
  challenge: { target: number; done: number; startsOn: string; endsOn: string; days: string[] } | null;
}

export type LogResult = { ok: true; action: LoggedAction } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  cap_reached: "Déjà compté aujourd'hui : au-delà du plafond du jour, rien n'est compté. Reviens demain !",
  unknown_action: "Cette action n'existe pas.",
};

/** Enregistre une action en un tap, sans preuve. Le CO₂ et les pousses sont calculés par la base. */
export async function logAction(templateId: string, variant: string): Promise<LogResult> {
  const { supabase, user, profile } = await requireProfile();
  const { data, error } = await supabase.rpc("log_action", { p_template: templateId, p_variant: variant });
  if (error || !data) {
    const code = error?.message ?? "";
    return { ok: false, error: ERRORS[code] ?? sqlErrorMessage(code) };
  }
  const r = data as {
    id: string;
    template_id: string;
    variant: string;
    kg: number;
    points: number;
    month_count: number;
    month_kg: number;
    challenge: { target: number; done: number; starts_on: string; ends_on: string; days: string[] } | null;
  };

  const [me, { data: pulse }] = await Promise.all([
    getEngagement(supabase, user.id),
    supabase.rpc("company_pulse"),
  ]);
  const t = TEMPLATE_BY_ID[r.template_id];

  return {
    ok: true,
    action: {
      id: r.id,
      title: actionTitle(r.template_id, r.variant),
      theme: themeOf(r.template_id),
      kg: Number(r.kg),
      points: Number(r.points),
      monthCount: Number(r.month_count),
      monthKg: Number(r.month_kg),
      streak: me.streak,
      total: me.points.total,
      companyKg: pulse ? Number((pulse as { kg: number }).kg) : null,
      firstName: profile.display_name,
      unit: t?.unit ?? { one: "fois", many: "fois" },
      challenge: r.challenge
        ? {
            target: Number(r.challenge.target),
            done: Number(r.challenge.done),
            startsOn: r.challenge.starts_on,
            endsOn: r.challenge.ends_on,
            days: r.challenge.days ?? [],
          }
        : null,
    },
  };
}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Ajoute une photo à une action du jour : +5 pousses, et elle part dans le fil. */
export async function publishAction(_prev: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase, user } = await requireProfile();
  const validation = String(form.get("validation") ?? "");
  const caption = String(form.get("caption") ?? "").slice(0, 280);
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choisis une photo." };
  const ext = IMAGE_TYPES[photo.type];
  if (!ext) return { error: "Photo au format JPEG, PNG ou WebP." };
  if (photo.size > 5 * 1024 * 1024) return { error: "Photo trop lourde (5 Mo maximum)." };

  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upload } = await supabase.storage.from(PROOF_BUCKET).upload(path, photo, {
    contentType: photo.type,
    upsert: false,
  });
  if (upload) return { error: "Envoi de la photo impossible. Réessaie." };

  const { error } = await supabase.rpc("publish_action", {
    p_validation: validation,
    p_photo_path: path,
    p_caption: caption,
  });
  if (error) {
    await supabase.storage.from(PROOF_BUCKET).remove([path]);
    return {
      error:
        error.message === "nothing_to_publish"
          ? "Cette action est déjà publiée, ou elle ne date pas d'aujourd'hui."
          : sqlErrorMessage(error.message),
    };
  }
  redirect("/fil?publie=1");
}
