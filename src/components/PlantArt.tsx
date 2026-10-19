import type { Shape } from "@/lib/game/garden.ts";

const SOIL = "#c99b6d";
const STEM = "#6f7d52";
const LOCKED = "#d8ccb6";

/**
 * Une plante du jardin, dessinée selon sa forme et son stade (1 à 4).
 * Stade 0 : silhouette grise (pas encore plantée).
 */
export function PlantArt({
  shape,
  color,
  accent,
  stage,
  size = 72,
  label,
}: {
  shape: Shape;
  color: string;
  accent: string;
  stage: number;
  size?: number;
  label?: string;
}) {
  const locked = stage === 0;
  const s = locked ? 2 : Math.min(4, Math.max(1, stage));
  const k = [0.45, 0.62, 0.8, 1][s - 1];
  const c = locked ? LOCKED : color;
  const a = locked ? LOCKED : accent;
  const stem = locked ? LOCKED : STEM;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={locked ? "opacity-70" : "animate-pousse-grow"}
    >
      <ellipse cx="50" cy="90" rx="30" ry="6" fill={locked ? "#e6dcc8" : SOIL} opacity="0.8" />
      {shape === "arbre" ? <Tree k={k} s={s} c={c} trunk={a} /> : null}
      {shape === "fleur" ? <Flower k={k} s={s} c={c} center={a} stem={stem} /> : null}
      {shape === "touffe" ? <Tuft k={k} s={s} c={c} tip={a} /> : null}
      {shape === "cactus" ? <Cactus k={k} s={s} c={c} bloom={a} locked={locked} /> : null}
      {shape === "potager" ? <Patch s={s} c={c} carrot={a} locked={locked} /> : null}
      {locked ? (
        <text x="50" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="#a8977a" fontFamily="system-ui">?</text>
      ) : null}
    </svg>
  );
}

function Tree({ k, s, c, trunk }: { k: number; s: number; c: string; trunk: string }) {
  const top = 88 - 56 * k;
  return (
    <g>
      <path d={`M50 88 L50 ${top + 14 * k}`} stroke={trunk} strokeWidth={3 + 4 * k} strokeLinecap="round" />
      {s >= 3 ? <path d={`M50 ${72 - 8 * k} l${-10 * k} ${-10 * k}`} stroke={trunk} strokeWidth={2 + 2 * k} strokeLinecap="round" /> : null}
      <circle cx="50" cy={top} r={20 * k} fill={c} />
      <circle cx={50 - 14 * k} cy={top + 9 * k} r={14 * k} fill={c} />
      <circle cx={50 + 14 * k} cy={top + 9 * k} r={14 * k} fill={c} />
      {s >= 2 ? <circle cx={50 + 4 * k} cy={top - 8 * k} r={12 * k} fill={c} opacity="0.85" /> : null}
      {s >= 4 ? (
        <g fill="#fff" opacity="0.35">
          <circle cx={50 - 8 * k} cy={top - 4 * k} r={3} />
          <circle cx={50 + 12 * k} cy={top + 4 * k} r={2.5} />
        </g>
      ) : null}
    </g>
  );
}

function Flower({ k, s, c, center, stem }: { k: number; s: number; c: string; center: string; stem: string }) {
  const top = 88 - 60 * k;
  const head = (cx: number, cy: number, r: number) => (
    <g>
      {Array.from({ length: 8 }, (_, i) => {
        const ang = (i * Math.PI) / 4;
        return <ellipse key={i} cx={cx + Math.cos(ang) * r} cy={cy + Math.sin(ang) * r} rx={r * 0.7} ry={r * 0.45}
          transform={`rotate(${(i * 45) % 180} ${cx + Math.cos(ang) * r} ${cy + Math.sin(ang) * r})`} fill={c} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.75} fill={center} />
    </g>
  );
  return (
    <g>
      <path d={`M50 88 Q47 ${(88 + top) / 2} 50 ${top}`} stroke={stem} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={`M50 ${80 - 6 * k} q-14 -4 -16 -14 q12 0 16 14Z`} fill={stem} />
      {s >= 3 ? <path d={`M50 ${72 - 10 * k} q14 -4 16 -14 q-12 0 -16 14Z`} fill={stem} /> : null}
      {s === 1 ? <ellipse cx="50" cy={top} rx="5" ry="7" fill={stem} /> : head(50, top, 7 + 5 * k)}
      {s >= 4 ? (
        <>
          <path d="M50 70 Q60 62 66 52" stroke={stem} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          {head(67, 50, 7)}
        </>
      ) : null}
    </g>
  );
}

function Tuft({ k, s, c, tip }: { k: number; s: number; c: string; tip: string }) {
  const n = 3 + 2 * s;
  return (
    <g fill="none" strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        const x = 50 + t * 60 * k;
        const y = 88 - (52 - Math.abs(t) * 30) * k;
        return (
          <g key={i}>
            <path d={`M50 88 Q${50 + t * 20} ${70 - 10 * k} ${x} ${y}`} stroke={c} strokeWidth={3.2} />
            {tip !== c && s >= 2 ? <ellipse cx={x} cy={y - 3} rx="2.6" ry="5" fill={tip} /> : null}
          </g>
        );
      })}
    </g>
  );
}

function Cactus({ k, s, c, bloom, locked }: { k: number; s: number; c: string; bloom: string; locked: boolean }) {
  const h = 58 * k;
  return (
    <g>
      <rect x="41" y={88 - h} width="18" height={h} rx="9" fill={c} />
      {s >= 3 ? <path d={`M41 ${88 - h * 0.5} h-8 v${-h * 0.25}`} stroke={c} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {s >= 2 ? <path d={`M59 ${88 - h * 0.4} h8 v${-h * 0.3}`} stroke={c} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {!locked ? <path d={`M50 ${92 - h} V84`} stroke="#fff" strokeOpacity="0.25" strokeWidth="2" /> : null}
      {s >= 4 ? <circle cx="50" cy={86 - h} r="5" fill={bloom} /> : null}
    </g>
  );
}

function Patch({ s, c, carrot, locked }: { s: number; c: string; carrot: string; locked: boolean }) {
  const n = s + 1;
  return (
    <g>
      <rect x="18" y="80" width="64" height="9" rx="4.5" fill={locked ? LOCKED : "#a8794c"} />
      {Array.from({ length: n }, (_, i) => {
        const x = 26 + (i * 48) / Math.max(1, n - 1 || 1);
        const cx = n === 1 ? 50 : x;
        return i % 2 === 0 ? (
          <g key={i}>
            <circle cx={cx} cy="74" r="7" fill={c} />
            <circle cx={cx - 4} cy="77" r="5" fill={c} opacity="0.85" />
            <circle cx={cx + 4} cy="77" r="5" fill={c} opacity="0.85" />
          </g>
        ) : (
          <g key={i}>
            <path d={`M${cx - 4} 80 L${cx} 92 L${cx + 4} 80Z`} fill={carrot} />
            <path d={`M${cx} 80 l-4 -10 M${cx} 80 l0 -12 M${cx} 80 l4 -10`} stroke={c} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}
