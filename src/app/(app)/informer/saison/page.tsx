import Link from "next/link";
import { IMPORTED, MONTHS, inSeason } from "@/lib/saison";
import { todayParis } from "@/lib/dates";
import { SOURCES } from "@/lib/co2/factors.ts";

export const metadata = { title: "Fruits et légumes de saison · Pousse" };

const kg = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;

export default async function SaisonPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const { mois } = await searchParams;
  const current = Number(todayParis().slice(5, 7));
  const m = Number(mois) >= 1 && Number(mois) <= 12 ? Number(mois) : current;
  const { legumes, fruits, next } = inSeason(m);

  return (
    <>
      <Link href="/informer" className="flex h-11 items-center gap-1 self-start rounded-full bg-papier pr-4 pl-3 text-sm font-bold">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        S&apos;informer
      </Link>
      <div>
        <h1 className="font-display text-2xl">De saison en {MONTHS[m - 1]}</h1>
        <p className="mt-1 text-sm text-terre">
          Hors saison, beaucoup de fruits et légumes viennent de serres chauffées ou de loin. Les chiffres : kg de CO₂ par kg
          acheté de saison.
        </p>
      </div>

      <nav aria-label="Choisir le mois" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {MONTHS.map((name, i) => (
          <Link
            key={name}
            href={`/informer/saison?mois=${i + 1}`}
            aria-current={i + 1 === m ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full px-3 text-xs font-bold capitalize ${i + 1 === m ? "bg-sapin text-sapin-clair" : "bg-papier"}`}
          >
            {name}
          </Link>
        ))}
      </nav>

      {[
        { title: "Légumes", list: legumes },
        { title: "Fruits", list: fruits },
      ].map((g) => (
        <section key={g.title} className="card flex flex-col gap-2">
          <h2 className="font-bold">{g.title} ({g.list.length})</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {g.list.map((p) => (
              <li key={p.name} className="flex justify-between gap-2 border-b border-encre/5 pb-1">
                <span>{p.name}</span>
                <span className="text-xs text-terre">{kg(p.kg)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {next.length ? (
        <p className="rounded-2xl bg-sauge px-4 py-3 text-sm text-sapin">
          <strong>Le mois prochain :</strong> {next.map((p) => p.name.toLowerCase()).join(", ")}.
        </p>
      ) : null}

      <section className="card flex flex-col gap-2">
        <h2 className="font-bold">Importés toute l&apos;année</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {IMPORTED.map((p) => (
            <li key={p.name} className="flex justify-between gap-2">
              <span>{p.name}</span>
              <span className={`font-bold ${p.kg > 5 ? "text-alerte" : "text-brun"}`}>{kg(p.kg)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-brun">
          Une mangue venue par avion pèse 16 fois plus qu&apos;une mangue venue par bateau : c&apos;est le transport aérien qui
          compte, plus que la distance.
        </p>
      </section>

      <p className="text-center text-xs text-terre">
        Source :{" "}
        <a href={SOURCES.saison} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">ADEME, Impact CO₂</a>
      </p>
    </>
  );
}
