/**
 * La scène de l'île en 2D (SVG animé, sans bibliothèque) : une île illustrée vue de trois quarts sur la
 * mer, le ciel selon l'heure de Paris, le vent dans les plantes, Tigou, et de petites fêtes quand une
 * graine pousse. Le composant IslandProvider la pilote par l'interface IslandScene.
 */
import { ISLAND_TILES, checkTile, lookOf, type IslandPlant, type Seed } from "@/lib/game/island.ts";
import { TIGOU_SVG, plantSvg, rand, shade, stageScale } from "./sprites.ts";

export interface IslandSceneEvents {
  /** Une case touchée (vide ou avec une plante). */
  onTileTap: (x: number, z: number) => void;
  /** Ni plante ni case : un toucher dans le vide. */
  onEmptyTap: () => void;
}

export interface IslandScene {
  setPlants(plants: IslandPlant[]): void;
  setPlanting(seed: Pick<Seed, "key" | "rare"> | null): void;
  setSelected(tile: { x: number; z: number } | null): void;
  celebrate(x: number, z: number, kind: "nouvelle" | "grandit" | "stade"): void;
  /** En pause, les animations s'arrêtent (une rubrique est ouverte par-dessus). */
  setPaused(paused: boolean): void;
  dispose(): void;
}

const NS = "http://www.w3.org/2000/svg";
/** Demi-largeur et demi-hauteur d'une case en losange. */
const TW = 34;
const TH = 19;

export function project(x: number, z: number): { sx: number; sy: number } {
  return { sx: (x - z) * TW, sy: (x + z) * TH };
}

function unproject(sx: number, sy: number): { fx: number; fz: number } {
  const a = sx / TW;
  const b = sy / TH;
  return { fx: (a + b) / 2, fz: (b - a) / 2 };
}

type Phase = "jour" | "aube" | "nuit";

const SKY: Record<Phase, { top: string; bottom: string; seaTop: string; seaBottom: string; sun: string; night: number }> = {
  jour: { top: "#8ecbe0", bottom: "#d8eef2", seaTop: "#7cc3cf", seaBottom: "#4f9fb3", sun: "#fff4c9", night: 0 },
  aube: { top: "#f2a98a", bottom: "#fbe3c4", seaTop: "#e7b8a2", seaBottom: "#5d93a8", sun: "#ffd27a", night: 0.08 },
  nuit: { top: "#0f1d33", bottom: "#2b3f63", seaTop: "#2c4766", seaBottom: "#17304a", sun: "#f3efd8", night: 0.38 },
};

function parisHour(): number {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

export function phaseAt(h: number): Phase {
  if (h < 6.5 || h >= 21) return "nuit";
  if (h < 8.5 || h >= 18.5) return "aube";
  return "jour";
}

const CSS = `
.pi { -webkit-tap-highlight-color: transparent; user-select: none; }
.pi-sway { animation: pi-sway var(--d, 3.4s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
.pi-bob { animation: pi-bob 1.6s ease-in-out infinite; }
.pi-blink { transform-box: fill-box; transform-origin: center; animation: pi-blink 4.2s infinite; }
.pi-leaf { animation: pi-sway 2.2s ease-in-out infinite; }
.pi-cloud { animation: pi-cloud var(--d, 70s) ease-in-out infinite alternate; }
.pi-shimmer { animation: pi-shimmer var(--d, 4s) ease-in-out infinite; animation-delay: var(--delay, 0s); opacity: 0; }
.pi-foam { transform-box: fill-box; transform-origin: center; animation: pi-foam 3.6s ease-in-out infinite; }
.pi-mote { animation: pi-mote var(--d, 7s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
.pi-twinkle { transform-box: fill-box; transform-origin: center; animation: pi-twinkle var(--d, 2.4s) ease-in-out infinite; animation-delay: var(--delay, 0s); }
.pi-boat { animation: pi-boat 90s linear infinite; }
.pi-rock { animation: pi-rock 3s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.pi-tile { transform-box: fill-box; transform-origin: center; animation: pi-tile-in 0.35s cubic-bezier(.2,.9,.3,1.3) both; animation-delay: var(--delay, 0s); }
.pi-select { transform-box: fill-box; transform-origin: center; animation: pi-pulse 1s ease-in-out infinite; }
.pi-arrow { animation: pi-arrow 0.8s ease-in-out infinite; }
.pi-paused, .pi-paused * { animation-play-state: paused !important; }
@keyframes pi-sway { 0%, 100% { transform: rotate(-2.2deg); } 50% { transform: rotate(2.2deg); } }
@keyframes pi-bob { 0%, 100% { transform: scale(1.03, 0.97); } 50% { transform: scale(0.98, 1.03); } }
@keyframes pi-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
@keyframes pi-cloud { from { transform: translateX(-60px); } to { transform: translateX(60px); } }
@keyframes pi-shimmer { 0%, 100% { opacity: 0; transform: translateX(-8px); } 50% { opacity: 0.85; transform: translateX(8px); } }
@keyframes pi-foam { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.95; transform: scale(1.02); } }
@keyframes pi-mote { 0%, 100% { transform: translate(0, 0); opacity: 0.2; } 50% { transform: translate(10px, -18px); opacity: 0.9; } }
@keyframes pi-twinkle { 0%, 100% { opacity: 0.25; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.1); } }
@keyframes pi-boat { from { transform: translateX(-260px); } to { transform: translateX(260px); } }
@keyframes pi-rock { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes pi-tile-in { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
@keyframes pi-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.75; } }
@keyframes pi-arrow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@media (prefers-reduced-motion: reduce) {
  .pi * { animation: none !important; }
  .pi-shimmer { opacity: 0.5; }
}
`;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

/** Un contour d'île irrégulier, reproductible. */
function blobPath(rx: number, ry: number, seed: number, wobble: number): string {
  const n = 28;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rand(seed + i) - 0.5) * wobble;
    pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]);
  }
  let d = "";
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    if (i === 0) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

