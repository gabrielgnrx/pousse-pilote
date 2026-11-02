/**
 * Le dessin de l'écosystème, posé par scene.ts sur l'île : quatre zones qui passent de la terre sèche à
 * l'herbe selon leur santé (fissures, souches, ruisseau à sec, déchets sur la plage, voile gris), les
 * animaux revenus, et les étiquettes des zones en mode plantation. Les règles sont dans
 * lib/game/ecosystem.ts.
 */
import { ISLAND_TILES, ZONES, ZONE_BOUNDS, zoneOfTile, type IslandPlant, type Zone } from "@/lib/game/island.ts";
import { animalsOn, zoneStates, type AnimalKey } from "@/lib/game/ecosystem.ts";
import { rand } from "./sprites.ts";

const NS = "http://www.w3.org/2000/svg";
const TW = 34;
const TH = 19;
const project = (x: number, z: number) => ({ sx: (x - z) * TW, sy: (x + z) * TH });

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

export const ECOSYSTEM_CSS = `
.pi-buzz { animation: pi-buzz var(--d, 1.6s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
.pi-glide { animation: pi-glide 9s ease-in-out infinite alternate; }
.pi-flap { transform-box: fill-box; transform-origin: center; animation: pi-flap 0.5s ease-in-out infinite; }
.pi-hop { animation: pi-hop 3.2s ease-in-out infinite; animation-delay: var(--delay, 0s); }
.pi-flutter { transform-box: fill-box; transform-origin: center; animation: pi-flutter 0.35s ease-in-out infinite; }
.pi-wander { animation: pi-wander 7s ease-in-out infinite alternate; }
.pi-wiggle { transform-box: fill-box; transform-origin: center; animation: pi-wiggle 1.4s ease-in-out infinite; }
.pi-zone { transition: opacity 1.2s ease; }
.pi-arrive { animation: pi-arrive 0.9s cubic-bezier(.2,.9,.3,1.3) both; }
@keyframes pi-buzz { 0%, 100% { transform: translate(0, 0); } 25% { transform: translate(9px, -6px); } 50% { transform: translate(2px, -11px); } 75% { transform: translate(-8px, -4px); } }
@keyframes pi-glide { from { transform: translate(-26px, 4px); } to { transform: translate(26px, -6px); } }
@keyframes pi-flap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.35); } }
@keyframes pi-hop { 0%, 80%, 100% { transform: translate(0, 0); } 88% { transform: translate(3px, -12px); } 94% { transform: translate(6px, 0); } }
@keyframes pi-flutter { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.3); } }
@keyframes pi-wander { from { transform: translate(-8px, 0); } to { transform: translate(8px, 2px); } }
@keyframes pi-wiggle { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.75) translateY(-1px); } }
@keyframes pi-arrive { from { opacity: 0; transform: translateY(-30px) scale(0.4); } to { opacity: 1; transform: none; } }
`;

const BEE = `<g><ellipse cx="-3" cy="-6" rx="5" ry="3.5" fill="#ffffff" opacity="0.85" transform="rotate(-25 -3 -6)" class="pi-flap"/><ellipse cx="3" cy="-6" rx="5" ry="3.5" fill="#ffffff" opacity="0.85" transform="rotate(25 3 -6)" class="pi-flap"/><ellipse rx="7" ry="5" fill="#f2c14e"/><path d="M-2 -4.5 v9 M2.5 -4.5 v9" stroke="#14261b" stroke-width="1.8"/><circle cx="6.5" cy="-1" r="2.6" fill="#14261b"/></g>`;
const BIRD = (c: string) => `<path d="M-12 0 Q-6 -8 0 -1 Q6 -8 12 0 Q6 -4 0 2 Q-6 -4 -12 0 Z" fill="${c}" class="pi-flap"/>`;
const BUTTERFLY = (a: string, b: string) => `<g class="pi-flutter"><ellipse cx="-4" cy="-3" rx="4.5" ry="5.5" fill="${a}"/><ellipse cx="4" cy="-3" rx="4.5" ry="5.5" fill="${b}"/></g><rect x="-0.8" y="-8" width="1.6" height="10" rx="0.8" fill="#14261b"/>`;

