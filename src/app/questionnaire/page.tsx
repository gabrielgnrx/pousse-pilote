import { requireProfile } from "@/lib/session";
import { Questionnaire } from "./Questionnaire";
import { DEFAULT_ANSWERS } from "./questions";
import type { BilanAnswers } from "@/lib/co2/footprint.ts";

export default async function QuestionnairePage() {
  const { supabase, user } = await requireProfile();
  // Pour refaire le bilan, on repart des dernières réponses.
  const { data } = await supabase
    .from("footprints")
    .select("answers")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ answers: BilanAnswers }>();
  // Les questions ajoutées depuis le dernier bilan partent de leur valeur par défaut.
  return <Questionnaire initial={data?.answers ? { ...DEFAULT_ANSWERS, ...data.answers } : undefined} />;
}
