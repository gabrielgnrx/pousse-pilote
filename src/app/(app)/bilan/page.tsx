import Link from "next/link";
import { nextBilanAllowed } from "@/lib/bilan-lock";
import { redirect } from "next/navigation";
import { requireHabits } from "@/lib/session";
import { computeFootprint, type BilanAnswers, type Footprint } from "@/lib/co2/footprint.ts";
import { actionPlan } from "@/lib/co2/plan.ts";
import { TEMPLATE_BY_ID, carKmEquivalent, formatKg } from "@/lib/co2/challenges.ts";
import { headStartKgYear, keptHabits, remainingBigItems } from "@/lib/co2/engagement.ts";
import { formatInstant } from "@/lib/dates";

const CATEGORIES: { key: keyof Footprint["byCategory"]; label: string; color: string }[] = [
  { key: "transport", label: "Transports", color: "#f0a97b" },
  { key: "alimentation", label: "Alimentation", color: "#b5c890" },
  { key: "logement", label: "Chauffage", color: "#e9c9a3" },
  { key: "consommation", label: "Vêtements et électronique", color: "#8fa06a" },
  { key: "services", label: "Services publics (part commune)", color: "#6f7d52" },
];

const tonnes = (kg: number) => (kg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 });

export default async function BilanPage() {
  const { supabase, user, habits } = await requireHabits();

  const [{ data: fp }, { data: validated }, { data: firstFp }] = await Promise.all([
    supabase
      .from("footprints")
      .select("answers, total_kg, by_category, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ answers: BilanAnswers; total_kg: number; by_category: Footprint["byCategory"]; created_at: string }>(),
    supabase.from("validations").select("kg").eq("user_id", user.id).eq("status", "valid"),
    supabase
      .from("footprints")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ created_at: string }>(),
  ]);
  if (!fp) redirect("/questionnaire");

  const { assumptions } = computeFootprint(fp.answers);
  const plan = actionPlan(habits).slice(0, 3);
  const kept = keptHabits(habits);
  const headStartYear = headStartKgYear(habits);
  const bigItems = remainingBigItems(habits).slice(0, 3);
  const avoided = (validated ?? []).reduce((s, v) => s + Number(v.kg), 0);
  const planKg = plan.reduce((s, p) => s + p.kgYear, 0);
  const nextBilan = new Date(fp.created_at);
  nextBilan.setDate(nextBilan.getDate() + 90);
  const nextAllowed = nextBilanAllowed(firstFp?.created_at ?? null, fp.created_at);

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold">Ton bilan carbone</h1>
        <p className="mt-1 text-sm text-terre">
          Calculé le {formatInstant(fp.created_at)} avec
          les facteurs de l&apos;ADEME.
        </p>
      </div>

      <section className="rounded-[20px] bg-sapin p-5 text-sapin-clair">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-5xl font-bold">{tonnes(fp.total_kg)}</span>
          <span className="text-sm">t CO₂e par an (estimation)</span>
        </p>
        <div className="mt-4 flex h-3.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {CATEGORIES.map((c) => (
            <div key={c.key} style={{ width: `${(fp.by_category[c.key] / fp.total_kg) * 100}%`, background: c.color }} />
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed">
          Un bilan partiel : à ne pas comparer tel quel à la moyenne française (8 à 9 t, bilan complet).
          Objectif des accords de Paris : 2 t par personne en 2050.
        </p>
      </section>

      <ul className="card flex flex-col divide-y divide-encre/10 p-0">
        {CATEGORIES.map((c) => (
          <li key={c.key} className="flex items-center gap-3 px-4 py-3">
            <span className="size-3.5 rounded" style={{ background: c.color }} aria-hidden="true" />
            <span className="flex-1 text-sm font-semibold">{c.label}</span>
            <span className="font-display font-bold">{formatKg(fp.by_category[c.key])}</span>
          </li>
        ))}
      </ul>
      <section className="card flex flex-col gap-2 text-sm leading-relaxed" aria-labelledby="perimetre">
        <h2 id="perimetre" className="font-display text-lg font-bold">Ce que ce bilan compte, et ce qu&apos;il ne compte pas</h2>
        <p>
          <strong>Compté :</strong> tes trajets, l&apos;avion, tes repas, l&apos;eau en bouteille, le chauffage, les
          vêtements et l&apos;électronique neufs, plus une part fixe de 1 t pour les services publics.
        </p>
        <p>
          <strong>Pas compté :</strong> l&apos;électricité hors chauffage, l&apos;équipement de la maison
          (meubles, électroménager), les loisirs, les sorties et la plupart des autres achats. Dans l&apos;étude
          Citepa et ABC de 2023, faite avec Nos Gestes Climat, les biens d&apos;équipement et les loisirs pèsent à eux
          seuls environ 16 % de l&apos;empreinte moyenne d&apos;un Français : ce bilan n&apos;en compte qu&apos;une partie.
        </p>
        <p className="text-xs text-terre">
          C&apos;est volontaire : Pousse se concentre sur ce que tu peux changer avec des actions concrètes.
          {assumptions.length ? ` ${assumptions.join(" ")}` : ""}
        </p>
        <a href="https://nosgestesclimat.fr" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-2">
          Mesurer ton empreinte complète avec Nos Gestes Climat (ADEME) <span aria-hidden="true">↗</span>
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      </section>

      {kept.length ? (
        <section className="flex flex-col gap-3 rounded-[20px] bg-sauge p-4 text-[#2e3a22]">
          <div>
            <h2 className="font-display text-lg font-bold">Ce que tu fais déjà</h2>
            {headStartYear >= 1 ? (
              <p className="mt-1 text-sm leading-snug">
                Tes habitudes évitent déjà environ <strong>{formatKg(headStartYear)} par an</strong> par rapport à
                la voiture thermique seule et à des repas avec viande.
              </p>
            ) : (
              <p className="mt-1 text-sm leading-snug">Ces habitudes pèsent déjà moins lourd que la moyenne.</p>
            )}
          </div>
          <ul className="flex flex-wrap gap-2">
            {kept.map((k) => (
              <li key={k.key} className="chip bg-papier">{k.title}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed">
            Ce chiffre est une comparaison, pas une réduction : il n&apos;est pas ajouté à ton CO₂ évité. Ces
            bonnes habitudes rapportent quand même leurs pousses : enregistre-les avec le bouton + quand tu les fais.
          </p>
          <Link href="/agir" className="btn-dark text-sm">Enregistrer une action</Link>
        </section>
      ) : null}

      {bigItems.length ? (
        <section className="card flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Tes plus gros postes restants</h2>
          <p className="-mt-1 text-xs text-terre">Là où il reste le plus à gagner, d&apos;après tes réponses.</p>
          <ul className="flex flex-col divide-y divide-encre/10">
            {bigItems.map((b) => {
              const t = TEMPLATE_BY_ID[b.templateId];
              return (
                <li key={b.key} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="text-sm font-bold">{b.label}</p>
                    <p className="text-xs text-terre">
                      {formatKg(b.kgYear)} par an · {Math.round((b.kgYear / fp.total_kg) * 100)} % de ton bilan
                    </p>
                  </div>
                  {t ? (
                    <Link href={`/defis/nouveau/${t.id}`} className="flex h-10 items-center rounded-full bg-sable px-3.5 text-xs font-bold">
                      {t.level === "expert" ? "Défi expert" : "Voir le défi"}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="card flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">Ta trajectoire</h2>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-xs text-terre">Déjà évité avec tes défis</p>
            <p className="font-display text-2xl font-bold">{formatKg(avoided)}</p>
            <p className="text-xs text-terre">soit {carKmEquivalent(avoided)} km en voiture</p>
          </div>
          {plan.length ? (
            <div className="flex-1 border-l border-encre/10 pl-3">
              <p className="text-xs text-terre">Si tu suis ton plan</p>
              <p className="font-display text-2xl font-bold">
                {tonnes(fp.total_kg)} → {tonnes(fp.total_kg - planKg)} t
              </p>
            </div>
          ) : null}
        </div>
        <p className="rounded-xl bg-sauge px-3 py-2 text-sm font-semibold text-[#2e3a22]">
          Prochain bilan conseillé : {formatInstant(nextBilan)}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Ton plan d&apos;action</h2>
          <p className="text-xs text-terre">Les actions qui réduisent le plus ton empreinte, calculés sur tes réponses.</p>
        </div>
        {plan.map((p, i) => (
          <article key={p.templateId} className="card flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-sapin font-display text-sm font-bold text-sapin-clair">
                {i + 1}
              </span>
              <h3 className="flex-1 font-display font-bold">{p.title}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="chip bg-sauge">−{formatKg(p.kgYear)} CO₂ / an</span>
              <span className="chip bg-creme font-semibold">{p.basis}</span>
            </div>
            <Link href={`/defis/nouveau/${p.templateId}?variante=${p.variant}`} className="btn-primary mt-1">
              Lancer le défi
            </Link>
          </article>
        ))}
        {!plan.length ? (
          <p className="card text-sm">
            Tes habitudes déclarées émettent déjà peu : bravo. Les défis restent ouverts si elles changent.
          </p>
        ) : null}
      </section>

      <div className="flex gap-3">
        <Link href="/questionnaire" className="btn-ghost flex-1 text-sm">
          {nextAllowed ? `Nouveau bilan le ${formatInstant(nextAllowed.toISOString(), "short")}` : "Refaire mon bilan"}
        </Link>
        <Link href="/methodologie" className="btn-ghost flex-1 text-sm">Comment c&apos;est calculé</Link>
      </div>
    </>
  );
}