/** Le dessin de chaque animal, pied (ou centre de vol) en (0, 0). */
export const ANIMAL_ART: Record<AnimalKey, string> = {
  abeilles: `<g class="pi-buzz" style="--d:1.7s">${BEE}</g><g transform="translate(16 8) scale(0.85)"><g class="pi-buzz" style="--d:1.4s;--delay:-0.5s">${BEE}</g></g><g transform="translate(-14 10) scale(0.75)"><g class="pi-buzz" style="--d:1.9s;--delay:-1s">${BEE}</g></g>`,
  oiseaux: `<g class="pi-glide"><g transform="translate(0 -110)">${BIRD("#3a4a5e")}</g><g transform="translate(-24 -98) scale(0.8)">${BIRD("#3a4a5e")}</g><g transform="translate(22 -96) scale(0.85)">${BIRD("#4a5a6e")}</g></g>`,
  grenouilles: `<g transform="translate(10 6)" class="pi-hop"><ellipse rx="9" ry="6" fill="#5e9e3c"/><circle cx="-4" cy="-6" r="3.4" fill="#5e9e3c"/><circle cx="4" cy="-6" r="3.4" fill="#5e9e3c"/><circle cx="-4" cy="-6.5" r="1.6" fill="#14261b"/><circle cx="4" cy="-6.5" r="1.6" fill="#14261b"/><path d="M-3 0 q3 2 6 0" stroke="#2f5a20" stroke-width="1.2" fill="none"/></g>`,
  herisson: `<g transform="translate(20 8)" class="pi-wander"><path d="M-14 0 Q-14 -14 0 -15 Q12 -14 13 -3 L16 0 Z" fill="#8a6a4a"/><path d="M-12 -4 l-4 -4 M-8 -10 l-3 -5 M-2 -13 l0 -5 M4 -12 l3 -5 M9 -8 l4 -4" stroke="#5a4330" stroke-width="2" stroke-linecap="round"/><path d="M8 0 Q13 -6 17 -1 Z" fill="#e8d2b4"/><circle cx="17" cy="-1" r="1.5" fill="#14261b"/></g>`,
  papillons: `<g transform="translate(-10 -46)"><g class="pi-buzz" style="--d:3s">${BUTTERFLY("#e98a6a", "#f2a98a")}</g></g><g transform="translate(18 -34)"><g class="pi-buzz" style="--d:3.6s;--delay:-1.2s">${BUTTERFLY("#8fb6e8", "#b8d2f2")}</g></g>`,
  ecureuil: `<g transform="translate(-9 -14)" class="pi-hop" style="--delay:-1.5s"><path d="M6 0 C14 -4 16 -16 8 -20 C4 -14 6 -6 2 -2 Z" fill="#c9763c"/><ellipse cx="0" cy="-5" rx="5" ry="6" fill="#d9844a"/><circle cx="-2" cy="-12" r="4" fill="#d9844a"/><circle cx="-3.5" cy="-13" r="1" fill="#14261b"/><path d="M-1 -16 l1 -3 l1.5 3" fill="#d9844a"/></g>`,
  martin_pecheur: `<g class="pi-hop" style="--delay:-0.8s"><ellipse rx="7" ry="5" fill="#2f8fc0"/><circle cx="5" cy="-4" r="4" fill="#2f8fc0"/><ellipse cx="2" cy="2" rx="5" ry="2.6" fill="#e98a3a"/><path d="M8 -4 l8 1 l-8 1.5 Z" fill="#14261b"/><circle cx="6" cy="-5" r="1" fill="#fff"/></g>`,
  tortue: `<g class="pi-wander"><ellipse rx="12" ry="7" fill="#6b8f4e"/><path d="M-8 -2 h16 M-4 -6 v8 M4 -6 v8" stroke="#4f6e3a" stroke-width="1.2"/><circle cx="14" cy="0" r="3.6" fill="#8fb06e"/><circle cx="15" cy="-1" r="0.9" fill="#14261b"/></g>`,
  coccinelles: `<g transform="translate(-8 -14)"><g class="pi-wander"><circle r="3" fill="#d9432f"/><path d="M0 -3 v6" stroke="#14261b" stroke-width="0.8"/><circle cx="-1.3" cy="-0.5" r="0.7" fill="#14261b"/><circle cx="1.3" cy="1" r="0.7" fill="#14261b"/></g></g><g transform="translate(9 -18)"><circle r="2.6" fill="#d9432f"/><circle cx="-1" cy="0" r="0.6" fill="#14261b"/></g>`,
  lezard: `<g transform="translate(16 6)" class="pi-wander"><path d="M-16 2 C-10 -2 -4 3 2 0 C6 -2 10 -2 13 0 C10 2 6 2 2 1.5 C-4 4 -10 0 -16 2 Z" fill="#7aa64a"/><circle cx="11" cy="-0.5" r="0.8" fill="#14261b"/></g>`,
  chouette: `<g transform="translate(0 -52)"><ellipse rx="8" ry="10" fill="#9a7a5a"/><ellipse cy="3" rx="5" ry="6" fill="#d8c4a4"/><circle cx="-3.2" cy="-4" r="3.2" fill="#f4efe4"/><circle cx="3.2" cy="-4" r="3.2" fill="#f4efe4"/><g class="pi-blink"><circle cx="-3.2" cy="-4" r="1.6" fill="#14261b"/><circle cx="3.2" cy="-4" r="1.6" fill="#14261b"/></g><path d="M-1 -1 L0 1 L1 -1 Z" fill="#e8a33a"/><path d="M-7 -9 l-1 -4 l4 2 M7 -9 l1 -4 l-4 2" fill="#9a7a5a"/></g>`,
  ver_de_terre: `<path class="pi-wiggle" d="M-8 0 q2 -4 4 0 q2 4 4 0 q2 -4 4 0" stroke="#e8939a" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  geai: `<g transform="translate(-6 -58)" class="pi-hop" style="--delay:-0.6s"><ellipse rx="8" ry="5.5" fill="#c9a48a"/><circle cx="6" cy="-4" r="4.2" fill="#d8b49a"/><path d="M-3 -3 h7 v3 h-7 Z" fill="#3f7fc8"/><path d="M-3 -1.5 h1.5 M0 -1.5 h1.5" stroke="#14261b" stroke-width="0.8"/><path d="M-8 1 l-7 -2 l1 4 Z" fill="#14261b"/><path d="M10 -4 l4 1 l-4 1 Z" fill="#14261b"/><circle cx="7" cy="-5" r="0.9" fill="#14261b"/></g>`,
  mesanges: `<g transform="translate(-10 -52)" class="pi-hop" style="--delay:-0.3s"><ellipse rx="5.5" ry="4.5" fill="#f2d04a"/><circle cx="4" cy="-3" r="3.4" fill="#14261b"/><circle cx="4.6" cy="-3.2" r="1.6" fill="#ffffff"/><path d="M-4 -2 q3 -3 6 0" fill="#6f9ab8"/><path d="M7 -3 l2.5 0.6 l-2.5 0.6 Z" fill="#14261b"/></g><g transform="translate(12 -40) scale(0.85)" class="pi-hop" style="--delay:-1.7s"><ellipse rx="5.5" ry="4.5" fill="#f2d04a"/><circle cx="4" cy="-3" r="3.4" fill="#14261b"/><circle cx="4.6" cy="-3.2" r="1.6" fill="#ffffff"/></g>`,
  gravelot: `<g transform="translate(14 8)" class="pi-wander"><ellipse rx="7" ry="4.5" fill="#d8c4a4"/><ellipse cy="2" rx="5" ry="2.4" fill="#f7f3ea"/><circle cx="5.5" cy="-3.5" r="3.2" fill="#d8c4a4"/><path d="M3 -2 h5" stroke="#14261b" stroke-width="1.2"/><path d="M8.5 -3.5 l2.5 0.5 l-2.5 0.6 Z" fill="#14261b"/><path d="M-1 4 v4 M2 4 v4" stroke="#e8a33a" stroke-width="1"/></g>`,
  libellules: `<g transform="translate(-8 -30)"><g class="pi-buzz" style="--d:2.6s"><rect x="-1" y="-1" width="13" height="2.2" rx="1.1" fill="#2f8fc0"/><g class="pi-flutter"><ellipse cx="2" cy="-4" rx="2.4" ry="5" fill="#cfe8f4" opacity="0.85"/><ellipse cx="5" cy="-4" rx="2.4" ry="5" fill="#cfe8f4" opacity="0.85"/></g></g></g><g transform="translate(14 -22) scale(0.8)"><g class="pi-buzz" style="--d:2.2s;--delay:-0.9s"><rect x="-1" y="-1" width="13" height="2.2" rx="1.1" fill="#d9432f"/><g class="pi-flutter"><ellipse cx="3" cy="-4" rx="2.4" ry="5" fill="#f4e0dc" opacity="0.85"/></g></g></g>`,
  pic_vert: `<g transform="translate(-4 -40)"><g class="pi-hop" style="--delay:-1.1s"><ellipse rx="5" ry="9" fill="#6f9a3e"/><ellipse cx="0" cy="3" rx="3.5" ry="5" fill="#c8d48a"/><circle cx="1" cy="-9" r="4" fill="#6f9a3e"/><path d="M-2 -13 q3 -3 6 0" fill="#d9432f"/><path d="M4 -9 l7 0.5 l-7 1.5 Z" fill="#4a4a3a"/><circle cx="2" cy="-10" r="0.9" fill="#ffffff"/></g></g>`,
  loir: `<g transform="translate(16 -36)" class="pi-hop" style="--delay:-2s"><path d="M-6 0 C-16 -2 -18 8 -10 10" stroke="#9aa0a0" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse rx="7" ry="5.5" fill="#a8acac"/><circle cx="6" cy="-3" r="4" fill="#a8acac"/><circle cx="7.5" cy="-3.5" r="1.4" fill="#14261b"/><circle cx="4" cy="-7" r="1.8" fill="#c8cccc"/><ellipse cx="2" cy="2" rx="4" ry="2.2" fill="#e8e6df"/></g>`,
  huppe: `<g transform="translate(14 6)" class="pi-wander"><ellipse rx="7" ry="5" fill="#e0a070"/><path d="M-6 -1 l-6 3 l6 2 Z M-3 -4 h8" stroke="#14261b" stroke-width="1.2" fill="#ffffff"/><circle cx="6" cy="-4" r="3.6" fill="#e0a070"/><path d="M3 -6 l-1 -7 l3 4 l1 -6 l2 6 l2 -4 l0 6" fill="#e8a060" stroke="#14261b" stroke-width="0.6"/><path d="M9 -4 q5 1 7 4" stroke="#14261b" stroke-width="1.2" fill="none"/><circle cx="7" cy="-5" r="0.8" fill="#14261b"/></g>`,
  heron: `<g transform="translate(10 4)"><g class="pi-hop" style="--delay:-2.5s"><path d="M-2 0 v-10 M2 0 v-10" stroke="#6a6a5a" stroke-width="1.2"/><ellipse cy="-14" rx="7" ry="5" fill="#a8b0b8"/><path d="M4 -16 q2 -10 6 -12" stroke="#c8ccd0" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="10" cy="-28" r="2.6" fill="#e8eaec"/><path d="M8 -29 h3" stroke="#14261b" stroke-width="1"/><path d="M12 -28 l7 1 l-7 1 Z" fill="#e8a33a"/></g></g>`,
  rouge_gorge: `<g transform="translate(8 2)" class="pi-hop" style="--delay:-0.4s"><ellipse rx="6" ry="5" fill="#8a6a4a"/><ellipse cx="3" cy="0" rx="3.5" ry="3.5" fill="#e8743a"/><circle cx="4" cy="-4" r="3.4" fill="#8a6a4a"/><circle cx="4" cy="-3" r="2" fill="#e8743a"/><circle cx="5" cy="-5" r="0.8" fill="#14261b"/><path d="M7 -4 l2.2 0.5 l-2.2 0.6 Z" fill="#14261b"/></g>`,
  chardonneret: `<g transform="translate(-6 -30)" class="pi-hop" style="--delay:-1.3s"><ellipse rx="6" ry="4.5" fill="#d8b48a"/><path d="M-4 -1 h7" stroke="#f2c230" stroke-width="2"/><circle cx="5" cy="-3" r="3.4" fill="#f4efe4"/><path d="M5 -6.4 a3.4 3.4 0 0 1 3 2 l-2 1 Z" fill="#d9432f"/><circle cx="5.5" cy="-3.5" r="0.8" fill="#14261b"/><path d="M8 -3 l2.5 0.6 l-2.5 0.6 Z" fill="#e8d2b4"/></g>`,
  cigogne: `<g transform="translate(-10 0)"><g class="pi-hop" style="--delay:-1.8s"><path d="M-2 0 v-12 M2 0 v-12" stroke="#d9432f" stroke-width="1.4"/><ellipse cy="-17" rx="8" ry="6" fill="#f4f1e8"/><path d="M-8 -16 q6 6 12 2" fill="#14261b"/><path d="M5 -20 q1 -8 3 -10" stroke="#f4f1e8" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="8" cy="-30" r="3" fill="#f4f1e8"/><path d="M10 -30 l9 2 l-9 1 Z" fill="#d9432f"/><circle cx="8.5" cy="-31" r="0.8" fill="#14261b"/></g></g>`,
  grue: `<g class="pi-glide"><g transform="translate(0 -120)">${BIRD("#8a9298")}</g><g transform="translate(-22 -108) scale(0.85)">${BIRD("#8a9298")}</g><g transform="translate(22 -108) scale(0.85)">${BIRD("#8a9298")}</g><g transform="translate(-42 -96) scale(0.7)">${BIRD("#9aa2a8")}</g><g transform="translate(42 -96) scale(0.7)">${BIRD("#9aa2a8")}</g></g>`,
  hirondelles: `<g class="pi-glide"><g transform="translate(-12 -90) scale(0.8)"><path d="M-12 0 L0 -3 L12 0 L4 1 L8 7 L0 2 L-8 7 L-4 1 Z" fill="#1f2f4e" class="pi-flap"/></g><g transform="translate(16 -80) scale(0.7)"><path d="M-12 0 L0 -3 L12 0 L4 1 L8 7 L0 2 L-8 7 L-4 1 Z" fill="#1f2f4e" class="pi-flap"/></g></g>`,
  oies: `<g transform="translate(6 6)" class="pi-wander"><ellipse rx="9" ry="6" fill="#9a9a8a"/><path d="M5 -3 q2 -8 5 -9" stroke="#8a8a7a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="10" cy="-12" r="3" fill="#8a8a7a"/><path d="M12 -12 l5 1 l-5 1.2 Z" fill="#e8a33a"/><circle cx="10.5" cy="-12.6" r="0.8" fill="#14261b"/></g><g transform="translate(-14 10) scale(0.85)" class="pi-wander"><ellipse rx="9" ry="6" fill="#a8a898"/><circle cx="10" cy="-10" r="3" fill="#8a8a7a"/><path d="M5 -3 q2 -6 5 -7" stroke="#8a8a7a" stroke-width="3" fill="none"/></g>`,
};

