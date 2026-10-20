import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { TEMPLATE_BY_ID, formatKg } from "@/lib/co2/challenges.ts";
import { formatDay, relativeTime } from "@/lib/dates";
import { respondWitness } from "./actions";

interface Row {
  id: string;
  template_id: string;
  units: number;
  kg: number;
  day: string;
  created_at: string;
  witness_status: string;
  author: { display_name: string } | null;
  witness: { display_name: string } | null;
}

export default async function NotificationsPage() {
  const { supabase, user } = await requireProfile();
  const select =
    "id, template_id, units, kg, day, created_at, witness_status, author:profiles!validations_user_id_fkey(display_name), witness:profiles!validations_witness_id_fkey(display_name)";

  const [{ data: toConfirm }, { data: answered }, { data: alerts }] = await Promise.all([
    supabase.from("validations").select(select).eq("witness_id", user.id).eq("witness_status", "pending").order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("validations").select(select).eq("user_id", user.id).in("witness_status", ["confirmed", "denied"]).order("created_at", { ascending: false }).limit(10).returns<Row[]>(),
    supabase
      .from("alerts")
      .select("id, title, body, url, created_at, seen_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<{ id: number; title: string; body: string; url: string; created_at: string; seen_at: string | null }[]>(),
  ]);
  // Ouvrir la page vaut lecture : la pastille disparaît, et ces alertes ne partent plus en notification.
  if ((alerts ?? []).some((a) => !a.seen_at)) await supabase.rpc("mark_alerts_seen");

  return (
    <>
      <h1 className="font-display text-2xl font-bold">Notifications</h1>

      {(alerts ?? []).length ? (
        <section className="flex flex-col gap-1">
          <h2 className="label">Récentes</h2>
          {(alerts ?? []).map((a) => (
            <Link key={a.id} href={a.url} className="flex items-start gap-3 rounded-2xl px-1 py-2 active:bg-sable">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-2.5 shrink-0 rounded-full ${a.seen_at ? "bg-trait" : "bg-argile"}`}
              />
              <span className="flex-1">
                <span className="block text-sm leading-snug font-bold">
                  {a.title}
                  {a.seen_at ? null : <span className="sr-only"> (nouvelle)</span>}
                </span>
                <span className="block text-sm text-brun">{a.body}</span>
                <span className="block text-xs text-terre">{relativeTime(a.created_at)}</span>
              </span>
              <span aria-hidden="true" className="text-terre">›</span>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="label">À confirmer</h2>
        {(toConfirm ?? []).length === 0 ? <p className="text-sm text-terre">Rien à confirmer pour l&apos;instant.</p> : null}
        {(toConfirm ?? []).map((r) => {
          const t = TEMPLATE_BY_ID[r.template_id];
          return (
            <article key={r.id} className="card flex flex-col gap-3 border-[1.5px] border-sapin">
              <p className="text-sm leading-relaxed">
                <strong>{r.author?.display_name ?? "Un collègue"}</strong> te demande de confirmer :{" "}
                <strong>{t?.title ?? "un défi"}</strong>, {r.units} {r.units > 1 ? t?.unit.many : t?.unit.one} le{" "}
                {formatDay(r.day)}.
              </p>
              <form action={respondWitness} className="flex gap-2">
                <input type="hidden" name="validation" value={r.id} />
                <button name="answer" value="oui" className="btn-dark flex-1 text-sm">Je confirme</button>
                <button name="answer" value="non" className="btn-ghost flex-1 text-sm">Je ne peux pas</button>
              </form>
              <p className="text-xs text-terre">
                Confirmer te rapporte 3 pousses. Si tu ne peux pas confirmer, cette validation sera annulée.
              </p>
            </article>
          );
        })}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="label mt-2">Tes confirmations</h2>
        {(answered ?? []).length === 0 ? <p className="text-sm text-terre">Aucune réponse pour l&apos;instant.</p> : null}
        {(answered ?? []).map((r) => {
          const t = TEMPLATE_BY_ID[r.template_id];
          const ok = r.witness_status === "confirmed";
          return (
            <div key={r.id} className="flex items-start gap-3 py-1">
              <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${ok ? "bg-sauge" : "bg-peche"}`} aria-hidden="true">
                {ok ? "✓" : "×"}
              </span>
              <div>
                <p className="text-sm leading-snug">
                  {r.witness?.display_name ?? "Ton collègue"} {ok ? "a confirmé" : "n'a pas pu confirmer"} : {t?.title}
                  {ok ? ` (−${formatKg(Number(r.kg))})` : " — validation annulée"}
                </p>
                <p className="text-xs text-terre">{relativeTime(r.created_at)}</p>
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
