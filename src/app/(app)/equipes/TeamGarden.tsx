import Link from "next/link";
import type { TeamGarden as Garden } from "@/lib/game/data.ts";
import { ANIMAL_BY_KEY, type AnimalKey } from "@/lib/game/ecosystem.ts";
import { TEAM_KINDS, type TeamKind } from "@/lib/team";
import { GiftForm } from "./GiftForm";

/** Article et pronom du migrateur (« la cigogne… elle », « les oies… elles »). */
const BIRDS: Record<string, { the: string; plural: boolean }> = {
  cigogne: { the: "la cigogne", plural: false },
  grue: { the: "la grue", plural: false },
  hirondelles: { the: "les hirondelles", plural: true },
  oies: { the: "les oies", plural: true },
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Le jardin de l'équipe, entre le classement et le chat : le migrateur de la semaine (il se pose chez
 * chaque membre qui contribue au défi voté), le bosquet des défis réussis, et le myosotis du jour à offrir.
 */
export function TeamGarden({ garden, me }: { garden: Garden; me: string }) {
  const m = garden.migration;
  const bird = m ? ANIMAL_BY_KEY[m.bird as AnimalKey] : null;
  const hosted = m?.hosts.some((h) => h.id === me) ?? false;
  const kind = m?.kind ? TEAM_KINDS[m.kind as TeamKind] : null;
  const empty = m ? Math.max(0, m.needed - m.hosts.length) : 0;
  const b = BIRDS[m?.bird ?? ""] ?? { the: "le migrateur", plural: false };
  const pl = (one: string, many: string) => (b.plural ? many : one);
  const she = pl("elle", "elles");

  return (
    <section aria-labelledby="jardin-equipe" className="flex flex-col gap-3 rounded-[24px] bg-papier p-4">
      <h2 id="jardin-equipe" className="sr-only">
        Jardin de l&apos;équipe
      </h2>
      {m && bird ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold tracking-wider text-argile-fonce uppercase">Migrateur de la semaine</p>
            <p className="text-xs text-terre">jusqu&apos;à dimanche</p>
          </div>
          <p className="font-display text-xl leading-tight">
            {m.done ? `${cap(b.the)} ${pl("niche", "nichent")} chez vous !` : `${cap(b.the)} ${pl("voyage", "voyagent")} d'île en île`}
          </p>
          <p className="text-sm leading-snug text-brun">
            {m.done
              ? `${cap(she)} ${pl("est arrivée", "sont arrivées")} dans le carnet de toute l'équipe.`
              : kind
                ? `${cap(she)} se ${pl("pose", "posent")} chez chaque membre qui contribue au défi de la semaine (${kind.unit}). Si ${m.needed} îles ${pl("l'accueillent", "les accueillent")}, ${she} ${pl("arrive", "arrivent")} dans le carnet de tout le monde.`
                : `${cap(she)} ${pl("partira", "partiront")} avec le défi voté lundi dans le chat, à 14 h.`}
          </p>
          {kind && !m.done ? (
            <div className="flex items-center gap-1.5" aria-label={`${m.hosts.length} île${m.hosts.length > 1 ? "s" : ""} sur ${m.needed}`}>
              {m.hosts.slice(0, 8).map((h) => (
                <span
                  key={h.id}
                  title={h.name}
                  className={`flex size-9 items-center justify-center rounded-full text-xs font-extrabold ${h.id === me ? "bg-pollen text-encre" : "bg-sauge text-sapin"}`}
                >
                  {h.id === me ? "Toi" : initials(h.name)}
                </span>
              ))}
              {Array.from({ length: Math.min(empty, 6) }, (_, i) => (
                <span key={i} aria-hidden="true" className="size-9 rounded-full border-2 border-dashed border-trait" />
              ))}
              <span className="ml-auto font-display text-lg tabular-nums">
                {m.hosts.length}/{m.needed}
              </span>
            </div>
          ) : null}
          {kind && !m.done && !hosted ? (
            <Link href={kind.href} className="btn-primary min-h-11 text-sm">
              Accueillir {b.the} sur mon île
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3 rounded-[18px] bg-sable p-3">
        <svg aria-hidden="true" width="72" height="40" viewBox="0 0 72 40" className="shrink-0">
          <ellipse cx="36" cy="34" rx="34" ry="6" fill="#e9d9a8" />
          {Array.from({ length: Math.min(garden.grove, 5) }, (_, i) => (
            <g key={i} transform={`translate(${10 + i * 13} ${i % 2 ? 4 : 0})`}>
              <rect x="-1.5" y="22" width="3" height="10" fill="#7a5236" />
              <circle cx="0" cy="18" r="8" fill={i % 2 ? "#7fb069" : "#2e7d4f"} />
            </g>
          ))}
        </svg>
        <p className="text-sm leading-snug">
          <strong>
            Bosquet de l&apos;équipe : {garden.grove} arbre{garden.grove > 1 ? "s" : ""}
          </strong>
          <br />
          <span className="text-brun">Un arbre par défi de la semaine réussi ensemble.</span>
        </p>
      </div>

      {garden.gifted_today ? (
        <p className="rounded-[18px] bg-sauge px-3 py-2.5 text-sm text-sapin">
          Tu as offert ton myosotis du jour. Trois myosotis sur une île attirent le rouge-gorge.
        </p>
      ) : garden.colleagues.length ? (
        <GiftForm colleagues={garden.colleagues} />
      ) : null}
    </section>
  );
}