/** Un point (en coordonnées d'écran) dans une zone, à r unités du centre et à la fraction t de son arc. */
const ARCS: Record<Zone, [number, number]> = {
  foret: [ZONE_BOUNDS[0], ZONE_BOUNDS[1]],
  ruisseau: [ZONE_BOUNDS[1], ZONE_BOUNDS[2]],
  plage: [ZONE_BOUNDS[2], ZONE_BOUNDS[3]],
  potager: [ZONE_BOUNDS[3], ZONE_BOUNDS[0] + 360],
};

function zonePoint(zone: Zone, t: number, r: number): { x: number; y: number } {
  const [a0, a1] = ARCS[zone];
  const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.56 };
}

function wedge(zone: Zone): string {
  const p0 = zonePoint(zone, 0, 400);
  const p1 = zonePoint(zone, 1, 400);
  return `M0 0 L${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A400 224 0 0 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Z`;
}

const STREAM = "M95 -62 C120 -40 120 -15 150 -5 S185 20 205 35";
const DRY = "#c7b285";

export interface EcosystemLayer {
  update(plants: IslandPlant[], guests?: readonly string[]): void;
  showLabels(visible: boolean): void;
}

/**
 * ground : sous les plantes (sol des zones, ruisseau, souches, déchets) ; animals : au-dessus des
 * plantes ; labels : étiquettes des zones ; haze : voile gris quand l'île est abîmée.
 */
