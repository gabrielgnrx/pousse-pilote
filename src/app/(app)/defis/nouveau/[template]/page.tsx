import { notFound } from "next/navigation";
import Link from "next/link";
import { requireHabits } from "@/lib/session";
import { TEMPLATE_BY_ID, unitImpact } from "@/lib/co2/challenges.ts";
import { NewChallengeForm } from "./NewChallengeForm";

export default async function NewChallengePage({
  params,
  searchParams,
}: {
  params: Promise<{ template: string }>;
  searchParams: Promise<{ variante?: string; via?: string }>;
}) {
  const { template } = await params;
  const { variante, via } = await searchParams;
  const t = TEMPLATE_BY_ID[template];
  if (!t) notFound();
  const { supabase, user, profile, habits } = await requireHabits();

  // Adversaires possibles pour un duel : les collègues des autres équipes.
  let others = supabase
    .from("profiles")
    .select("id, display_name, team:teams(name)")
    .not("team_id", "is", null)
    .neq("id", user.id)
    .order("display_name");
  if (profile.team_id) others = others.neq("team_id", profile.team_id);
  const { data: rivals } = await others.returns<{ id: string; display_name: string; team: { name: string } | null }[]>();

  // « Relever aussi » : la publication doit être visible dans le fil et venir d'un collègue.
  let inspiredBy: { id: string; name: string } | undefined;
  if (via && /^[0-9a-f-]{36}$/i.test(via)) {
    const { data: src } = await supabase
      .from("validations")
      .select("id, user_id, author:profiles!validations_user_id_fkey(display_name)")
      .eq("id", via)
      .eq("visibility", "company")
      .eq("status", "valid")
      .maybeSingle<{ id: string; user_id: string; author: { display_name: string } | null }>();
    if (src && src.user_id !== user.id) inspiredBy = { id: src.id, name: src.author?.display_name ?? "un collègue" };
  }

  const variants = t.variants.map((v) => ({ ...v, impact: unitImpact(t.id, v.key, habits) }));
  const firstEligible =
    variants.find((v) => v.key === variante && v.impact.eligible) ?? variants.find((v) => v.impact.eligible);

  return (
    <>
      <Link href="/defis?onglet=catalogue" className="flex h-11 w-fit items-center gap-1.5 text-sm font-semibold text-terre">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        Catalogue
      </Link>
      <h1 className="-mt-2 font-display text-2xl font-bold">{t.title}</h1>
      {firstEligible ? (
        <NewChallengeForm
          template={{ id: t.id, unit: t.unit, variantQuestion: t.variantQuestion, proofHint: t.proofHint, defaultTarget: t.defaultTarget, pointsPerUnit: t.pointsPerUnit, source: t.source }}
          variants={variants.map((v) => ({ key: v.key, label: v.label, kg: v.impact.kg, eligible: v.impact.eligible, reason: v.impact.reason, formula: v.impact.formula }))}
          initialVariant={firstEligible.key}
          inspiredBy={inspiredBy}
          rivals={(rivals ?? []).map((r) => ({ id: r.id, name: r.display_name, team: r.team?.name ?? "" }))}
        />
      ) : (
        <p className="card text-sm">{variants[0]?.impact.reason ?? "Ce défi n'est pas disponible pour toi."}</p>
      )}
    </>
  );
}
