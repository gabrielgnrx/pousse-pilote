import { notFound } from "next/navigation";
import Link from "next/link";
import { requireHabits } from "@/lib/session";
import { TEMPLATE_BY_ID, unitImpact } from "@/lib/co2/challenges.ts";
import { ValidateForm } from "./ValidateForm";

export default async function ValiderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile, habits } = await requireHabits();

  const { data: challenge } = await supabase
    .from("user_challenges")
    .select("id, template_id, variant, target, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!challenge) notFound();
  const t = TEMPLATE_BY_ID[challenge.template_id];
  if (!t) notFound();

  const [{ data: colleagues }, { data: done }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("company_id", profile.company_id)
      .neq("id", user.id)
      .order("display_name"),
    supabase.from("validations").select("units").eq("challenge_id", id).eq("status", "valid"),
  ]);
  const doneUnits = (done ?? []).reduce((s, v) => s + v.units, 0);
  const impact = unitImpact(t.id, challenge.variant, habits);
  const variant = t.variants.find((v) => v.key === challenge.variant);

  return (
    <>
      <Link href="/defis" className="flex h-11 w-fit items-center gap-1.5 text-sm font-semibold text-terre">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        Défis
      </Link>
      <div className="-mt-2">
        <p className="label">
          {doneUnits}/{challenge.target} {t.unit.many}
        </p>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        {t.variants.length > 1 && variant ? <p className="text-sm text-terre">{variant.label}</p> : null}
      </div>
      {challenge.status !== "active" ? (
        <p className="card text-sm">Ce défi est terminé. Bravo !</p>
      ) : (
        <ValidateForm
          challengeId={challenge.id}
          unitKg={impact.kg}
          unit={t.unit}
          maxUnits={t.dailyCap}
          proofHint={t.proofHint}
          colleagues={(colleagues ?? []).map((c) => ({ id: c.id, name: c.display_name }))}
        />
      )}
    </>
  );
}
