/**
 * Les modèles 3D de l'île, construits par le code en « low poly » (facettes, ombrage plat) : aucune image
 * ni aucun fichier 3D à charger. Les packs de modèles (Kenney, Quaternius…) pourront remplacer ces
 * fonctions une à une sans toucher à la scène : chacune rend un groupe posé au sol en (0, 0, 0).
 */
import * as THREE from "three";
import type { PlantLook } from "@/lib/game/island.ts";

/** Hasard reproductible : la même plante garde la même allure d'une visite à l'autre. */
export function rand(n: number): number {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function shade(color: string, lightness: number): string {
  return `#${new THREE.Color(color).offsetHSL(0, 0, lightness).getHexString()}`;
}

const materials = new Map<string, THREE.MeshStandardMaterial>();

/** Matériaux partagés par couleur (mats, à facettes). */
export function mat(color: string, emissive?: string): THREE.MeshStandardMaterial {
  const key = `${color}|${emissive ?? ""}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), flatShading: true, roughness: 0.88, metalness: 0 });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 0.8;
    }
    materials.set(key, m);
  }
  return m;
}

export function disposeMaterials(): void {
  for (const m of materials.values()) m.dispose();
  materials.clear();
}

/**
 * Déforme les sommets au hasard, du même décalage pour deux sommets au même endroit (sinon les facettes
 * se décollent). `flatTop` garde plat le dessus d'un cylindre (le sol où l'on plante).
 */
export function jitter(geo: THREE.BufferGeometry, amount: number, seed: number, flatTop?: number): THREE.BufferGeometry {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = (Math.round(x * 997) * 73856093) ^ (Math.round(y * 997) * 19349663) ^ (Math.round(z * 997) * 83492791);
    const dx = (rand(k + seed) - 0.5) * 2 * amount;
    const dy = (rand(k + seed + 7.1) - 0.5) * 2 * amount;
    const dz = (rand(k + seed + 13.7) - 0.5) * 2 * amount;
    const top = flatTop !== undefined && y >= flatTop - 1e-4;
    pos.setXYZ(i, x + dx, top ? y : y + dy, z + dz);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export function mesh(geo: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, emissive?: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color, emissive));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function blob(r: number, color: string, x: number, y: number, z: number, seed: number, squash = 1): THREE.Mesh {
  const geo = jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.12, seed);
  const m = mesh(geo, color, x, y, z);
  m.scale.set(1, squash, 1);
  return m;
}

/** Taille d'une plante selon son stade : la pousse (stade 1) a son propre modèle. */
export function stageScale(stage: number): number {
  return [0.6, 1, 0.55, 0.78, 1][Math.max(0, Math.min(4, stage))] ?? 1;
}

const STEM = "#5f8f4e";
const LEAF_DARK = "#4f7e45";

function sprout(look: PlantLook, seed: number): THREE.Group {
  const g = new THREE.Group();
  const mound = mesh(new THREE.SphereGeometry(0.16, 8, 5), "#7a5532", 0, 0.01, 0);
  mound.scale.set(1, 0.38, 1);
  g.add(mound);
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.22, 5), "#4e9a62", 0, 0.12, 0));
  for (const side of [-1, 1]) {
    const leaf = mesh(jitter(new THREE.IcosahedronGeometry(0.075, 0), 0.008, seed + side), side < 0 ? look.color : shade(look.color, 0.06), side * 0.065, 0.23, 0);
    leaf.scale.set(1.7, 0.32, 0.95);
    leaf.rotation.z = side * -0.45;
    g.add(leaf);
  }
  return g;
}

function tree(look: PlantLook, seed: number): THREE.Group {
  const g = new THREE.Group();
  const k = look.key;
  const trunkColor = look.accent;

  if (k === "sequoia") {
    g.add(mesh(jitter(new THREE.CylinderGeometry(0.09, 0.15, 1.0, 7), 0.012, seed), trunkColor, 0, 0.5, 0));
    [0.55, 0.45, 0.34, 0.22].forEach((r, i) => {
      g.add(mesh(jitter(new THREE.ConeGeometry(r, 0.55, 8), 0.025, seed + i), i % 2 ? look.color : shade(look.color, 0.05), 0, 0.85 + i * 0.32, 0));
    });
    return g;
  }
  if (k === "baobab") {
    g.add(mesh(jitter(new THREE.CylinderGeometry(0.17, 0.26, 0.95, 8), 0.02, seed), trunkColor, 0, 0.47, 0));
    g.add(blob(0.62, look.color, 0, 1.05, 0, seed, 0.42));
    g.add(blob(0.4, shade(look.color, -0.05), 0.25, 1.1, -0.15, seed + 3, 0.5));
    return g;
  }

  const bonsai = k === "bonsai";
  const height = bonsai ? 0.45 : 0.8;
  const trunk = mesh(jitter(new THREE.CylinderGeometry(0.065, 0.11, height, 6), 0.012, seed), trunkColor, 0, height / 2, 0);
  if (bonsai) trunk.rotation.z = 0.25;
  g.add(trunk);
  if (bonsai) {
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.16, 10), "#b5653a", 0, 0.08, 0));
    g.add(blob(0.24, look.color, 0.1, 0.58, 0, seed, 0.55));
    g.add(blob(0.17, shade(look.color, 0.05), -0.12, 0.5, 0.06, seed + 1, 0.6));
    return g;
  }
  if (k === "transport") {
    // Écorce du bouleau : quelques marques sombres.
    for (let i = 0; i < 4; i++) {
      const mark = mesh(new THREE.BoxGeometry(0.05, 0.018, 0.02), "#3a3a34", 0, 0.15 + i * 0.16, 0.095);
      mark.rotation.y = rand(seed + i) * Math.PI * 2;
      mark.position.x = Math.sin(mark.rotation.y) * 0.095;
      mark.position.z = Math.cos(mark.rotation.y) * 0.095;
      g.add(mark);
    }
  }

  const weeping = k === "nature" || k === "saule";
  const flat = k === "logement" ? 0.7 : weeping ? 0.8 : 1;
  const big = k === "chene" ? 1.18 : 1;
  g.add(blob(0.42 * big, look.color, 0, 1.0, 0, seed, flat));
  g.add(blob(0.3 * big, shade(look.color, -0.06), 0.26, 0.86, 0.08, seed + 1, flat));
  g.add(blob(0.28 * big, shade(look.color, 0.05), -0.22, 0.88, -0.12, seed + 2, flat));
  if (k === "chene") g.add(blob(0.3, shade(look.color, 0.02), 0.02, 1.25, 0.18, seed + 3));
  if (weeping) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rand(seed + i) * 0.3;
      const strand = mesh(new THREE.CylinderGeometry(0.035, 0.012, 0.55, 4), shade(look.color, -0.04), Math.cos(a) * 0.38, 0.62, Math.sin(a) * 0.38);
      strand.rotation.z = Math.cos(a) * 0.15;
      strand.rotation.x = -Math.sin(a) * 0.15;
      g.add(strand);
    }
  }
  if (k === "logement") {
    // Petites olives.
    for (let i = 0; i < 6; i++) {
      const a = rand(seed + i * 3) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.035, 5, 4), "#4a4f2a", Math.cos(a) * 0.36, 0.86 + rand(seed + i) * 0.2, Math.sin(a) * 0.36));
    }
  }
  return g;
}

function petals(count: number, color: string, center: string, r: number, seed: number): THREE.Group {
  const head = new THREE.Group();
  head.add(mesh(new THREE.SphereGeometry(r * 0.55, 7, 5), center));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const p = mesh(new THREE.SphereGeometry(r * 0.6, 6, 4), i % 2 ? color : shade(color, 0.04), Math.cos(a) * r, 0, Math.sin(a) * r);
    p.scale.set(1.4, 0.3, 0.75);
    p.rotation.y = -a;
    head.add(p);
  }
  head.rotation.x = 0.35 + rand(seed) * 0.3;
  return head;
}

function waterFlower(look: PlantLook, seed: number): THREE.Group {
  const g = new THREE.Group();
  const pond = mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.05, 18), "#5aa6b8", 0, 0.02, 0);
  pond.receiveShadow = true;
  g.add(pond);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rand(seed + i);
    const pad = mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 10, 1, false, 0.3, Math.PI * 1.8), "#4f8f4e", Math.cos(a) * 0.24, 0.06, Math.sin(a) * 0.24);
    g.add(pad);
  }
  const bloom = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const petal = mesh(new THREE.ConeGeometry(0.055, 0.18, 5), i % 2 ? look.color : shade(look.color, 0.05), Math.cos(a) * 0.06, 0.08, Math.sin(a) * 0.06);
    petal.rotation.z = -Math.cos(a) * 0.6;
    petal.rotation.x = Math.sin(a) * 0.6;
    bloom.add(petal);
  }
  bloom.add(mesh(new THREE.SphereGeometry(0.045, 6, 4), look.accent, 0, 0.1, 0));
  bloom.position.set(0, 0.04, 0);
  g.add(bloom);
  return g;
}

function flower(look: PlantLook, seed: number): THREE.Group {
  const k = look.key;
  if (k === "lotus" || k === "nenuphar") return waterFlower(look, seed);
  const g = new THREE.Group();
  if (k === "rosier") {
    g.add(blob(0.36, look.accent, 0, 0.3, 0, seed, 0.85));
    for (let i = 0; i < 7; i++) {
      const a = rand(seed + i) * Math.PI * 2;
      const h = 0.2 + rand(seed + i + 9) * 0.3;
      g.add(mesh(jitter(new THREE.IcosahedronGeometry(0.065, 0), 0.01, seed + i), look.color, Math.cos(a) * 0.32, h, Math.sin(a) * 0.32));
    }
    return g;
  }
  const sunflower = k === "scan";
  const stems = sunflower ? 3 : k === "edelweiss" ? 4 : 3;
  if (k === "edelweiss") g.add(blob(0.2, "#9aa89a", 0, 0.05, 0, seed, 0.4));
  if (k === "orchidee") g.add(mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 10), "#e9e3d6", 0, 0.1, 0));
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2 + rand(seed + i);
    const d = i === 0 ? 0 : 0.17;
    const h = (sunflower ? 0.85 : k === "edelweiss" ? 0.22 : 0.5) * (0.8 + rand(seed + i * 5) * 0.3);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const base = k === "orchidee" ? 0.2 : 0;
    g.add(mesh(new THREE.CylinderGeometry(0.016, 0.022, h, 5), STEM, x, base + h / 2, z));
    const leaf = mesh(jitter(new THREE.IcosahedronGeometry(0.07, 0), 0.01, seed + i), LEAF_DARK, x + 0.06, base + h * 0.35, z);
    leaf.scale.set(1.8, 0.3, 0.8);
    leaf.rotation.z = -0.4;
    g.add(leaf);
    const head = petals(sunflower ? 12 : k === "bravo" ? 5 : 7, look.color, look.accent, sunflower ? 0.11 : 0.07, seed + i);
    head.position.set(x, base + h, z);
    g.add(head);
  }
  return g;
}

function tuft(look: PlantLook, seed: number): THREE.Group {
  const g = new THREE.Group();
  if (look.key === "quiz") {
    // Lavande : touffe gris-vert et épis violets.
    g.add(blob(0.2, "#7d9a7a", 0, 0.08, 0, seed, 0.6));
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rand(seed + i) * 0.4;
      const lean = 0.12 + rand(seed + i * 3) * 0.2;
      const h = 0.42 + rand(seed + i * 7) * 0.18;
      const stem = new THREE.Group();
      stem.add(mesh(new THREE.CylinderGeometry(0.008, 0.012, h, 4), "#7d9a7a", 0, h / 2, 0));
      stem.add(mesh(new THREE.CapsuleGeometry(0.032, 0.13, 2, 6), i % 3 ? look.color : shade(look.color, 0.08), 0, h + 0.05, 0));
      stem.rotation.z = Math.cos(a) * lean;
      stem.rotation.x = Math.sin(a) * lean;
      stem.position.set(Math.cos(a) * 0.05, 0.05, Math.sin(a) * 0.05);
      g.add(stem);
    }
    return g;
  }
  // Fougère : frondes en éventail.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(seed + i) * 0.3;
    const frond = new THREE.Group();
    const leaf = mesh(new THREE.ConeGeometry(0.07, 0.62, 4), i % 2 ? look.color : shade(look.color, 0.06), 0, 0.31, 0);
    leaf.scale.set(1.9, 1, 0.35);
    frond.add(leaf);
    frond.rotation.y = -a;
    frond.rotation.z = 0.75 + rand(seed + i * 5) * 0.25;
    const holder = new THREE.Group();
    holder.rotation.y = a;
    holder.add(frond);
    g.add(holder);
  }
  return g;
}

function cactus(look: PlantLook, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 10), "#d8c49a", 0, 0.04, 0));
  g.add(mesh(new THREE.CapsuleGeometry(0.15, 0.5, 3, 8), look.color, 0, 0.42, 0));
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    const out = mesh(new THREE.CapsuleGeometry(0.075, 0.12, 2, 6), shade(look.color, side * 0.03), side * 0.13, 0, 0);
    out.rotation.z = Math.PI / 2;
    const up = mesh(new THREE.CapsuleGeometry(0.075, 0.16 + rand(seed + side) * 0.1, 2, 6), shade(look.color, side * 0.03), side * 0.22, 0.1, 0);
    arm.add(out, up);
    arm.position.y = side < 0 ? 0.38 : 0.5;
    g.add(arm);
  }
  const bloom = petals(5, look.accent, "#f2c14e", 0.045, seed);
  bloom.position.y = 0.78;
  bloom.rotation.x = 0;
  g.add(bloom);
  return g;
}

function potager(look: PlantLook, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.16, 0.72), "#8a6438", 0, 0.08, 0));
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.04, 0.62), "#5a3e22", 0, 0.17, 0));
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3; i++) {
      const x = -0.26 + i * 0.26;
      const z = row ? 0.15 : -0.15;
      if ((row + i) % 2) {
        g.add(blob(0.1, look.color, x, 0.26, z, seed + row * 3 + i, 0.75));
      } else {
        const veg = mesh(jitter(new THREE.SphereGeometry(0.075, 7, 5), 0.006, seed + i), look.accent, x, 0.24, z);
        veg.scale.set(1.2, 0.85, 1.2);
        g.add(veg);
        g.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 4), look.color, x, 0.32, z));
      }
    }
  }
  return g;
}

/** Une plante au stade voulu (stade 0 : graine à peine posée, comme le stade 1). */
export function buildPlant(look: PlantLook, seed: number): THREE.Group {
  if (look.stage <= 1) return sprout(look, seed);
  switch (look.shape) {
    case "arbre":
      return tree(look, seed);
    case "fleur":
      return flower(look, seed);
    case "touffe":
      return tuft(look, seed);
    case "cactus":
      return cactus(look, seed);
    case "potager":
      return potager(look, seed);
  }
}

/** Tigou, la mascotte : une pousse sur pattes. Le groupe `body` se tasse et s'étire, `leaves` se balancent. */
export function buildMascot(): { root: THREE.Group; body: THREE.Group; leaves: THREE.Group; eyes: THREE.Mesh[] } {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(new THREE.CapsuleGeometry(0.15, 0.16, 4, 10), "#4e9a62", 0, 0.27, 0));
  const belly = mesh(new THREE.SphereGeometry(0.1, 8, 6), "#8fcf9a", 0, 0.24, 0.08);
  belly.scale.set(1, 1.1, 0.6);
  body.add(belly);
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.03, 8, 6), "#14261b", side * 0.06, 0.37, 0.13);
    eye.castShadow = false;
    eyes.push(eye);
    body.add(eye);
    const shine = mesh(new THREE.SphereGeometry(0.009, 5, 4), "#ffffff", side * 0.06 + 0.01, 0.385, 0.155);
    shine.castShadow = false;
    body.add(shine);
    const cheek = mesh(new THREE.SphereGeometry(0.022, 6, 4), "#e98aa0", side * 0.1, 0.32, 0.11);
    cheek.scale.set(1, 0.6, 0.4);
    cheek.castShadow = false;
    body.add(cheek);
    const foot = mesh(new THREE.SphereGeometry(0.055, 7, 5), "#3d7a4e", side * 0.075, 0.03, 0.02);
    foot.scale.set(1, 0.55, 1.3);
    root.add(foot);
  }
  const leaves = new THREE.Group();
  leaves.position.y = 0.46;
  leaves.add(mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.1, 5), "#2e7a4c", 0, 0.04, 0));
  for (const side of [-1, 1]) {
    const leaf = mesh(jitter(new THREE.IcosahedronGeometry(0.08, 0), 0.008, side + 40), side < 0 ? "#2e7a4c" : "#7bc08a", side * 0.07, 0.1, 0);
    leaf.scale.set(1.7, 0.32, 0.9);
    leaf.rotation.z = side * -0.5;
    leaves.add(leaf);
  }
  body.add(leaves);
  return { root, body, leaves, eyes };
}