const diamond = (s = 1) => `M0 ${-TH * s} L${TW * s} 0 L0 ${TH * s} L${-TW * s} 0 Z`;

interface PlantNode {
  plant: IslandPlant;
  stage: number;
  root: SVGGElement;
  pop: SVGGElement;
  body: SVGGElement;
}

/** « hero » : l'île cadrée serré en haut de l'accueil ; « full » : toute l'île et le ciel, pour jouer. */
export type Framing = "hero" | "full";

export function createIslandScene(host: HTMLElement, events: IslandSceneEvents, framing: Framing = "full"): IslandScene {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const svg = el("svg", { class: "pi", width: "100%", height: "100%", preserveAspectRatio: "xMidYMid meet" });
  svg.style.display = "block";
  host.appendChild(svg);
  const style = el("style", {}, svg);
  style.textContent = CSS;

  const defs = el("defs", {}, svg);
  defs.innerHTML = `
    <linearGradient id="pi-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" id="pi-sky-top"/><stop offset="1" id="pi-sky-bottom"/></linearGradient>
    <linearGradient id="pi-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" id="pi-sea-top"/><stop offset="1" id="pi-sea-bottom"/></linearGradient>
    <radialGradient id="pi-sun-glow"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <linearGradient id="pi-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6d27c"/><stop offset="1" stop-color="#7fb35c"/></linearGradient>
    <linearGradient id="pi-cliff" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a77d4c"/><stop offset="1" stop-color="#6e4f2f"/></linearGradient>
    <radialGradient id="pi-firefly"><stop offset="0" stop-color="#fff6b0"/><stop offset="0.4" stop-color="#ffe27a" stop-opacity="0.7"/><stop offset="1" stop-color="#ffe27a" stop-opacity="0"/></radialGradient>`;

  // Ciel et mer : très grands, ils débordent du cadre quel que soit le format de l'écran.
  const HORIZON = -190;
  const back = el("g", {}, svg);
  el("rect", { x: -1500, y: -1500, width: 3000, height: 1500 + HORIZON, fill: "url(#pi-sky)" }, back);
  const sunGroup = el("g", {}, back);
  const sunGlow = el("circle", { cx: 110, cy: -300, r: 70, fill: "url(#pi-sun-glow)" }, sunGroup);
  const sun = el("circle", { cx: 110, cy: -300, r: 22 }, sunGroup);
  const stars = el("g", {}, back);
  for (let i = 0; i < 40; i++) {
    el("circle", { cx: -260 + rand(i + 700) * 520, cy: -560 + rand(i + 800) * 340, r: 0.8 + rand(i + 900) * 1.4, fill: "#fff", class: "pi-twinkle", style: `--d:${2 + rand(i) * 3}s;--delay:${-rand(i + 3) * 3}s` }, stars);
  }
  const clouds = el("g", {}, back);
  for (let c = 0; c < 4; c++) {
    const g = el("g", { class: "pi-cloud", style: `--d:${55 + c * 17}s;animation-delay:${-c * 13}s` }, clouds);
    const x = -170 + c * 110 + rand(c) * 40;
    const y = -370 + rand(c + 5) * 130;
    const s = 0.7 + rand(c + 9) * 0.6;
    el("path", { d: `M${x - 34 * s} ${y} a${16 * s} ${16 * s} 0 0 1 ${22 * s} ${-14 * s} a${20 * s} ${20 * s} 0 0 1 ${36 * s} ${-4 * s} a${14 * s} ${14 * s} 0 0 1 ${18 * s} ${18 * s} Z`, fill: "#ffffff", opacity: 0.92, class: "pi-cloud-shape" }, g);
  }
  el("rect", { x: -1500, y: HORIZON, width: 3000, height: 2500, fill: "url(#pi-sea)" }, back);
  el("path", { d: `M-1500 ${HORIZON} L1500 ${HORIZON}`, stroke: "#ffffff", "stroke-opacity": 0.35, "stroke-width": 1.5 }, back);
  // Un voilier traverse l'horizon, une fois par minute et demie.
  const boat = el("g", { class: "pi-boat" }, back);
  el("path", { d: `M-10 ${HORIZON + 6} L10 ${HORIZON + 6} L7 ${HORIZON + 10} L-7 ${HORIZON + 10} Z`, fill: "#6b4a2b" }, boat);
  el("path", { d: `M0 ${HORIZON + 5} L0 ${HORIZON - 16} L10 ${HORIZON + 3} Z`, fill: "#fbfaf4" }, boat);
  el("path", { d: `M-1 ${HORIZON + 4} L-1 ${HORIZON - 10} L-8 ${HORIZON + 3} Z`, fill: "#e98a6a" }, boat);
  const shimmer = el("g", {}, back);
  for (let i = 0; i < 26; i++) {
    const x = -240 + rand(i + 40) * 480;
    const y = HORIZON + 20 + rand(i + 60) * 520;
    if (Math.abs(x) < 190 && y > -150 && y < 170) continue;
    const w = 8 + rand(i + 80) * 16;
    el("path", { d: `M${x} ${y} l${w} 0`, stroke: "#ffffff", "stroke-width": 2, "stroke-linecap": "round", class: "pi-shimmer", style: `--d:${3 + rand(i) * 3}s;--delay:${-rand(i + 1) * 4}s` }, shimmer);
  }

  // L'île : ombre dans l'eau, écume, plage, falaise, herbe ----------------------------------------
  const islandG = el("g", {}, svg);
  el("path", { d: blobPath(200, 112, 3, 0.08), transform: "translate(0 26)", fill: "#14261b", opacity: 0.16 }, islandG);
  el("path", { d: blobPath(201, 114, 7, 0.07), transform: "translate(0 15)", fill: "#ffffff", opacity: 0.7, class: "pi-foam" }, islandG);
  el("path", { d: blobPath(196, 110, 7, 0.07), transform: "translate(0 14)", fill: "#ead7a4" }, islandG);
  el("path", { d: blobPath(184, 102, 11, 0.06), transform: "translate(0 18)", fill: "url(#pi-cliff)" }, islandG);
  el("path", { d: blobPath(184, 102, 11, 0.06), transform: "translate(0 2)", fill: "url(#pi-grass)" }, islandG);
  el("path", { d: blobPath(150, 80, 17, 0.12), transform: "translate(-18 -10)", fill: "#b5dc8b", opacity: 0.45 }, islandG);
  // Petits détails du bord : rochers, galets, touffes d'herbe et fleurettes.
  const edge = el("g", {}, islandG);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(i) * 0.4;
    const x = Math.cos(a) * 192;
    const y = Math.sin(a) * 104 + 18;
    const r = 6 + rand(i + 3) * 7;
    el("ellipse", { cx: x, cy: y, rx: r, ry: r * 0.7, fill: shade("#9aa39a", (rand(i) - 0.5) * 0.12) }, edge);
    el("ellipse", { cx: x - r * 0.3, cy: y - r * 0.25, rx: r * 0.4, ry: r * 0.22, fill: "#c3cbc3" }, edge);
  }
  for (let i = 0; i < 30; i++) {
    const a = rand(i + 50) * Math.PI * 2;
    const k = 0.84 + rand(i + 80) * 0.1;
    const x = Math.cos(a) * 176 * k;
    const y = Math.sin(a) * 96 * k;
    const { fx, fz } = unproject(x, y);
    if (fx * fx + fz * fz <= 12.5) continue;
    if (rand(i + 90) > 0.6) {
      el("circle", { cx: x, cy: y - 3, r: 2.4, fill: rand(i) > 0.5 ? "#f6f1e3" : "#f2c14e" }, edge);
    } else {
      el("path", { d: `M${x - 4} ${y} q2 -9 4 -10 q1 6 0 10 M${x} ${y} q3 -7 6 -8 q-1 5 -3 8`, fill: shade("#6f9a4e", (rand(i) - 0.5) * 0.1) }, edge);
    }
  }

  // Cases (mode plantation) et sélection --------------------------------------------------------
  const tilesG = el("g", { "pointer-events": "none" }, svg);
  const selection = el("g", { "pointer-events": "none" }, svg);
  selection.style.display = "none";
  el("path", { d: diamond(0.94), fill: "#2e7a4c", "fill-opacity": 0.18, stroke: "#2e7a4c", "stroke-width": 3, "stroke-linejoin": "round", class: "pi-select" }, selection);

  // Plantes et Tigou : un seul calque trié par profondeur. Puis la nuit, les lucioles, la flèche et les fêtes.
  const world = el("g", {}, svg);
  const night = el("rect", { x: -1500, y: -1500, width: 3000, height: 3000, fill: "#0b1630", "pointer-events": "none", opacity: 0 }, svg);
  const motes = el("g", { "pointer-events": "none" }, svg);
  const arrowG = el("g", { "pointer-events": "none" }, svg);
  arrowG.style.display = "none";
  const arrow = el("g", { class: "pi-arrow" }, arrowG);
  el("path", { d: "M-10 -56 L10 -56 L0 -42 Z", fill: "#f2c14e", stroke: "#8a6512", "stroke-width": 1.5, "stroke-linejoin": "round" }, arrow);
  const fx = el("g", { "pointer-events": "none" }, svg);
  for (let i = 0; i < 18; i++) {
    const a = rand(i + 300) * Math.PI * 2;
    const r = rand(i + 400);
    el("circle", { cx: Math.cos(a) * 170 * r, cy: Math.sin(a) * 90 * r - 30 - rand(i + 500) * 40, r: 1.6, fill: "#fffbe8", class: "pi-mote", style: `--d:${6 + rand(i) * 6}s;--delay:${-rand(i + 2) * 8}s` }, motes);
  }

  const nodes = new Map<string, PlantNode>();
  let initialized = false;
  let current: IslandPlant[] = [];
  let planting: Pick<Seed, "key" | "rare"> | null = null;
  const seedOf = (p: IslandPlant) => p.x * 31 + p.z * 17 + p.species.length * 7;

  const tigou = el("g", {}, world);
  const tigouFace = el("g", {}, tigou);
  tigouFace.innerHTML = TIGOU_SVG;
  let tigouPos = project(0.9, 2.7);
  tigouPos = { sx: tigouPos.sx + 6, sy: tigouPos.sy + 8 };
  tigou.style.transform = `translate(${tigouPos.sx}px, ${tigouPos.sy}px)`;
  tigou.dataset.depth = String(tigouPos.sy);

  const sortWorld = () => {
    const kids = Array.from(world.children) as SVGGElement[];
    kids.sort((a, b) => Number(a.dataset.depth ?? 0) - Number(b.dataset.depth ?? 0));
    for (const k of kids) world.appendChild(k);
  };

  const draw = (n: PlantNode) => {
    const look = lookOf(n.plant);
    if (!look) return;
    n.body.setAttribute("transform", `scale(${stageScale(look.stage)})`);
    let extra = "";
    if (look.rare) {
      for (let i = 0; i < 3; i++) {
        const x = -20 + i * 20;
        const y = -50 - (i % 2) * 22;
        extra += `<path d="M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z" fill="#f2c14e" class="pi-twinkle" style="--delay:${-i * 0.7}s"/>`;
      }
    }
    n.body.innerHTML = plantSvg(look, seedOf(n.plant)) + extra;
    n.stage = look.stage;
  };

  const makeNode = (p: IslandPlant): PlantNode => {
    const { sx, sy } = project(p.x, p.z);
    const root = el("g", { transform: `translate(${sx} ${sy})`, "data-tile": `${p.x},${p.z}` }, world);
    root.dataset.depth = String(sy);
    el("ellipse", { cx: 0, cy: 0, rx: 18, ry: 6, fill: "#14261b", opacity: 0.16 }, root);
    const sway = el("g", { class: "pi-sway", style: `--d:${3 + rand(seedOf(p)) * 1.6}s;--delay:${-rand(seedOf(p) + 1) * 3}s` }, root);
    const pop = el("g", {}, sway);
    const body = el("g", {}, pop);
    // Une zone invisible facilite le toucher des petites plantes.
    el("path", { d: diamond(0.9), fill: "transparent" }, root);
    const n: PlantNode = { plant: p, stage: -1, root, pop, body };
    draw(n);
    return n;
  };

  const animatePop = (n: PlantNode, strong: boolean) => {
    if (reduced) return;
    const frames = strong
      ? [
          { transform: "scale(0.2, 0.05)", opacity: 0.4 },
          { transform: "scale(1.22, 1.12)", opacity: 1, offset: 0.55 },
          { transform: "scale(0.92, 1.04)", offset: 0.78 },
          { transform: "scale(1, 1)" },
        ]
      : [{ transform: "scale(1, 1)" }, { transform: "scale(1.12, 0.9)", offset: 0.3 }, { transform: "scale(0.95, 1.08)", offset: 0.65 }, { transform: "scale(1, 1)" }];
    n.pop.animate(frames, { duration: strong ? 720 : 520, easing: "cubic-bezier(.2,.8,.3,1)" });
  };

  const refreshTiles = () => {
    tilesG.replaceChildren();
    if (!planting) return;
    ISLAND_TILES.forEach((t) => {
      const check = checkTile(current, planting!, t.x, t.z);
      if (check !== "nouvelle" && check !== "grandit") return;
      const { sx, sy } = project(t.x, t.z);
      const g = el("g", { transform: `translate(${sx} ${sy})` }, tilesG);
      el(
        "path",
        {
          d: diamond(0.86),
          fill: check === "grandit" ? "#f2c14e" : "#ffffff",
          "fill-opacity": check === "grandit" ? 0.7 : 0.38,
          stroke: check === "grandit" ? "#d9a42c" : "#ffffff",
          "stroke-opacity": 0.8,
          "stroke-width": 1.5,
          "stroke-linejoin": "round",
          class: "pi-tile",
          style: `--delay:${(Math.abs(t.x) + Math.abs(t.z)) * 0.035}s`,
        },
        g,
      );
    });
  };

  const setPlants = (plants: IslandPlant[]) => {
    current = plants;
    const seen = new Set<string>();
    for (const p of plants) {
      const key = `${p.x},${p.z}`;
      seen.add(key);
      const old = nodes.get(key);
      const look = lookOf(p);
      if (!look) continue;
      if (!old) {
        const n = makeNode(p);
        nodes.set(key, n);
        if (initialized) animatePop(n, true);
        continue;
      }
      const changed = old.plant.species !== p.species || old.plant.rare !== p.rare || old.stage !== look.stage;
      const fed = old.plant.fed !== p.fed;
      old.plant = p;
      if (changed) {
        draw(old);
        animatePop(old, true);
      } else if (fed) animatePop(old, false);
    }
    for (const [key, n] of nodes) {
      if (!seen.has(key)) {
        n.root.remove();
        nodes.delete(key);
      }
    }
    sortWorld();
    refreshTiles();
    initialized = true;
  };

  // Particules et Tigou ---------------------------------------------------------------------------
  const burst = (x: number, z: number, kind: "nouvelle" | "grandit" | "stade") => {
    const { sx, sy } = project(x, z);
    const g = el("g", { transform: `translate(${sx} ${sy})` }, fx);
    const ring = el("ellipse", { cx: 0, cy: 0, rx: 12, ry: 6, fill: "none", stroke: kind === "stade" ? "#f2c14e" : "#ffffff", "stroke-width": 3 }, g);
    ring.animate([{ transform: "scale(0.6)", opacity: 1 }, { transform: "scale(3.6)", opacity: 0 }], { duration: 700, easing: "ease-out", fill: "forwards" });
    const count = reduced ? 0 : kind === "stade" ? 22 : 13;
    const colors = kind === "grandit" ? ["#4fa8c8", "#8fd3ea", "#ffffff"] : kind === "stade" ? ["#f2c14e", "#ffffff", "#e98aa0", "#f2c14e"] : ["#f2c14e", "#ffffff", "#2e7a4c", "#e98aa0"];
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length] ?? "#7bc08a";
      const shape =
        kind === "grandit"
          ? el("path", { d: "M0 -5 C3 -1 3 2 0 3 C-3 2 -3 -1 0 -5 Z", fill: color }, g)
          : kind === "stade" && i % 3 === 0
            ? el("path", { d: "M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z", fill: color }, g)
            : el("path", { d: "M0 0 C-4 -3 -4 -8 0 -10 C4 -8 4 -3 0 0 Z", fill: color }, g);
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 28 + Math.random() * 38;
      const dx = Math.cos(a) * dist;
      const up = 40 + Math.random() * 40;
      const spin = (Math.random() - 0.5) * 540;
      shape.animate(
        [
          { transform: "translate(0px, -16px) rotate(0deg) scale(0.4)", opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${-16 - up}px) rotate(${spin / 2}deg) scale(1.6)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${Math.sin(a) * 14}px) rotate(${spin}deg) scale(0.6)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.25,.6,.4,1)", fill: "forwards" },
      );
    }
    window.setTimeout(() => g.remove(), 1500);
  };

  let hopping: Animation | null = null;
  const hopTo = (sx: number, sy: number, jumps: number) => {
    if (reduced) {
      tigouPos = { sx, sy };
      tigou.style.transform = `translate(${sx}px, ${sy}px)`;
      tigou.dataset.depth = String(sy);
      sortWorld();
      return;
    }
    hopping?.cancel();
    const from = tigouPos;
    tigouFace.style.transform = sx < from.sx ? "scaleX(-1)" : "";
    const frames: Keyframe[] = [];
    const steps = 3;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = from.sx + (sx - from.sx) * k;
      const y = from.sy + (sy - from.sy) * k;
      frames.push({ transform: `translate(${x}px, ${y}px)`, offset: k * 0.7 });
      if (i < steps) {
        const km = (i + 0.5) / steps;
        frames.push({ transform: `translate(${from.sx + (sx - from.sx) * km}px, ${from.sy + (sy - from.sy) * km - 22}px)`, offset: km * 0.7 });
      }
    }
    for (let j = 0; j < jumps; j++) {
      const base = 0.7 + (j / jumps) * 0.3;
      const mid = base + 0.15 / jumps;
      frames.push({ transform: `translate(${sx}px, ${sy - 26}px) scale(1.05, 0.95)`, offset: mid });
      frames.push({ transform: `translate(${sx}px, ${sy}px) scale(1.1, 0.9)`, offset: Math.min(1, base + 0.3 / jumps) });
    }
    if (frames[frames.length - 1]?.offset !== 1) frames.push({ transform: `translate(${sx}px, ${sy}px)`, offset: 1 });
    tigouPos = { sx, sy };
    tigou.dataset.depth = String(sy + 0.5);
    sortWorld();
    tigou.style.transform = `translate(${sx}px, ${sy}px)`;
    hopping = tigou.animate(frames, { duration: 900 + jumps * 350, easing: "ease-in-out" });
  };

  // Ciel selon l'heure ------------------------------------------------------------------------------
  let phase: Phase | null = null;
  const applyPhase = () => {
    const next = phaseAt(parisHour());
    if (next === phase) return;
    phase = next;
    const p = SKY[next];
    defs.querySelector("#pi-sky-top")?.setAttribute("stop-color", p.top);
    defs.querySelector("#pi-sky-bottom")?.setAttribute("stop-color", p.bottom);
    defs.querySelector("#pi-sea-top")?.setAttribute("stop-color", p.seaTop);
    defs.querySelector("#pi-sea-bottom")?.setAttribute("stop-color", p.seaBottom);
    sun.setAttribute("fill", p.sun);
    const nightTime = next === "nuit";
    sun.setAttribute("cy", next === "aube" ? String(HORIZON - 40) : "-300");
    sunGlow.setAttribute("cy", sun.getAttribute("cy") ?? "-300");
    sunGlow.setAttribute("opacity", nightTime ? "0.25" : "1");
    stars.style.display = nightTime ? "" : "none";
    night.setAttribute("opacity", String(p.night));
    for (const c of Array.from(clouds.querySelectorAll(".pi-cloud-shape"))) c.setAttribute("fill", nightTime ? "#5b6f8f" : next === "aube" ? "#ffe6d6" : "#ffffff");
    for (const m of Array.from(motes.children)) {
      m.setAttribute("fill", nightTime ? "url(#pi-firefly)" : "#fffbe8");
      m.setAttribute("r", nightTime ? "5" : "1.6");
    }
  };
  applyPhase();
  const phaseTimer = window.setInterval(applyPhase, 60_000);

  // Cadre : l'île tient en largeur, un peu au-dessus du centre (le bac à graines est en bas).
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    if (framing === "hero") {
      // L'île entière en largeur, sa plage posée vers 70 % de la hauteur : dessous, le bac à graines puis
      // la feuille du fil ; au-dessus, un peu de ciel derrière l'en-tête.
      const hw = Math.max(440, (420 * w) / h);
      const hh = (hw * h) / w;
      svg.setAttribute("viewBox", `${-hw / 2} ${120 - hh * 0.7} ${hw} ${hh}`);
      return;
    }
    const vw = Math.max(412, (640 * w) / h);
    const vh = (vw * h) / w;
    svg.setAttribute("viewBox", `${-vw / 2} ${-vh * 0.47} ${vw} ${vh}`);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // Pause des animations quand l'île est hors de l'écran (on fait défiler le fil), quand l'onglet est
  // caché, ou quand l'appli le demande : sur un petit téléphone, un SVG animé coûte cher.
  let pausedByApp = false;
  let offscreen = false;
  const applyPause = () => svg.classList.toggle("pi-paused", pausedByApp || offscreen || document.hidden);
  const visibility = new IntersectionObserver(
    (entries) => {
      offscreen = !(entries[0]?.isIntersecting ?? true);
      applyPause();
    },
    { threshold: 0.05 },
  );
  visibility.observe(host);
  document.addEventListener("visibilitychange", applyPause);

  // Toucher ---------------------------------------------------------------------------------------------
  const onClick = (e: MouseEvent) => {
    const hit = (e.target as Element | null)?.closest?.("[data-tile]");
    const key = hit?.getAttribute("data-tile");
    if (key) {
      const [x, z] = key.split(",").map(Number);
      events.onTileTap(x ?? 0, z ?? 0);
      return;
    }
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
      const { fx: ux, fz: uz } = unproject(pt.x, pt.y);
      const x = Math.round(ux);
      const z = Math.round(uz);
      if (Math.abs(ux - x) + Math.abs(uz - z) <= 0.62 && ISLAND_TILES.some((t) => t.x === x && t.z === z)) {
        events.onTileTap(x, z);
        return;
      }
    }
    events.onEmptyTap();
  };
  svg.addEventListener("click", onClick);

  return {
    setPlants,
    setPlanting(seed) {
      planting = seed;
      refreshTiles();
    },
    setSelected(tile) {
      if (!tile) {
        selection.style.display = "none";
        arrowG.style.display = "none";
        return;
      }
      const { sx, sy } = project(tile.x, tile.z);
      selection.setAttribute("transform", `translate(${sx} ${sy})`);
      arrowG.setAttribute("transform", `translate(${sx} ${sy})`);
      selection.style.display = "";
      arrowG.style.display = "";
    },
    celebrate(x, z, kind) {
      burst(x, z, kind);
      const { sx, sy } = project(x, z);
      // Tigou accourt devant la plante (côté écran), pour rester visible.
      const side = sx > tigouPos.sx ? -1 : 1;
      hopTo(sx + side * 24, sy + 22, kind === "stade" ? 2 : 1);
    },
    setPaused(paused) {
      pausedByApp = paused;
      applyPause();
    },
    dispose() {
      window.clearInterval(phaseTimer);
      observer.disconnect();
      visibility.disconnect();
      document.removeEventListener("visibilitychange", applyPause);
      svg.removeEventListener("click", onClick);
      hopping?.cancel();
      svg.remove();
    },
  };
}
