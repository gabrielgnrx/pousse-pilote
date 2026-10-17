/** La plante de la personne : elle grandit d'un niveau à l'autre (0 = graine, 6 = forêt). */
export function Plant({ level, size = 88 }: { level: number; size?: number }) {
  const leaf = "#b5c890";
  const leafDark = "#8fa06a";
  const stem = "#6f7d52";
  const soil = "#c99b6d";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="animate-pousse-grow">
      <ellipse cx="50" cy="90" rx="30" ry="7" fill={soil} opacity="0.85" />
      {level === 0 ? (
        <ellipse cx="50" cy="84" rx="9" ry="6" fill="#a9794b" />
      ) : null}
      {level >= 1 && level <= 4 ? (
        <>
          <path d={`M50 88 V${88 - 14 - level * 10}`} stroke={stem} strokeWidth={2 + level * 0.6} strokeLinecap="round" />
          {/* une paire de feuilles par niveau */}
          {Array.from({ length: level }, (_, i) => {
            const y = 82 - i * 11;
            const s = 1 + i * 0.12;
            return (
              <g key={i}>
                <path d={`M50 ${y} C ${50 - 14 * s} ${y - 4}, ${50 - 18 * s} ${y - 14 * s}, ${50 - 4} ${y - 10 * s} Z`} fill={i % 2 ? leafDark : leaf} />
                <path d={`M50 ${y - 4} C ${50 + 14 * s} ${y - 8}, ${50 + 18 * s} ${y - 18 * s}, ${50 + 4} ${y - 14 * s} Z`} fill={i % 2 ? leaf : leafDark} />
              </g>
            );
          })}
        </>
      ) : null}
      {level === 5 ? (
        <>
          <rect x="46" y="52" width="8" height="38" rx="3" fill="#7a5a3a" />
          <circle cx="50" cy="40" r="24" fill={leafDark} />
          <circle cx="38" cy="48" r="14" fill={leaf} />
          <circle cx="62" cy="46" r="15" fill={leaf} />
        </>
      ) : null}
      {level >= 6 ? (
        <>
          {[
            { x: 28, h: 26, r: 15 },
            { x: 72, h: 26, r: 15 },
            { x: 50, h: 34, r: 20 },
          ].map((t) => (
            <g key={t.x}>
              <rect x={t.x - 3} y={88 - t.h} width="6" height={t.h} rx="2" fill="#7a5a3a" />
              <circle cx={t.x} cy={88 - t.h - t.r / 2} r={t.r} fill={t.x === 50 ? leafDark : leaf} />
            </g>
          ))}
        </>
      ) : null}
    </svg>
  );
}
