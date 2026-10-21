import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { formatKg } from "@/lib/co2/challenges.ts";
import { signOut, updatePreferences } from "./actions";
import { DeleteAccount } from "./DeleteAccount";
import { SubmitButton } from "@/components/ui";
import { getEngagement } from "@/lib/engagement-data";
import { RecentGains } from "@/components/RecentGains";
import { PhoneCard } from "./PhoneCard";
import { InstallPrompt } from "@/components/InstallPrompt";
import type { Footprint } from "@/lib/co2/footprint.ts";

const FP_PARTS: { key: keyof Footprint["byCategory"]; label: string; color: string }[] = [
  { key: "transport", label: "Transports", color: "#f0a97b" },
  { key: "alimentation", label: "Alimentation", color: "#b5c890" },
  { key: "logement", label: "Chauffage", color: "#e9c9a3" },
  { key: "consommation", label: "Achats", color: "#8fa06a" },
  { key: "services", label: "Services publics", color: "#6f7d52" },
];

export default async function ProfilPage() {
  const { supabase, user, profile } = await requireProfile();
  const [e, { count: doneChallenges }, { data: fp }] = await Promise.all([
    getEngagement(supabase, user.id),
    supabase.from("user_challenges").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "done"),
    supabase
      .from("footprints")
      .select("total_kg, by_category")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ total_kg: number; by_category: Footprint["byCategory"] }>(),
  ]);

  return (
    <>
      <section className="flex items-center gap-4">
        <span className="flex size-16 items-center justify-center rounded-full bg-abricot font-display text-2xl font-bold text-[#402a16]">
          {profile.display_name.charAt(0).toUpperCase()}
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-terre">{user.email}</p>
        </div>
      </section>

      {fp ? (
        <Link href="/bilan" className="card flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-lg font-bold">Mon bilan</span>
            <span className="font-display text-lg font-bold">
              {(Number(fp.total_kg) / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t/an
            </span>
          </div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {FP_PARTS.map((c) => (
              <div key={c.key} style={{ width: `${(Number(fp.by_category[c.key]) / Number(fp.total_kg)) * 100}%`, background: c.color }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-brun">
            {FP_PARTS.filter((c) => c.key !== "services").map((c) => (
              <span key={c.key} className="flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ background: c.color }} aria-hidden="true" />
                {c.label} {Math.round((Number(fp.by_category[c.key]) / Number(fp.total_kg)) * 100)} %
              </span>
            ))}
          </div>
          {e.kgAvoided > 0 ? (
            <span className="rounded-xl bg-[#e3edd9] px-3 py-2 text-[13px] font-bold text-[#22502c]">−{formatKg(e.kgAvoided)} évités grâce à tes gestes</span>
          ) : null}
          <span className="text-sm font-bold underline underline-offset-2">Le détail et comment le réduire ›</span>
        </Link>
      ) : null}

      <nav aria-label="Mon espace" className="flex flex-col overflow-hidden rounded-[20px] border border-encre/10 bg-papier">
        {[
          { href: "/jardin", label: "Mon jardin" },
          { href: "/notifications", label: "Notifications" },
          { href: "/regles", label: "Le barème des pousses" },
        ].map((l, i) => (
          <Link key={l.href} href={l.href} className={`flex min-h-[52px] items-center justify-between px-4 text-[15px] font-semibold ${i ? "border-t border-encre/10" : ""}`}>
            {l.label}
            <span aria-hidden="true" className="text-terre">›</span>
          </Link>
        ))}
      </nav>

      <section id="pousses" className="card flex scroll-mt-4 flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <p className="label">Tes pousses · le jeu</p>
          <Link href="/regles" className="text-xs font-bold underline underline-offset-2">Le barème</Link>
        </div>
        <p>
          <span className="font-display text-4xl font-bold">{e.points.total}</span>
          <span className="ml-1.5 text-sm font-semibold">pousses depuis le début</span>
          <span className="block text-xs text-terre">
            dont {e.week.points} cette semaine
            {e.streak > 0 ? ` · série de ${e.streak} jour${e.streak > 1 ? "s" : ""} d'affilée` : ""}
          </span>
        </p>
        <ul className="flex flex-col text-sm">
          {[
            { l: "Défis validés", v: e.points.defis },
            { l: "Habitudes gardées", v: e.points.maintien },
            {
              l: `Collègues inspirés${e.influence.challenges > 0 ? ` (${e.influence.challenges} défi${e.influence.challenges > 1 ? "s" : ""})` : ""}`,
              v: e.points.influence,
            },
            { l: "Témoin pour un collègue", v: e.points.temoin },
            { l: "Quêtes du jour et séries", v: e.points.bonus },
            { l: "Meilleurs choix au scanner", v: e.points.scan },
            { l: "Quiz, graines, défis d'équipe et duels", v: e.points.jeu },
            ...(e.points.penalite < 0 ? [{ l: "Mises perdues en duel", v: e.points.penalite }] : []),
          ].map((r) => (
            <li key={r.l} className="flex justify-between border-t border-encre/10 py-1.5">
              <span>{r.l}</span>
              <span className={`font-bold ${r.v < 0 ? "text-argile-fonce" : ""}`}>{r.v < 0 ? r.v : `+${r.v}`}</span>
            </li>
          ))}
        </ul>
      </section>

      <RecentGains items={e.recent.slice(0, 8)} />

      <PhoneCard vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <section className="card flex flex-col gap-2">
        <p className="label">Ton impact · la planète</p>
        <div className="flex gap-4">
          <p className="flex-1">
            <span className="block font-display text-2xl font-bold">{formatKg(e.kgAvoided)}</span>
            <span className="text-xs text-terre">de CO₂ évités par tes défis</span>
          </p>
          <p className="flex-1">
            <span className="block font-display text-2xl font-bold">{doneChallenges ?? 0}</span>
            <span className="text-xs text-terre">défi{(doneChallenges ?? 0) > 1 ? "s" : ""} réussi{(doneChallenges ?? 0) > 1 ? "s" : ""}</span>
          </p>
        </div>
        {e.influence.kg > 0 ? (
          <p className="text-xs text-terre">
            Et {formatKg(e.influence.kg)} évités par les collègues que tu as inspirés.
          </p>
        ) : null}
      </section>

      <form action={updatePreferences} className="card flex flex-col gap-3">
        <p className="label">Profil et confidentialité</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">Prénom affiché</span>
          <input name="display_name" defaultValue={profile.display_name} maxLength={40} className="input" />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="share_feed" defaultChecked={profile.share_feed} className="mt-0.5 size-5 accent-sapin" />
          <span>Mes actions et mes défis apparaissent dans le fil de l&apos;entreprise (jamais mes reçus d&apos;achat).</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent_team_stats" defaultChecked={profile.consent_team_stats} className="mt-0.5 size-5 accent-sapin" />
          <span>Mes défis comptent dans les totaux anonymes de mon équipe.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent_feedback" defaultChecked={profile.consent_feedback} className="mt-0.5 size-5 accent-sapin" />
          <span>Pousse peut me proposer un court questionnaire.</span>
        </label>
        <SubmitButton className="btn-dark text-sm" pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </form>

      <section className="card flex flex-col gap-2 text-sm leading-relaxed">
        <p className="label">Tes données</p>
        <p>Photos de preuve supprimées après 90 jours. Ton employeur ne voit que des totaux par équipe.</p>
        <a href="/api/export" className="font-bold underline">Télécharger mes données (JSON)</a>
        <Link href="/confidentialite" className="font-bold underline">Politique de confidentialité</Link>
        <Link href="/methodologie" className="font-bold underline">Méthodologie de calcul</Link>
      </section>

      <InstallPrompt />
      <Link href="/avis" className="flex items-center gap-3 rounded-[20px] bg-peche p-4">
        <span className="flex-1">
          <span className="block text-sm font-bold">30 secondes pour améliorer Pousse ?</span>
          <span className="block text-xs text-[#5a4324]">3 questions sur ta semaine</span>
        </span>
        <span className="btn-primary min-h-10 px-4 text-sm">Répondre</span>
      </Link>

      <form action={signOut}>
        <button type="submit" className="btn-ghost w-full">Se déconnecter</button>
      </form>
      <DeleteAccount />
    </>
  );
}
