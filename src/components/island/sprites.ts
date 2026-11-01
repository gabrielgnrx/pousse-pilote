/**
 * Les plantes et Tigou dessinés en SVG, vus de trois quarts. Chaque dessin a son pied en (0, 0) et
 * monte vers les y négatifs ; une plante adulte fait environ 80 unités de haut (une case : 68 de large).
 * Couleurs : celles des espèces (lib/game/garden.ts), ombrées ici pour le volume.
 */
import type { PlantLook } from "@/lib/game/island.ts";

/** Hasard reproductible : la même plante garde la même allure d'une visite à l'autre. */
export function rand(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Éclaircit (amount > 0) ou assombrit une couleur. */
export function shade(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, Math.min(1, l + amount)));
}

const STEM = "#5f8f4e";
const LEAF = "#4f7e45";

function sprout(c: string): string {
  return `
    <ellipse cx="0" cy="-1" rx="11" ry="4.5" fill="#7a5532"/>
    <ellipse cx="-2" cy="-2.2" rx="6" ry="2" fill="#94693f"/>
    <path d="M0 -2 C0 -8 0 -12 0 -16" stroke="#4e9a62" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <path d="M0 -14 C-4 -22 -13 -22 -15 -17 C-11 -12 -4 -12 0 -14 Z" fill="${c}"/>
    <path d="M0 -15 C4 -24 14 -24 16 -18 C12 -12 4 -12 0 -15 Z" fill="${shade(c, 0.07)}"/>
    <path d="M-2 -15 C-6 -18 -10 -18 -12 -17" stroke="${shade(c, 0.18)}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
}

function canopy(c: string, big = 1, flat = 1): string {
  const d = shade(c, -0.08);
  const l = shade(c, 0.1);
  const r = (n: number) => n * big;
  const y = (n: number) => n * flat;
  return `
    <circle cx="${r(-16)}" cy="${y(-44)}" r="${r(15)}" fill="${d}"/>
    <circle cx="${r(16)}" cy="${y(-46)}" r="${r(14)}" fill="${d}"/>
    <circle cx="${r(-6)}" cy="${y(-60)}" r="${r(18)}" fill="${c}"/>
    <circle cx="${r(10)}" cy="${y(-58)}" r="${r(16)}" fill="${c}"/>
    <circle cx="0" cy="${y(-48)}" r="${r(17)}" fill="${c}"/>
    <circle cx="${r(-10)}" cy="${y(-64)}" r="${r(7)}" fill="${l}" opacity="0.75"/>
    <circle cx="${r(6)}" cy="${y(-68)}" r="${r(4.5)}" fill="${l}" opacity="0.6"/>`;
}

function tree(look: PlantLook, seed: number): string {
  const c = look.color;
  const t = look.accent;
  switch (look.key) {
    case "sequoia":
      return `
        <path d="M-5 0 L-3.5 -30 L3.5 -30 L5 0 Z" fill="${t}"/>
        <path d="M0 -92 L18 -52 Q0 -46 -18 -52 Z" fill="${shade(c, 0.06)}"/>
        <path d="M0 -76 L22 -36 Q0 -30 -22 -36 Z" fill="${c}"/>
        <path d="M0 -58 L26 -20 Q0 -14 -26 -20 Z" fill="${shade(c, -0.06)}"/>
        <path d="M0 -92 L-6 -78" stroke="${shade(c, 0.18)}" stroke-width="2" stroke-linecap="round"/>`;
    case "baobab":
      return `
        <path d="M-10 0 C-12 -16 -7 -30 -6 -42 L6 -42 C7 -30 12 -16 10 0 Z" fill="${t}"/>
        <path d="M-4 -40 L-14 -52 M4 -40 L14 -54 M0 -42 L0 -56" stroke="${t}" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="0" cy="-58" rx="34" ry="11" fill="${shade(c, -0.07)}"/>
        <ellipse cx="0" cy="-62" rx="30" ry="9" fill="${c}"/>
        <ellipse cx="-10" cy="-65" rx="10" ry="3" fill="${shade(c, 0.12)}" opacity="0.8"/>`;
    case "bonsai":
      return `
        <path d="M-14 0 L-11 -10 L11 -10 L14 0 Z" fill="#b5653a"/>
        <rect x="-15" y="-12" width="30" height="3.5" rx="1.5" fill="#cf7c4c"/>
        <path d="M0 -11 C-6 -18 6 -22 0 -30 C-3 -34 2 -38 4 -40" stroke="${t}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="-8" cy="-30" rx="11" ry="5.5" fill="${shade(c, -0.05)}"/>
        <ellipse cx="7" cy="-41" rx="12" ry="6" fill="${c}"/>
        <ellipse cx="4" cy="-43" rx="5" ry="2" fill="${shade(c, 0.12)}"/>`;
  }
  const weeping = look.key === "nature" || look.key === "saule";
  const olive = look.key === "logement";
  const big = look.key === "chene" ? 1.18 : 1;
  let out = `<path d="M-4.5 0 C-4 -14 -3.5 -24 -3 -36 L3 -36 C3.5 -24 4 -14 4.5 0 Z" fill="${t}"/>
    <path d="M1 -26 C6 -30 9 -32 12 -38" stroke="${t}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  if (look.key === "transport") {
    for (let i = 0; i < 4; i++) {
      const y = -6 - i * 8 - rand(seed + i) * 3;
      const s = rand(seed + i * 3) > 0.5 ? 1 : -1;
      out += `<path d="M${s * 3.8} ${y} l${-s * 3} 1" stroke="#3a3a34" stroke-width="1.4" stroke-linecap="round"/>`;
    }
  }
  if (weeping) {
    const d = shade(c, -0.06);
    out += canopy(c, 1, 0.82);
    for (let i = 0; i < 9; i++) {
      const x = -24 + i * 6;
      const len = 18 + rand(seed + i) * 14;
      out += `<path d="M${x} -40 Q${x - 2} ${-40 + len / 2} ${x + 1} ${-40 + len}" stroke="${i % 2 ? d : c}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    }
    return out;
  }
  out += canopy(olive ? shade(c, 0.02) : c, big, olive ? 0.78 : 1);
  if (olive) {
    for (let i = 0; i < 6; i++) {
      out += `<circle cx="${-18 + rand(seed + i) * 36}" cy="${-38 - rand(seed + i * 7) * 16}" r="2.2" fill="#4a4f2a"/>`;
    }
  }
  return out;
}

function head(x: number, y: number, petals: number, r: number, c: string, center: string): string {
  let out = "";
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * 360;
    out += `<ellipse cx="${x}" cy="${y - r}" rx="${r * 0.5}" ry="${r * 0.85}" fill="${i % 2 ? c : shade(c, 0.05)}" transform="rotate(${a} ${x} ${y})"/>`;
  }
  return `${out}<circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="${center}"/><circle cx="${x - r * 0.2}" cy="${y - r * 0.2}" r="${r * 0.2}" fill="${shade(center, 0.2)}"/>`;
}

function flower(look: PlantLook, seed: number): string {
  const c = look.color;
  const a = look.accent;
  if (look.key === "lotus" || look.key === "nenuphar") {
    let petals = "";
    for (let i = 0; i < 7; i++) {
      const ang = -75 + i * 25;
      petals += `<path d="M0 -6 C-4 -14 -2 -22 0 -26 C2 -22 4 -14 0 -6 Z" fill="${i % 2 ? c : shade(c, -0.04)}" transform="rotate(${ang} 0 -6)"/>`;
    }
    return `
      <ellipse cx="0" cy="-2" rx="30" ry="12" fill="#4f98ad"/>
      <ellipse cx="0" cy="-3" rx="27" ry="10" fill="#6cb4c6"/>
      <path d="M-26 -3 a10 4 0 1 0 14 -2 l-7 1 Z" fill="#4f8f4e"/>
      <path d="M10 2 a11 4.5 0 1 0 15 -4 l-8 2 Z" fill="#5e9e57"/>
      <ellipse cx="2" cy="-4" rx="10" ry="3.5" fill="#4f8f4e"/>
      ${petals}
      <circle cx="0" cy="-10" r="4" fill="${a}"/>`;
  }
  if (look.key === "rosier") {
    let roses = "";
    for (let i = 0; i < 7; i++) {
      const x = -18 + rand(seed + i) * 36;
      const y = -10 - rand(seed + i * 5) * 28;
      roses += `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/><path d="M${x - 2} ${y} a2 2 0 1 1 3 1.5" stroke="${shade(c, -0.15)}" stroke-width="1.2" fill="none"/>`;
    }
    return `
      <ellipse cx="-10" cy="-16" rx="14" ry="13" fill="${shade(a, -0.05)}"/>
      <ellipse cx="11" cy="-18" rx="14" ry="14" fill="${shade(a, -0.05)}"/>
      <ellipse cx="0" cy="-26" rx="17" ry="15" fill="${a}"/>
      ${roses}`;
  }
  const sunflower = look.key === "scan";
  const edel = look.key === "edelweiss";
  const orchid = look.key === "orchidee";
  const poppy = look.key === "bravo";
  let out = "";
  if (edel) out += `<ellipse cx="0" cy="-3" rx="16" ry="6" fill="#9aa89a"/><ellipse cx="-4" cy="-5" rx="8" ry="3" fill="#b4c0b2"/>`;
  if (orchid) out += `<path d="M-11 0 L-9 -12 L9 -12 L11 0 Z" fill="#e9e3d6"/><rect x="-12" y="-14" width="24" height="3" rx="1.5" fill="#f4efe4"/>`;
  const stems = sunflower ? 2 : 3;
  for (let i = 0; i < stems; i++) {
    const x = (i - (stems - 1) / 2) * (sunflower ? 16 : 13) + (rand(seed + i) - 0.5) * 4;
    const h = (sunflower ? 70 : edel ? 18 : orchid ? 40 : 38) * (0.85 + rand(seed + i * 3) * 0.3);
    const base = orchid ? -12 : 0;
    const top = base - h;
    const bend = (rand(seed + i * 9) - 0.5) * 10;
    out += `<path d="M${x * 0.4} ${base} Q${x + bend} ${base - h * 0.5} ${x} ${top}" stroke="${STEM}" stroke-width="${sunflower ? 3.2 : 2.2}" fill="none" stroke-linecap="round"/>`;
    if (!edel) {
      const ly = base - h * 0.4;
      out += `<path d="M${x * 0.7} ${ly} c${6} -6 ${12} -4 ${14} -1 c-5 3 -10 4 -14 1 Z" fill="${LEAF}"/>`;
    }
    if (sunflower) out += head(x, top, 14, 10, c, a);
    else if (poppy) {
      out += `<path d="M${x - 8} ${top} C${x - 10} ${top - 10} ${x - 2} ${top - 13} ${x} ${top - 8} C${x + 2} ${top - 13} ${x + 10} ${top - 10} ${x + 8} ${top} C${x + 6} ${top + 5} ${x - 6} ${top + 5} ${x - 8} ${top} Z" fill="${c}"/><circle cx="${x}" cy="${top - 2}" r="2.6" fill="${a}"/>`;
    } else out += head(x, top, edel ? 6 : 6, edel ? 5 : 6, c, a);
  }
  return out;
}

function tuft(look: PlantLook, seed: number): string {
  const c = look.color;
  if (look.key === "quiz") {
    let out = `<ellipse cx="0" cy="-4" rx="17" ry="7" fill="#7d9a7a"/><ellipse cx="-4" cy="-6" rx="9" ry="3" fill="#94ad90"/>`;
    for (let i = 0; i < 9; i++) {
      const x = -14 + i * 3.5;
      const h = 30 + rand(seed + i) * 14;
      const lean = (x / 14) * 7;
      out += `<path d="M${x * 0.5} -4 Q${x} ${-h / 2} ${x + lean} ${-h}" stroke="#7d9a7a" stroke-width="1.6" fill="none"/>`;
      out += `<ellipse cx="${x + lean}" cy="${-h - 5}" rx="2.8" ry="7" fill="${i % 3 ? c : shade(c, 0.1)}" transform="rotate(${lean * 2} ${x + lean} ${-h - 5})"/>`;
    }
    return out;
  }
  let out = "";
  for (let i = 0; i < 9; i++) {
    const ang = -80 + i * 20 + (rand(seed + i) - 0.5) * 8;
    const len = 30 + rand(seed + i * 7) * 12;
    const col = i % 2 ? c : shade(c, 0.07);
    out += `<g transform="rotate(${ang})">
      <path d="M0 0 C-6 ${-len * 0.4} -4 ${-len * 0.8} 0 ${-len} C4 ${-len * 0.8} 6 ${-len * 0.4} 0 0 Z" fill="${col}"/>
      <path d="M0 -2 L0 ${-len + 3}" stroke="${shade(c, -0.12)}" stroke-width="1" />
    </g>`;
  }
  return out;
}

function cactus(look: PlantLook): string {
  const c = look.color;
  const d = shade(c, -0.08);
  return `
    <ellipse cx="0" cy="-1" rx="15" ry="5" fill="#d8c49a"/>
    <path d="M-9 -24 C-17 -24 -18 -30 -18 -40 C-18 -46 -12 -46 -12 -40 L-12 -32" stroke="${d}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M9 -32 C17 -32 18 -38 18 -48 C18 -54 12 -54 12 -48 L12 -40" stroke="${d}" stroke-width="7" fill="none" stroke-linecap="round"/>
    <rect x="-10" y="-58" width="20" height="58" rx="10" fill="${c}"/>
    <path d="M-4 -52 L-4 -4 M4 -52 L4 -4" stroke="${shade(c, 0.1)}" stroke-width="1.3" opacity="0.8"/>
    ${head(0, -60, 5, 4.2, look.accent, "#f2c14e")}`;
}

function potager(look: PlantLook, seed: number): string {
  const c = look.color;
  const a = look.accent;
  let veg = "";
  const spots: [number, number][] = [
    [-14, -12],
    [0, -18],
    [14, -12],
    [-6, -6],
    [8, -6],
  ];
  spots.forEach(([sx, sy], i) => {
    const x = sx + (rand(seed + i) - 0.5) * 3;
    const y = sy;
    if (i % 2) veg += `<circle cx="${x}" cy="${y}" r="5" fill="${a}"/><path d="M${x} ${y - 5} l1 -3" stroke="${STEM}" stroke-width="1.6" stroke-linecap="round"/>`;
    else
      veg += `<circle cx="${x - 3}" cy="${y - 3}" r="4.5" fill="${c}"/><circle cx="${x + 3}" cy="${y - 3}" r="4.5" fill="${shade(c, 0.06)}"/><circle cx="${x}" cy="${y - 7}" r="4" fill="${shade(c, 0.1)}"/>`;
  });
  return `
    <path d="M-30 -10 L0 -26 L30 -10 L30 -2 L0 14 L-30 -2 Z" fill="#8a6438"/>
    <path d="M-30 -2 L0 14 L0 6 L-30 -10 Z" fill="#7a5530"/>
    <path d="M30 -2 L0 14 L0 6 L30 -10 Z" fill="#6b4a2a"/>
    <path d="M-25 -10 L0 -23 L25 -10 L0 3 Z" fill="#5a3e22"/>
    ${veg}`;
}

/** Le dessin d'une plante au stade voulu (stades 0 et 1 : la pousse). */
export function plantSvg(look: PlantLook, seed: number): string {
  if (look.stage <= 1) return sprout(look.color);
  switch (look.shape) {
    case "arbre":
      return tree(look, seed);
    case "fleur":
      return flower(look, seed);
    case "touffe":
      return tuft(look, seed);
    case "cactus":
      return cactus(look);
    case "potager":
      return potager(look, seed);
  }
}

/** Taille d'une plante selon son stade (la pousse a son propre dessin, à taille réelle). */
export function stageScale(stage: number): number {
  return [0.8, 1, 0.58, 0.8, 1][Math.max(0, Math.min(4, stage))] ?? 1;
}

/** Tigou, la mascotte : les classes animent la respiration, le clignement et la feuille. */
export const TIGOU_SVG = `
  <ellipse cx="0" cy="0" rx="13" ry="4" fill="#14261b" opacity="0.18"/>
  <g class="pi-bob">
    <ellipse cx="-6" cy="-2" rx="5" ry="3" fill="#3d7a4e"/>
    <ellipse cx="6" cy="-2" rx="5" ry="3" fill="#3d7a4e"/>
    <ellipse cx="0" cy="-17" rx="13" ry="15" fill="#4e9a62"/>
    <ellipse cx="0" cy="-13" rx="8" ry="9" fill="#8fcf9a"/>
    <ellipse cx="-9" cy="-14" rx="2.6" ry="1.6" fill="#e98aa0" opacity="0.8"/>
    <ellipse cx="9" cy="-14" rx="2.6" ry="1.6" fill="#e98aa0" opacity="0.8"/>
    <g class="pi-blink">
      <ellipse cx="-4.5" cy="-20" rx="2.2" ry="2.8" fill="#14261b"/>
      <ellipse cx="4.5" cy="-20" rx="2.2" ry="2.8" fill="#14261b"/>
      <circle cx="-3.8" cy="-21" r="0.8" fill="#fff"/>
      <circle cx="5.2" cy="-21" r="0.8" fill="#fff"/>
    </g>
    <path d="M-2.5 -15.5 Q0 -13.5 2.5 -15.5" stroke="#14261b" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <g class="pi-leaf">
      <path d="M0 -31 L0 -37" stroke="#2e7a4c" stroke-width="2" stroke-linecap="round"/>
      <path d="M0 -36 C-3 -43 -11 -44 -13 -40 C-9 -35 -4 -35 0 -36 Z" fill="#2e7a4c"/>
      <path d="M0 -37 C3 -45 12 -46 14 -41 C10 -36 4 -36 0 -37 Z" fill="#7bc08a"/>
    </g>
  </g>`;
