import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { Questionnaire } from "./Questionnaire";
import { DEFAULT_ANSWERS } from "./questions";
import type { BilanAnswers } from "@/lib/co2/footprint.ts";
import { BILAN_EVERY_DAYS, nextBilanAllowed } from "@/lib/bilan-lock";
import { formatInstant } from "@/lib/dates";
import { PublicPage } from "@/components/PublicPage";

export default async function QuestionnairePage() {
  const { supabase, user } = await requireProfile();
  // Pour refaire le bilan, on repart des dernières réponses.
  const [{ data }, { data: first }] = await Promise.all([
    supabase
      .from("footprints")
      .select("answers, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ answers: BilanAnswers; created_at: string }>(),
    supabase
      .from("footprints")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
  ]);

  // Un bilan tous les 30 jours au plus : sinon, on pourrait l'ajuster pour gonfler le CO₂ évité.
  const next = nextBilanAllowed(first?.created_at ?? null, data?.created_at ?? null);
  if (next) {
    return (
      <PublicPage
        title="Ton bilan est à jour"
        lead={`Tu as fait ton dernier bilan le ${formatInstant(data!.created_at)}. Pour que le CO₂ évité reste juste pour toute l'entreprise, le bilan se refait une fois tous les ${BILAN_EVERY_DAYS} jours au plus.`}
      >
        <p className="font-bold">Prochain bilan possible : {formatInstant(next.toISOString())}.</p>
        <p>Tes habitudes ont changé d&apos;ici là ? Enregistre tes nouvelles actions avec le bouton + : elles comptent dès aujourd&apos;hui.</p>
        <Link href="/bilan" className="btn-dark">Revoir mon bilan</Link>
      </PublicPage>
    );
  }
  // Les questions ajoutées depuis le dernier bilan partent de leur valeur par défaut.
  return <Questionnaire initial={data?.answers ? { ...DEFAULT_ANSWERS, ...data.answers } : undefined} />;
}
