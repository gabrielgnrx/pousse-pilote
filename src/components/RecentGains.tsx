import { relativeTime } from "@/lib/dates";

/** Les dernières pousses gagnées, comme un relevé qui défile. */
export function RecentGains({ items }: { items: { label: string; points: number; at: string }[] }) {
  if (!items.length) return null;
  return (
    <section className="card flex flex-col gap-1 py-3" aria-labelledby="gains">
      <h2 id="gains" className="label">Tes dernières pousses</h2>
      <ul className="flex flex-col">
        {items.map((g, i) => (
          <li key={`${g.at}-${i}`} className="flex items-center gap-3 border-t border-encre/10 py-2 first:border-0">
            <span className="flex h-7 min-w-12 items-center justify-center rounded-full bg-peche px-2 text-sm font-bold text-argile-fonce">
              +{g.points}
            </span>
            <span className="flex-1 text-sm">{g.label}</span>
            <span className="text-xs text-terre">{relativeTime(g.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
