import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { relativeTime } from "@/lib/dates";

export default async function NotificationsPage() {
  const { supabase, user } = await requireProfile();
  const [{ data: alerts }] = await Promise.all([
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
      <h1 className="font-display text-2xl">Notifications</h1>

      {(alerts ?? []).length ? (
        <section className="flex flex-col gap-1" aria-label="Notifications récentes">
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

      {(alerts ?? []).length === 0 ? (
        <p className="card text-sm text-brun">Rien de neuf pour l&apos;instant. Les invitations à un duel, les défis d&apos;équipe et les rappels arrivent ici.</p>
      ) : null}
    </>
  );
}
