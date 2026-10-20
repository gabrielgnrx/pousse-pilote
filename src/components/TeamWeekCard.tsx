import Link from "next/link";
import { TEAM_KINDS, type TeamWeek } from "@/lib/team";

/** Sur l'accueil : le défi d'équipe de la semaine une fois choisi, ou le rappel du vote du lundi. */
export function TeamWeekCard({ week, voteOpen }: { week: TeamWeek; voteOpen: boolean }) {
  if (voteOpen) {
    return (
      <Link href="/equipes" className="flex items-center gap-3 rounded-[18px] bg-abricot px-4 py-3 text-[#402a16]">
        <span className="flex-1">
          <span className="block text-sm font-bold">Vote du défi d&apos;équipe jusqu&apos;à 14 h</span>
          <span className="block text-xs">
            {week.my_vote ? "Tu as voté, tu peux encore changer d'avis." : `${week.voters} vote${week.voters > 1 ? "s" : ""} sur ${week.members} : choisis le défi de la semaine.`}
          </span>
        </span>
        <span className="text-sm font-bold">{week.my_vote ? "Voir ›" : "Voter ›"}</span>
      </Link>
    );
  }
  if (!week.chosen || !week.target) return null;
  const k = TEAM_KINDS[week.chosen];
  const progress = week.progress ?? 0;
  const pct = Math.min(100, (progress / week.target) * 100);
  const reached = progress >= week.target;
  return (
    <Link href="/equipes" className="flex flex-col gap-2 rounded-[18px] bg-papier p-4" aria-label={`Défi d'équipe de la semaine : ${progress} sur ${week.target} ${k.unit}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold tracking-wider text-argile-fonce uppercase">Défi d&apos;équipe de la semaine</span>
        <span className="text-sm font-bold text-[#22502c]">
          {progress}/{week.target}
        </span>
      </span>
      <span className="text-[15px] leading-snug font-bold">
        {week.target} {k.unit} ensemble
      </span>
      <span className="h-2.5 overflow-hidden rounded-full bg-[#e6dcc6]">
        <span className="block h-2.5 rounded-full bg-[#2f6b3a] transition-[width] duration-1000" style={{ width: `${Math.max(pct, progress > 0 ? 3 : 0)}%` }} />
      </span>
      <span className="flex items-baseline justify-between gap-2 text-xs text-[#5e5240]">
        <span>{reached ? "Objectif atteint : +50 pousses pour chaque contributeur !" : `Toi : ${week.mine ?? 0} · ${k.hint}`}</span>
        <span className="shrink-0 font-bold text-encre">QG ›</span>
      </span>
    </Link>
  );
}
