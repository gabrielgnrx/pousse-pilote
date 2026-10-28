/**
 * La mascotte de Pousse : une pousse qui sourit, posée sur sa motte de terre, avec un bourgeon pollen.
 * Décorative, donc cachée aux lecteurs d'écran. `grown` l'agrandit (célébrations).
 * `pot` colore la motte et `rim` le bourgeon : sur fond vert, passe des teintes claires.
 */
export function Mascot({
  size = 92,
  grown = false,
  pot = "#e1ebdb",
  rim = "#f2c14e",
  className = "",
}: {
  size?: number;
  grown?: boolean;
  pot?: string;
  rim?: string;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" width={size} height={Math.round(size * 1.15)} viewBox="0 0 104 120" className={className}>
      <ellipse cx="52" cy="112" rx="40" ry="6" fill={pot} />
      <path d={grown ? "M52 112V40" : "M52 112V54"} stroke="#2e7a4c" strokeWidth="5" strokeLinecap="round" />
      {grown ? (
        <>
          <path d="M52 56c0-24 16-40 44-40 0 28-16 40-44 40Z" fill="#2e7a4c" />
          <path d="M52 76c0-19-14-32-38-32 0 22 14 32 38 32Z" fill="#7db878" />
          <path d="M52 40c-5-14 0-26 13-32 4 14-1 24-13 32Z" fill={rim} />
          <path d="M42 95c1.6-2.4 4-2.4 5.6 0M57 95c1.6-2.4 4-2.4 5.6 0" stroke="#14261b" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <path d="M46 102c3.5 3.5 8.5 3.5 12 0" stroke="#14261b" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M52 66c0-20 14-34 38-34 0 24-14 34-38 34Z" fill="#2e7a4c" />
          <path d="M52 82c0-16-12-27-32-27 0 19 12 27 32 27Z" fill="#7db878" />
          <path d="M52 54c-4-12 0-22 11-27 3 12-1 20-11 27Z" fill={rim} />
          <circle cx="44" cy="96" r="3" fill="#14261b" />
          <circle cx="60" cy="96" r="3" fill="#14261b" />
          <path d="M47 103c3 3 7 3 10 0" stroke="#14261b" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  );
}

/** Feuilles et graines autour des célébrations. */
export function Confetti({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="320" height="80" viewBox="0 0 320 80" className={className}>
      <path d="M22 40c-4-10 3-19 13-17-3 10-6 14-13 17Z" fill="#7db878" />
      <path d="M286 22c7-7 16-3 16 7-9 0-12-2-16-7Z" fill="#f2c14e" />
      <path d="M64 12c4-6 11-5 13 1-6 2-9 1-13-1Z" fill="#f2c14e" />
      <path d="M250 60c2-7 9-9 13-4-4 4-8 5-13 4Z" fill="#cfe2cd" />
      <circle cx="44" cy="70" r="4" fill="#fbefc9" />
      <circle cx="268" cy="8" r="3.5" fill="#7db878" />
      <circle cx="300" cy="64" r="3" fill="#f2c14e" />
    </svg>
  );
}
