import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { formatKg } from "@/lib/co2/challenges.ts";
import { signOut, updatePreferences } from "./actions";
import { DeleteAccount } from "./DeleteAccount";
import { SubmitButton } from "@/components/ui";
import { getEngagement } from "@/lib/engagement-data";
import { RecentGains } from "@/components/RecentGains";
import { PhoneCard } from "./PhoneCard";

export default async function ProfilPage() {
  const { supabase, user, profile } = await requireProfile();
  const [e, { count: doneChallenges }] = await Promise.all([
    getEngagement(supabase, user.id),
    supabase.from("user_challenges").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "done"),
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
      <div className="flex gap-2">
        <Link href="/notifications" className="btn-ghost min-h-11 flex-1 px-3 text-sm">Notifications</Link>
        <Link href="/jardin" className="btn-ghost min-h-11 flex-1 px-3 text-sm">Mon jardin</Link>
      </div>

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
          ].map((r) => (
            <li key={r.l} className="flex justify-between border-t border-encre/10 py-1.5">
              <span>{r.l}</span>
              <span className="font-bold">+{r.v}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/jardin" className="flex items-center gap-2 rounded-[18px] border border-encre/10 bg-papier px-3.5 py-3">
          <span aria-hidden="true" className="text-xl">🌻</span>
          <span className="text-sm font-bold">Mon jardin</span>
        </Link>
        <Link href="/duels" className="flex items-center gap-2 rounded-[18px] border border-encre/10 bg-papier px-3.5 py-3">
          <span aria-hidden="true" className="text-xl">⚔</span>
          <span className="text-sm font-bold">Mes duels</span>
        </Link>
      </div>

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

      <form action={signOut}>
        <button type="submit" className="btn-ghost w-full">Se déconnecter</button>
      </form>
      <DeleteAccount />
    </>
  );
}
