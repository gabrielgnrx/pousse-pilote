import Link from "next/link";

/**
 * Le fil d'actu de l'accueil, direction « La Tige » : une tige verticale relie tout ce qui se passe
 * dans l'entreprise. Les repères de jour, les bonus et les publications sont des nœuds posés dessus,
 * au lieu de cartes isolées empilées les unes sous les autres.
 *
 * Composants d'affichage seulement : la page du fil charge les données et passe les actions serveur.
 */

type FormAction = (form: FormData) => void | Promise<void>;

const AVATAR = ["#cfe3f0", "#f4d9c6", "#e1ebdb", "#fbefc9", "#e8dcf0", "#d5dfcf"];
export const avatarColor = (id: string) => AVATAR[parseInt(id.replace(/-/g, "").slice(-2), 16) % AVATAR.length];

/** La tige : une liste ordonnée avec le trait vertical derrière les nœuds. */
export function FeedStem({ children, label = "Fil d'actu" }: { children: React.ReactNode; label?: string }) {
  return (
    <ol aria-label={label} className="relative flex flex-col gap-4">
      <span aria-hidden="true" className="absolute top-2 bottom-0 left-[17px] w-[3px] rounded-full bg-tige" />
      {children}
    </ol>
  );
}

/** Le rond posé sur la tige, à gauche de chaque élément (38 px de large). */
function Node({ children }: { children: React.ReactNode }) {
  return <span className="relative flex w-[38px] shrink-0 justify-center">{children}</span>;
}

export function DayMarker({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <Node>
        <span aria-hidden="true" className="size-[13px] rounded-full bg-nuit shadow-[0_0_0_4px_var(--color-creme)]" />
      </Node>
      <h3 className="label">{label}</h3>
    </li>
  );
}

