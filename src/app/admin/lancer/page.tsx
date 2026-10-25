import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin/session";
import { SubmitButton } from "@/components/ui";
import { LaunchForm } from "./LaunchForm";
import { addTeams } from "./actions";

async function siteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`;
}

/** Lancement en self-serve, puis invitation des salariés et gestion des équipes. */
export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ org?: string; cree?: string; nouvelle?: string }> }) {
  const { org: orgId, cree, nouvelle } = await searchParams;
  const { user, orgs, org } = await requireAdmin(orgId);
  const domain = (user.email ?? "").split("@")[1] ?? "";

  if (!org || nouvelle) {
    return (
      <>
        <div>
          <h1 className="font-display text-3xl">Lancer Pousse</h1>
          <p className="mt-1 text-sm text-brun">3 étapes : l&apos;organisation, les équipes, le lien d&apos;invitation. Moins de 30 minutes.</p>
        </div>
        <LaunchForm emailDomain={domain} />
      </>
    );
  }

  const link = `${await siteUrl()}/rejoindre?code=${encodeURIComponent(org.join_code)}`;
  return (
    <>
      {cree ? (
        <p role="status" className="animate-pousse-pop rounded-2xl bg-sauge px-4 py-3 text-sm font-bold text-sapin">
          Organisation créée ! Il ne reste qu&apos;à partager le lien ci-dessous.
        </p>
      ) : null}
      <div>
        <h1 className="font-display text-3xl">{org.name}</h1>
        <p className="mt-1 text-sm text-brun">
          {org.participants} participant{org.participants > 1 ? "s" : ""} · {org.email_domain ? `adresses @${org.email_domain}` : "tout domaine e-mail"}
        </p>
      </div>

      <section className="card flex flex-col gap-2">
        <h2 className="font-display text-lg">Inviter les salariés</h2>
        <p className="text-sm text-brun">Partage ce lien (e-mail, intranet, Slack ou Teams). Le code est prérempli.</p>
        <p className="rounded-2xl bg-creme px-3 py-2 font-mono text-sm break-all select-all">{link}</p>
        <p className="text-sm">
          Code de l&apos;entreprise : <strong className="font-mono tracking-wider">{org.join_code}</strong>
        </p>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-sapin">Un message tout prêt à envoyer</summary>
          <p className="mt-2 rounded-2xl bg-creme px-3 py-2 whitespace-pre-line">
            {`Bonjour à toutes et à tous,\n\nNous lançons Pousse, une application pour réduire notre empreinte carbone, à notre rythme et en équipe. La participation est volontaire et vos données restent privées : l'entreprise ne voit que des totaux.\n\nPour rejoindre (2 minutes) : ${link}\n\nÀ très vite dans le QG de votre équipe !`}
          </p>
        </details>
      </section>

      <section className="card flex flex-col gap-2">
        <h2 className="font-display text-lg">Équipes</h2>
        <ul className="flex flex-wrap gap-1.5">
          {org.teams.map((t) => (
            <li key={t.id} className="chip bg-sauge text-sapin">{t.name}</li>
          ))}
        </ul>
        <form action={addTeams} className="flex flex-col gap-2">
          <input type="hidden" name="org" value={org.company_id} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-semibold">Ajouter des équipes (une par ligne)</span>
            <textarea name="teams" rows={2} className="input" />
          </label>
          <SubmitButton className="btn-ghost min-h-11 text-sm" pendingLabel="Ajout…">Ajouter</SubmitButton>
        </form>
      </section>

      {orgs.length < 3 ? (
        <a href="/admin/lancer?nouvelle=1" className="self-start text-sm font-semibold text-sapin underline underline-offset-2">
          Lancer une autre organisation
        </a>
      ) : null}
    </>
  );
}
