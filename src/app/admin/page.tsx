import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/session";
import { formatKg } from "@/lib/co2/challenges.ts";
import { POSTE_LABEL } from "@/lib/admin/report";

interface Dashboard {
  k: number;
  participants: number;
  active_7: number | null;
  active_30: number | null;
  with_bilan: number | null;
  kg_total: number | null;
  actions_total: number | null;
  by_poste: Record<string, number | null>;
  weeks: { week: string; active: number | null; kg: number | null }[];
  teams: { name: string; members: number; active: number; kg: number; score: number }[];
  ai: { calls: number; cost_usd: number };
}

const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const weekLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Une tuile chiffrée ; « < 5 » quand la valeur est masquée pour protéger l'anonymat. */
function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="label">{label}</span>
      <span className="font-display text-3xl leading-none">{value}</span>
      {hint ? <span className="text-xs text-terre">{hint}</span> : null}
    </div>
  );
}

/** Tableau de bord RSE : agrégats seulement, rien sous 5 personnes. */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org: orgId } = await searchParams;
  const { supabase, orgs, org } = await requireAdmin(orgId);
  if (!org) redirect("/admin/lancer");
  const { data, error } = await supabase.rpc("admin_dashboard", { p_company: org.company_id });
  if (error || !data) return <p className="card text-sm">Le tableau de bord n&apos;a pas pu se charger. Réessaie dans un instant.</p>;
  const d = data as Dashboard;
  const masked = `< ${d.k}`;
  const maxWeek = Math.max(1, ...d.weeks.map((w) => w.kg ?? 0));
  const postes = Object.entries(d.by_poste).filter(([k]) => k !== "autre");
  const maxPoste = Math.max(1, ...postes.map(([, v]) => v ?? 0));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl">{org.name}</h1>
          <p className="text-sm text-brun">Totaux de l&apos;organisation. Aucune donnée individuelle, rien sous {d.k} personnes.</p>
        </div>
        {orgs.length > 1 ? (
          <nav aria-label="Organisations" className="flex gap-1.5">
            {orgs.map((o) => (
              <Link key={o.company_id} href={`/admin?org=${o.company_id}`} aria-current={o.company_id === org.company_id ? "page" : undefined} className="chip min-h-9 bg-papier text-encre">
                {o.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

      <section aria-label="Chiffres clés" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Participants" value={fr(d.participants)} hint={d.with_bilan === null ? undefined : `${fr(d.with_bilan)} avec leur bilan`} />
        <Tile label="Actifs (7 jours)" value={d.active_7 === null ? masked : fr(d.active_7)} hint={d.active_30 === null ? undefined : `${fr(d.active_30)} sur 30 jours`} />
        <Tile label="CO₂ évité" value={d.kg_total === null ? masked : formatKg(d.kg_total)} hint="depuis le lancement" />
        <Tile label="Actions" value={d.actions_total === null ? masked : fr(d.actions_total)} hint="enregistrées" />
      </section>

      <section aria-labelledby="tendance" className="card flex flex-col gap-3">
        <h2 id="tendance" className="font-display text-lg">CO₂ évité par semaine</h2>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Barres du CO₂ évité sur les 12 dernières semaines ; les valeurs sont dans le tableau ci-dessous.">
          {d.weeks.map((w) => (
            <div key={w.week} className="group relative flex h-full flex-1 flex-col justify-end">
              {w.kg === null ? (
                <span className="h-1 rounded-full bg-trait" title={`Semaine du ${weekLabel(w.week)} : masqué (moins de ${d.k} personnes actives)`} />
              ) : (
                <span
                  className="rounded-t-[4px] bg-sapin transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max(2, (w.kg / maxWeek) * 100)}%` }}
                  title={`Semaine du ${weekLabel(w.week)} : ${formatKg(w.kg)}, ${w.active} personnes actives`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-terre">
          <span>{weekLabel(d.weeks[0]?.week ?? "")}</span>
          <span>{weekLabel(d.weeks.at(-1)?.week ?? "")}</span>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-sapin">Voir les données</summary>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-terre">
                <th className="py-1 font-semibold">Semaine du</th>
                <th className="py-1 font-semibold">Personnes actives</th>
                <th className="py-1 font-semibold">CO₂ évité</th>
              </tr>
            </thead>
            <tbody>
              {d.weeks.map((w) => (
                <tr key={w.week} className="border-t border-trait">
                  <td className="py-1">{weekLabel(w.week)}</td>
                  <td className="py-1">{w.active === null ? masked : w.active}</td>
                  <td className="py-1">{w.kg === null ? masked : formatKg(w.kg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section aria-labelledby="postes" className="card flex flex-col gap-2.5">
        <h2 id="postes" className="font-display text-lg">CO₂ évité par poste</h2>
        {postes.length === 0 ? <p className="text-sm text-brun">Pas encore d&apos;actions enregistrées.</p> : null}
        {postes.map(([k, v]) => (
          <div key={k} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 font-semibold">{POSTE_LABEL[k] ?? k}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-sable">
              {v !== null ? <span className="block h-full rounded-full bg-sapin" style={{ width: `${Math.max(2, (v / maxPoste) * 100)}%` }} /> : null}
            </span>
            <span className="w-20 shrink-0 text-right">{v === null ? masked : formatKg(v)}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="equipes" className="card flex flex-col gap-2">
        <h2 id="equipes" className="font-display text-lg">Classement des équipes</h2>
        {d.teams.length === 0 ? (
          <p className="text-sm text-brun">Aucune équipe n&apos;a encore 5 membres : le classement apparaîtra dès que ce sera le cas.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-terre">
                <th className="py-1 font-semibold">#</th>
                <th className="py-1 font-semibold">Équipe</th>
                <th className="py-1 font-semibold">Membres</th>
                <th className="py-1 text-right font-semibold">CO₂ évité</th>
              </tr>
            </thead>
            <tbody>
              {d.teams.map((t, i) => (
                <tr key={t.name} className="border-t border-trait">
                  <td className="py-1.5 font-display">{i + 1}</td>
                  <td className="py-1.5 font-semibold">{t.name}</td>
                  <td className="py-1.5">{t.members}</td>
                  <td className="py-1.5 text-right">{formatKg(Number(t.kg))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-wrap gap-2">
        <Link href={`/admin/rapport?org=${org.company_id}`} className="btn-dark min-h-11 text-sm">Rapport mensuel</Link>
        <a href={`/admin/export/mobilite?org=${org.company_id}`} className="btn-ghost min-h-11 text-sm">Export mobilité (CSV)</a>
      </section>
      <p className="text-xs text-terre">
        CO₂ calculé avec les facteurs de l&apos;ADEME, par rapport aux habitudes déclarées par chacun. IA ce mois-ci : {fr(d.ai.calls)} appels,{" "}
        {d.ai.cost_usd.toLocaleString("fr-FR", { style: "currency", currency: "USD" })} estimés.
      </p>
    </>
  );
}