/** Un petit événement sans carte : bonus du jour, publication confirmée… */
export function StemNote({ title, detail }: { title: string; detail?: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <Node>
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-pollen text-encre shadow-[0_0_0_4px_var(--color-creme)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </Node>
      <p role="status" className="text-sm">
        <span className="font-bold">{title}</span>
        {detail ? <span className="text-brun"> · {detail}</span> : null}
      </p>
    </li>
  );
}

function Avatar({ userId, name, href }: { userId: string; name: string; href: string }) {
  return (
    <Link
      href={href}
      aria-label={`Jardin de ${name}`}
      className="relative flex size-[38px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-encre shadow-[0_0_0_4px_var(--color-creme)]"
      style={{ background: avatarColor(userId) }}
    >
      {name.charAt(0).toUpperCase()}
    </Link>
  );
}

export interface ActionPostProps {
  id: string;
  userId: string;
  /** « Toi » pour tes propres publications. */
  name: string;
  /** Le vrai nom, pour l'initiale de l'avatar. */
  authorName: string;
  teamName: string | null;
  title: string;
  when: string;
  caption: string;
  /** « −1,8 kg » ou « +20 pousses ». */
  gain: string;
  photoUrl?: string;
  cheers: number;
  cheered: boolean;
  mine: boolean;
  reported: boolean;
  tryHref?: string;
  duelHref?: string;
  cheerAction: FormAction;
  reportAction: FormAction;
}

export function ActionPost(p: ActionPostProps) {
  const garden = p.mine ? "/jardin" : `/jardin/${p.userId}`;
  return (
    <li className="flex gap-3.5">
      <Avatar userId={p.userId} name={p.authorName} href={garden} />
      <article className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[20px] bg-papier px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {p.name}
              {p.teamName ? <span className="font-medium text-brun"> · {p.teamName}</span> : null}
            </p>
            <p className="truncate text-[13px] text-brun">
              {p.title} · {p.when}
            </p>
          </div>
          <span className="flex h-[26px] shrink-0 items-center rounded-full bg-sauge px-2.5 text-[13px] font-bold text-sapin">{p.gain}</span>
        </div>

        <p className="text-base leading-snug">{p.caption}</p>

        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photoUrl} alt={`Photo : ${p.title}`} className="max-h-72 w-full rounded-[14px] object-cover" />
        ) : null}
        {p.reported ? <p className="text-xs font-semibold text-argile-fonce">Signalé, l&apos;équipe Pousse va vérifier.</p> : null}

        <div className="flex items-center gap-1">
          <form action={p.cheerAction}>
            <input type="hidden" name="validation" value={p.id} />
            <button
              type="submit"
              aria-pressed={p.cheered}
              className={`flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition active:scale-95 ${
                p.cheered ? "bg-chloro text-white" : "bg-sauge text-sapin"
              }`}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v11H3V10h4Z" />
                <path d="M7 10l4-8c2 0 3 1.5 3 3v3h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" />
              </svg>
              Bravo · {p.cheers}
            </button>
          </form>
          {p.tryHref ? (
            <Link href={p.tryHref} className="flex h-10 items-center px-3 text-sm font-bold text-encre">
              J&apos;essaie aussi
            </Link>
          ) : null}
          {!p.mine ? (
            <details className="group relative ml-auto">
              <summary
                aria-label="Plus d'options"
                className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-brun hover:bg-sable [&::-webkit-details-marker]:hidden"
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </summary>
              <div className="absolute right-0 bottom-11 z-10 flex w-52 flex-col rounded-[14px] bg-papier p-1.5 shadow-[0_8px_28px_rgba(20,38,27,0.16)]">
                {p.duelHref ? (
                  <Link href={p.duelHref} className="flex h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-sable">
                    Défier {p.name} en duel
                  </Link>
                ) : null}
                <form action={p.reportAction}>
                  <input type="hidden" name="validation" value={p.id} />
                  <button
                    type="submit"
                    disabled={p.reported}
                    className="flex h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-alerte hover:bg-sable disabled:text-brun"
                  >
                    {p.reported ? "Déjà signalé" : "Signaler la publication"}
                  </button>
                </form>
              </div>
            </details>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export interface ChallengePostProps {
  userId: string;
  name: string;
  authorName: string;
  teamName: string | null;
  verb: string;
  when: string;
  title: string;
  isDuel: boolean;
  won: boolean;
  done: number;
  target: number;
  until: string;
  joinHref?: string;
  mine: boolean;
}

/** Un défi lancé ou réussi. Les duels sont en Sous-bois et jaune : c'est de la compétition. */
export function ChallengePost(c: ChallengePostProps) {
  const garden = c.mine ? "/jardin" : `/jardin/${c.userId}`;
  const dark = c.isDuel && !c.won;
  const filled = Math.min(c.done, c.target);
  const segments = c.target <= 10 ? Array.from({ length: c.target }, (_, i) => i < filled) : null;
  return (
    <li className="flex gap-3.5">
      <Avatar userId={c.userId} name={c.authorName} href={garden} />
      <article
        className={`flex min-w-0 flex-1 flex-col gap-2.5 rounded-[20px] p-3.5 ${
          dark ? "bg-nuit text-white" : c.won ? "bg-sauge" : "bg-papier"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {c.name}
              <span className={`font-medium ${dark ? "text-nuit-pale" : "text-brun"}`}> {c.verb}</span>
            </p>
            <p className={`truncate text-[13px] ${dark ? "text-nuit-pale" : "text-brun"}`}>
              {c.teamName ? `${c.teamName} · ` : ""}
              {c.when}
            </p>
          </div>
          <span
            className={`flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11px] font-extrabold tracking-wider uppercase ${
              c.isDuel ? "bg-pollen text-encre" : c.won ? "bg-chloro text-white" : "bg-sable text-sapin"
            }`}
          >
            {c.isDuel ? "Duel" : c.won ? "Réussi" : "Défi"}
          </span>
        </div>
        <p className="text-base leading-snug font-bold">{c.title}</p>
        {!c.won ? (
          <div className="flex flex-col gap-1.5">
            {segments ? (
              <div className="flex gap-1.5" aria-hidden="true">
                {segments.map((on, i) => (
                  <span key={i} className={`h-2 flex-1 rounded-full ${on ? (dark ? "bg-pollen" : "bg-chloro") : dark ? "bg-white/15" : "bg-trait"}`} />
                ))}
              </div>
            ) : (
              <span className={`h-2 overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-trait"}`} aria-hidden="true">
                <span className={`block h-full rounded-full ${dark ? "bg-pollen" : "bg-chloro"}`} style={{ width: `${(filled / Math.max(1, c.target)) * 100}%` }} />
              </span>
            )}
            <p className={`text-xs ${dark ? "text-nuit-pale" : "text-brun"}`}>
              <span className={`font-bold ${dark ? "text-white" : "text-encre"}`}>
                {filled}/{c.target}
              </span>{" "}
              · jusqu&apos;au {c.until}
            </p>
          </div>
        ) : null}
        {c.joinHref ? (
          <Link
            href={c.joinHref}
            className={`flex h-11 items-center justify-center rounded-full text-[15px] font-bold ${dark ? "bg-white text-encre" : "bg-sable text-sapin"}`}
          >
            Je relève aussi
          </Link>
        ) : null}
      </article>
    </li>
  );
}