export function createEcosystemLayer(parts: { ground: SVGGElement; animals: SVGGElement; labels: SVGGElement; haze: SVGRectElement; clipPath: string }): EcosystemLayer {
  const { ground, animals, labels, haze } = parts;
  const defs = el("defs", {}, ground);
  el("clipPath", { id: "pi-ile-clip" }, defs).appendChild(el("path", { d: parts.clipPath, transform: "translate(0 2)" }));

  const zoneLayers = new Map<Zone, { soil: SVGPathElement; cracks: SVGGElement }>();
  const clipped = el("g", { "clip-path": "url(#pi-ile-clip)" }, ground);
  for (const z of ZONES) {
    const soil = el("path", { d: wedge(z.key), fill: DRY, class: "pi-zone" }, clipped);
    const cracks = el("g", { class: "pi-zone" }, clipped);
    for (let i = 0; i < 8; i++) {
      const { x, y } = zonePoint(z.key, 0.12 + rand(i + z.key.length * 7) * 0.76, 45 + rand(i * 3 + z.key.length) * 120);
      el("path", { d: `M${x.toFixed(1)} ${y.toFixed(1)} l7 3 l4 -4 l8 2`, stroke: "#9c8660", "stroke-width": 1.3, fill: "none", "stroke-linecap": "round" }, cracks);
    }
    zoneLayers.set(z.key, { soil, cracks });
  }

  const streamBed = el("path", { d: STREAM, stroke: "#b49e74", "stroke-width": 12, fill: "none", "stroke-linecap": "round" }, ground);
  const streamDry = el("path", { d: STREAM, stroke: "#d6c49c", "stroke-width": 6, fill: "none", "stroke-linecap": "round", "stroke-dasharray": "2 7" }, ground);
  const streamWater = el("path", { d: STREAM, stroke: "#6cb4c6", "stroke-width": 8, fill: "none", "stroke-linecap": "round", class: "pi-zone" }, ground);
  const streamShine = el("path", { d: STREAM, stroke: "#ffffff", "stroke-width": 1.6, fill: "none", "stroke-dasharray": "6 22", "stroke-linecap": "round", class: "pi-zone" }, ground);

  const stumpsG = el("g", {}, ground);
  const trashG = el("g", {}, ground);
  for (let i = 0; i < 9; i++) {
    const a = ((40 + rand(i + 5) * 100) * Math.PI) / 180;
    const x = Math.cos(a) * 188;
    const y = Math.sin(a) * 108 + 18;
    const rot = rand(i * 3 + 5) * 90 - 45;
    el(
      "g",
      { "data-i": i, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})` },
      trashG,
    ).innerHTML =
      i % 2
        ? `<rect x="-5" y="-2" width="11" height="4" rx="2" fill="#7ab0c8"/><rect x="6" y="-1" width="3" height="2" fill="#2f6f8a"/>`
        : `<path d="M-6 0 q2 -8 6 -6 q5 -3 6 4 q-6 4 -12 2 Z" fill="#e8e6df" stroke="#c7c3b8" stroke-width="0.8"/>`;
  }

  const labelNodes = new Map<Zone, SVGTextElement>();
  for (const z of ZONES) {
    const tiles = ISLAND_TILES.filter((t) => zoneOfTile(t.x, t.z) === z.key).map((t) => project(t.x, t.z));
    const cx = tiles.reduce((n, t) => n + t.sx, 0) / tiles.length;
    const cy = tiles.reduce((n, t) => n + t.sy, 0) / tiles.length;
    const g = el("g", { transform: `translate(${cx.toFixed(1)} ${(cy - 36).toFixed(1)})` }, labels);
    el("rect", { x: -44, y: -12, width: 88, height: 22, rx: 11, fill: "#ffffff", opacity: 0.94 }, g);
    const text = el("text", { x: 0, y: 4, "text-anchor": "middle", "font-size": 11, "font-weight": 700, fill: "#14261b", "font-family": "Figtree, system-ui, sans-serif" }, g);
    labelNodes.set(z.key, text);
  }
  labels.style.display = "none";

  let shown = new Set<AnimalKey>();
  let first = true;

  return {
    update(plants, guests = []) {
      const states = zoneStates(plants);
      let total = 0;
      for (const s of states) {
        total += s.health;
        const layer = zoneLayers.get(s.key);
        layer?.soil.setAttribute("opacity", String(Math.max(0, 1 - s.health * 1.15)));
        layer?.cracks.setAttribute("opacity", String(Math.max(0, 0.9 - s.health * 1.4)));
        labelNodes.get(s.key)!.textContent = `${s.name} · ${Math.round(s.health * 100)} %`;
        if (s.key === "ruisseau") {
          const wet = s.health >= 0.25;
          streamWater.setAttribute("opacity", wet ? String(Math.min(1, 0.4 + s.health)) : "0");
          streamWater.setAttribute("stroke-width", String(5 + s.health * 6));
          streamShine.setAttribute("opacity", wet ? "0.8" : "0");
          streamDry.setAttribute("opacity", wet ? "0" : "1");
          streamBed.setAttribute("stroke", wet ? "#4f98ad" : "#b49e74");
        }
        if (s.key === "plage") {
          const left = Math.round((1 - s.health) * 9);
          for (const g of Array.from(trashG.children)) (g as SVGGElement).style.display = Number(g.getAttribute("data-i")) < left ? "" : "none";
        }
        if (s.key === "foret") {
          stumpsG.replaceChildren();
          if (s.health < 0.35) {
            for (const [x, z] of [[-2, -1], [-1, -2], [-2, 0]] as const) {
              if (plants.some((p) => p.x === x && p.z === z)) continue;
              const { sx, sy } = project(x, z);
              el("g", { transform: `translate(${sx} ${sy})` }, stumpsG).innerHTML =
                `<ellipse rx="9" ry="3.5" fill="#6b4a2b"/><rect x="-7" y="-9" width="14" height="9" fill="#8a6a4a"/><ellipse cy="-9" rx="7" ry="3" fill="#c6a77a"/>`;
            }
          }
        }
      }
      haze.setAttribute("opacity", String(((4 - total) / 4) * 0.2));

      const present = animalsOn(plants, guests);
      const next = new Set(present.map((a) => a.animal.key));
      animals.replaceChildren();
      for (const { animal, at } of present) {
        const { sx, sy } = project(at.x, at.z);
        const g = el("g", { transform: `translate(${sx.toFixed(1)} ${sy.toFixed(1)})` }, animals);
        const inner = el("g", { class: !first && !shown.has(animal.key) ? "pi-arrive" : "" }, g);
        inner.innerHTML = ANIMAL_ART[animal.key];
      }
      shown = next;
      first = false;
    },
    showLabels(visible) {
      labels.style.display = visible ? "" : "none";
    },
  };
}
