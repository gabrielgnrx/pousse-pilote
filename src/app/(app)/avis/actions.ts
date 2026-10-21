"use server";
import { requireProfile } from "@/lib/session";

// Doit correspondre à la liste affichée dans FeedbackForm.tsx.
const BRAKES = ["Pas le temps", "Défis pas adaptés", "Appli pas claire", "J'ai oublié", "Rien"] as const;

export interface FeedbackState {
  error?: string;
  sent?: boolean;
}

export async function sendFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const { supabase, user, profile } = await requireProfile();
  const motivation = Number(form.get("motivation"));
  const recommend = Number(form.get("recommend"));
  const brakes = form.getAll("brakes").map(String).filter((b) => (BRAKES as readonly string[]).includes(b));
  const comment = String(form.get("comment") ?? "").trim().slice(0, 1000) || null;
  if (!(motivation >= 1 && motivation <= 5)) return { error: "Réponds à la question 1." };
  if (!(recommend >= 0 && recommend <= 10)) return { error: "Réponds à la question 3." };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    company_id: profile.company_id,
    motivation,
    brakes,
    recommend,
    comment,
  });
  if (error) return { error: "Envoi impossible. Réessaie." };
  return { sent: true };
}
