/**
 * La mascotte de Pousse : une plante en pot qui sourit. Décorative, donc cachée aux lecteurs d'écran.
 * `grown` ajoute une troisième feuille (célébrations).
 */
export function Mascot({
  size = 92,
  grown = false,
  pot = "#b4532a",
  rim = "#d27a4f",
  className = "",
}: {
  size?: number;
  grown?: boolean;
  pot?: string;
  rim?: string;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" width={size} height={Math.round(size * 1.08)} viewBox="0 0 96 104" className={className}>
      <path d="M26 74h44l-5 26H31Z" fill={pot} />
      <path d="M24 70h48v8H24Z" fill={rim} />
      <path d={grown ? "M48 70V30" : "M48 70V38"} stroke="#c8dcc4" strokeWidth="5" strokeLinecap="round" />
      {grown ? (
        <>
          <path d="M48 40c0-16 11-28 31-28 0 19-11 28-31 28Z" fill="#a9d18e" />
          <path d="M48 52c0-13-10-22-27-22 0 16 10 22 27 22Z" fill="#7fb36a" />
          <path d="M48 30c-3-9 0-16 8-20 2 9-1 15-8 20Z" fill="#c8dcc4" />
          <path d="M39 85c1.5-2 3.5-2 5 0M52 85c1.5-2 3.5-2 5 0" stroke="#3a1606" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M43 91c3 3 7 3 10 0" stroke="#3a1606" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M48 46c0-14 10-24 28-24 0 17-10 24-28 24Z" fill="#a9d18e" />
          <path d="M48 54c0-11-9-19-24-19 0 14 9 19 24 19Z" fill="#7fb36a" />
          <circle cx="41" cy="86" r="2.6" fill="#3a1606" />
          <circle cx="55" cy="86" r="2.6" fill="#3a1606" />
          <path d="M44 92c2 2 6 2 8 0" stroke="#3a1606" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}

/** Feuilles et confettis autour des célébrations. */
export function Confetti({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="320" height="80" viewBox="0 0 320 80" className={className}>
      <path d="M22 40c-4-10 3-19 13-17-3 10-6 14-13 17Z" fill="#a9d18e" />
      <path d="M286 22c7-7 16-3 16 7-9 0-12-2-16-7Z" fill="#f7e1d3" />
      <path d="M64 12c4-6 11-5 13 1-6 2-9 1-13-1Z" fill="#e8a27c" />
      <path d="M250 60c2-7 9-9 13-4-4 4-8 5-13 4Z" fill="#c8dcc4" />
      <circle cx="44" cy="70" r="4" fill="#f7e1d3" />
      <circle cx="268" cy="8" r="3.5" fill="#a9d18e" />
      <circle cx="300" cy="64" r="3" fill="#e8a27c" />
    </svg>
  );
}
