import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { TEMPLATE_BY_ID } from "@/lib/co2/challenges.ts";
import { BONUS, MODES, fmtMult } from "@/lib/boosts";
import { DuelFromChallenge } from "./DuelFromChallenge";

export const metadata = { title: "Passer en duel · Pousse" };

export default async function DuelFromChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile();
  const { data: challenge } = await supabase
    .from("user_challenges")
    .select("id, template_id, variant, target, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!challenge || challenge.status !== "active") notFound();
  const t = TEMPLATE_BY_ID[challenge.template_id];
  if (!t) notFound();

  let others = supabase
    .from("profiles")
    .select("id, display_name, team:teams(name)")
    .not("team_id", "is", null)
    .neq("id", user.id)
    .order("display_name");
  if (profile.team_id) others = others.neq("team_id", profile.team_id);
  const { data: rivals } = await others.returns<{ id: string; display_name: string; team: { name: string } | null }[]>();
  const target = Math.min(challenge.target, 10);

  return (
    <>
      <Link href="/defis" className="flex h-11 w-fit items-center gap-1.5 text-sm font-semibold text-terre">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        Mes défis
      </Link>
      <div className="-mt-2">
        <p className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">Passer en duel · {fmtMult(MODES.duel.mult)}</p>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
      </div>
      <p className="card text-sm leading-relaxed">
        Ton adversaire et toi avez 7 jours pour faire {target} {target > 1 ? t.unit.many : t.unit.one} chacun, à partir de son
        acceptation. Chaque action qui y compte rapporte {fmtMult(MODES.duel.mult)}. Gagner : +{BONUS.duelSeul}, ou +{BONUS.duelDeux}{" "}
        chacun si vous réussissez tous les deux. Échouer : −{BONUS.mise} (ta mise). Refuser ne lui coûte rien.
      </p>
      {(rivals ?? []).length ? (
        <DuelFromChallenge
          challengeId={challenge.id}
          rivals={(rivals ?? []).map((r) => ({ id: r.id, name: r.display_name, team: r.team?.name ?? "" }))}
        />
      ) : (
        <p className="card text-sm">Aucun collègue d&apos;une autre équipe n&apos;est encore inscrit.</p>
      )}
    </>
  );
}
