/**
 * La scène 3D de l'île (three.js, sans React) : l'île flottant sur un lagon, les plantes posées sur une
 * grille, le vent, l'heure de Paris (jour, aube, nuit), Tigou la mascotte et les petites fêtes quand
 * une graine pousse. Le composant IslandGame la pilote par l'interface IslandScene.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ISLAND_TILES, checkTile, lookOf, type IslandPlant, type Seed } from "@/lib/game/island.ts";
import { buildMascot, buildPlant, disposeMaterials, jitter, mat, mesh, rand, shade, stageScale } from "./models.ts";

export const TILE = 1.05;
const GROUND = 0.55;

export interface IslandSceneEvents {
  /** Un emplacement touché (mode plantation, ou une plante touchée hors mode plantation). */
  onTileTap: (x: number, z: number) => void;
  /** Ni plante ni emplacement : un toucher dans le vide. */
  onEmptyTap: () => void;
}

export interface IslandScene {
  setPlants(plants: IslandPlant[]): void;
  setPlanting(seed: Pick<Seed, "key" | "rare"> | null): void;
  setSelected(tile: { x: number; z: number } | null): void;
  celebrate(x: number, z: number, kind: "nouvelle" | "grandit" | "stade"): void;
  dispose(): void;
}

type Phase = "jour" | "aube" | "nuit";

const PALETTES: Record<Phase, { sky: string; hemiSky: string; hemiGround: string; hemi: number; sun: string; sunI: number; sunPos: [number, number, number]; water: string; grass: string; cloud: string }> = {
  jour: { sky: "#bfe0ea", hemiSky: "#eef8ff", hemiGround: "#6b8a4a", hemi: 1.1, sun: "#fff3dc", sunI: 2.6, sunPos: [6, 10, 5], water: "#5fb3c2", grass: "#8cc06a", cloud: "#ffffff" },
  aube: { sky: "#f3cfa8", hemiSky: "#ffe4c8", hemiGround: "#5d6b3a", hemi: 0.9, sun: "#ffb27a", sunI: 2.2, sunPos: [9, 4.5, 3], water: "#6aa7b8", grass: "#93b866", cloud: "#ffe9d8" },
  nuit: { sky: "#17283b", hemiSky: "#3e5d80", hemiGround: "#16241c", hemi: 0.55, sun: "#b4c8ff", sunI: 0.9, sunPos: [-5, 9, -3], water: "#2b4c62", grass: "#4f7a4a", cloud: "#6f8299" },
};

function parisHour(): number {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h + m / 60;
}

function phaseAt(h: number): Phase {
  if (h < 6.5 || h >= 21) return "nuit";
  if (h < 8.5 || h >= 18.5) return "aube";
  return "jour";
}

interface PlantNode {
  plant: IslandPlant;
  stage: number;
  group: THREE.Group;
  scale: number;
  velocity: number;
  target: number;
  phase: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

function roundedSquare(size: number, radius: number): THREE.ShapeGeometry {
  const s = size / 2;
  const r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  const geo = new THREE.ShapeGeometry(shape, 4);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function createIslandScene(canvas: HTMLCanvasElement, events: IslandSceneEvents): IslandScene {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  camera.position.set(7.4, 7.2, 8.6);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6.5;
  controls.maxDistance = 17;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.22;
  controls.rotateSpeed = 0.7;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.35;
  controls.update();
  let lastInteraction = 0;
  const onControlStart = () => {
    controls.autoRotate = false;
    lastInteraction = performance.now();
  };
  controls.addEventListener("start", onControlStart);

  // Lumières et ciel ----------------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight("#ffffff", "#6b8a4a", 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffffff", 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.fog = new THREE.Fog("#bfe0ea", 20, 46);

  // Lagon : un plan découpé en facettes, animé par deux houles.
  const waterGeo = new THREE.PlaneGeometry(70, 70, 56, 56);
  waterGeo.rotateX(-Math.PI / 2);
  const waterBase = Float32Array.from((waterGeo.getAttribute("position") as THREE.BufferAttribute).array as ArrayLike<number>);
  const waterMat = new THREE.MeshStandardMaterial({ color: "#5fb3c2", flatShading: true, roughness: 0.35, metalness: 0.05 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.receiveShadow = true;
  scene.add(water);

  // L'île : plage, socle de terre, plateau d'herbe bien plat où l'on plante.
  const grassMat = new THREE.MeshStandardMaterial({ color: "#8cc06a", flatShading: true, roughness: 0.95 });
  const beach = mesh(jitter(new THREE.CylinderGeometry(5.0, 5.7, 0.5, 34, 1), 0.07, 3), "#e6d3a3", 0, 0, 0);
  const dirt = mesh(jitter(new THREE.CylinderGeometry(4.35, 4.85, 0.36, 34, 1), 0.06, 5), "#9a7449", 0, 0.2, 0);
  const grassGeo = jitter(new THREE.CylinderGeometry(4.25, 4.36, 0.18, 34, 1), 0.05, 9, 0.09);
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.position.y = GROUND - 0.09;
  grass.receiveShadow = true;
  scene.add(beach, dirt, grass);

  // Décor du bord : rochers, touffes, galets (hors des emplacements, au-delà du rayon 3,6).
  const decor = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(i) * 0.4;
    const r = 4.8 + rand(i + 20) * 0.5;
    const rock = mesh(jitter(new THREE.IcosahedronGeometry(0.22 + rand(i + 3) * 0.2, 0), 0.04, i), shade("#9aa39a", rand(i) * 0.08 - 0.04), Math.cos(a) * r, 0.25, Math.sin(a) * r);
    rock.scale.y = 0.7;
    decor.add(rock);
  }
  for (let i = 0; i < 26; i++) {
    const a = rand(i + 50) * Math.PI * 2;
    const r = 3.75 + rand(i + 80) * 0.4;
    const blade = mesh(new THREE.ConeGeometry(0.05, 0.2 + rand(i) * 0.12, 4), shade("#6f9a4e", rand(i + 9) * 0.1 - 0.05), Math.cos(a) * r, GROUND + 0.1, Math.sin(a) * r);
    decor.add(blade);
  }
  scene.add(decor);

  // Nuages qui tournent lentement.
  const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1 });
  const clouds = new THREE.Group();
  for (let c = 0; c < 4; c++) {
    const cloud = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(0.55 + rand(c * 10 + i) * 0.35, 1), 0.06, c * 10 + i), cloudMat);
      puff.position.set(i * 0.6 - 0.9, rand(c + i) * 0.25, rand(c * 3 + i) * 0.4);
      puff.scale.y = 0.6;
      cloud.add(puff);
    }
    const a = (c / 4) * Math.PI * 2;
    cloud.position.set(Math.cos(a) * 11, 5.5 + rand(c) * 2, Math.sin(a) * 11);
    clouds.add(cloud);
  }
  scene.add(clouds);

  // Pollen le jour, lucioles la nuit ; étoiles la nuit.
  const POLLEN = 70;
  const pollenGeo = new THREE.BufferGeometry();
  const pollenPos = new Float32Array(POLLEN * 3);
  for (let i = 0; i < POLLEN; i++) {
    const a = rand(i + 300) * Math.PI * 2;
    const r = rand(i + 400) * 4.5;
    pollenPos.set([Math.cos(a) * r, GROUND + 0.3 + rand(i + 500) * 2, Math.sin(a) * r], i * 3);
  }
  pollenGeo.setAttribute("position", new THREE.BufferAttribute(pollenPos, 3));
  const pollenBase = Float32Array.from(pollenPos);
  const pollenMat = new THREE.PointsMaterial({ color: "#fffbe8", size: 0.06, transparent: true, opacity: 0.8, depthWrite: false });
  const pollen = new THREE.Points(pollenGeo, pollenMat);
  scene.add(pollen);

  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(260 * 3);
  for (let i = 0; i < 260; i++) {
    const a = rand(i + 900) * Math.PI * 2;
    const y = 0.15 + rand(i + 1200) * 0.85;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(a) * r * 50, y * 50, Math.sin(a) * r * 50], i * 3);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: "#ffffff", size: 0.35, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  let phase: Phase | null = null;
  const applyPhase = () => {
    const next = phaseAt(parisHour());
    if (next === phase) return;
    phase = next;
    const p = PALETTES[next];
    scene.background = new THREE.Color(p.sky);
    (scene.fog as THREE.Fog).color.set(p.sky);
    hemi.color.set(p.hemiSky);
    hemi.groundColor.set(p.hemiGround);
    hemi.intensity = p.hemi;
    sun.color.set(p.sun);
    sun.intensity = p.sunI;
    sun.position.set(...p.sunPos);
    waterMat.color.set(p.water);
    grassMat.color.set(p.grass);
    cloudMat.color.set(p.cloud);
    stars.visible = next === "nuit";
    const night = next === "nuit";
    pollenMat.color.set(night ? "#ffe27a" : "#fffbe8");
    pollenMat.size = night ? 0.1 : 0.06;
    pollenMat.blending = night ? THREE.AdditiveBlending : THREE.NormalBlending;
    pollenMat.needsUpdate = true;
  };
  applyPhase();
  const phaseTimer = window.setInterval(applyPhase, 60_000);

  // Emplacements (visibles seulement en mode plantation) -------------------------------------------
  const tileGeo = roundedSquare(0.9, 0.16);
  const freeMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.42, depthWrite: false });
  const growMat = new THREE.MeshBasicMaterial({ color: "#f2c14e", transparent: true, opacity: 0.75, depthWrite: false });
  const tiles = new THREE.Group();
  const tileMeshes = new Map<string, THREE.Mesh>();
  for (const t of ISLAND_TILES) {
    const m = new THREE.Mesh(tileGeo, freeMat);
    m.position.set(t.x * TILE, GROUND + 0.012, t.z * TILE);
    m.renderOrder = 1;
    tiles.add(m);
    tileMeshes.set(`${t.x},${t.z}`, m);
  }
  tiles.visible = false;
  scene.add(tiles);

  const selection = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.47, 36), new THREE.MeshBasicMaterial({ color: "#2e7a4c", transparent: true, opacity: 0.95, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = GROUND + 0.02;
  const arrow = mesh(new THREE.ConeGeometry(0.12, 0.26, 4), "#f2c14e", 0, GROUND + 1.6, 0);
  arrow.rotation.x = Math.PI;
  arrow.castShadow = false;
  selection.add(ring, arrow);
  selection.visible = false;
  scene.add(selection);

  // Plantes ------------------------------------------------------------------------------------------
  const plantsGroup = new THREE.Group();
  scene.add(plantsGroup);
  const nodes = new Map<string, PlantNode>();
  let currentPlants: IslandPlant[] = [];
  let planting: Pick<Seed, "key" | "rare"> | null = null;

  const seedOf = (p: IslandPlant) => p.x * 31 + p.z * 17 + p.species.length * 7;

  const makeNode = (plant: IslandPlant, startScale: number): PlantNode | null => {
    const look = lookOf(plant);
    if (!look) return null;
    const group = buildPlant(look, seedOf(plant));
    group.position.set(plant.x * TILE, GROUND, plant.z * TILE);
    group.rotation.y = rand(seedOf(plant)) * Math.PI * 2;
    group.scale.setScalar(Math.max(0.001, startScale));
    group.userData.tile = { x: plant.x, z: plant.z };
    if (look.rare) {
      for (let i = 0; i < 3; i++) {
        const sparkle = mesh(new THREE.OctahedronGeometry(0.04, 0), "#f2c14e", 0, 0, 0, "#f2c14e");
        sparkle.castShadow = false;
        sparkle.userData.sparkle = i;
        group.add(sparkle);
      }
    }
    plantsGroup.add(group);
    return { plant, stage: look.stage, group, scale: startScale, velocity: 0, target: stageScale(look.stage), phase: rand(seedOf(plant) + 1) * Math.PI * 2 };
  };

  const removeNode = (n: PlantNode) => {
    plantsGroup.remove(n.group);
    n.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  };

  const refreshTiles = () => {
    tiles.visible = planting !== null;
    if (!planting) return;
    for (const t of ISLAND_TILES) {
      const m = tileMeshes.get(`${t.x},${t.z}`);
      if (!m) continue;
      const check = checkTile(currentPlants, planting, t.x, t.z);
      m.visible = check === "nouvelle" || check === "grandit";
      m.material = check === "grandit" ? growMat : freeMat;
    }
  };

  const setPlants = (plants: IslandPlant[]) => {
    currentPlants = plants;
    const seen = new Set<string>();
    for (const p of plants) {
      const key = `${p.x},${p.z}`;
      seen.add(key);
      const old = nodes.get(key);
      const look = lookOf(p);
      if (!look) continue;
      if (!old) {
        const n = makeNode(p, 0);
        if (n) nodes.set(key, n);
        continue;
      }
      if (old.plant.species !== p.species || old.plant.rare !== p.rare || old.stage !== look.stage) {
        // Nouveau stade : nouveau modèle, qui part petit et rebondit jusqu'à sa taille.
        removeNode(old);
        const n = makeNode(p, old.stage === look.stage ? old.scale : stageScale(look.stage) * 0.35);
        if (n) nodes.set(key, n);
      } else {
        if (p.fed !== old.plant.fed) old.velocity += 2.2;
        old.plant = p;
      }
    }
    for (const [key, n] of nodes) {
      if (!seen.has(key)) {
        removeNode(n);
        nodes.delete(key);
      }
    }
    refreshTiles();
  };

  // Tigou ----------------------------------------------------------------------------------------------
  const tigou = buildMascot();
  const home = new THREE.Vector3(3.75, GROUND, 0.9);
  tigou.root.position.copy(home);
  scene.add(tigou.root);
  let hop: { from: THREE.Vector3; to: THREE.Vector3; t: number; jumps: number } | null = null;
  let blinkAt = 2;

  // Particules : feuilles, pollen et gouttes ---------------------------------------------------------
  const particleGeo = new THREE.TetrahedronGeometry(0.05, 0);
  const dropGeo = new THREE.SphereGeometry(0.035, 6, 4);
  const particles: Particle[] = [];
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(particleGeo, mat("#7bc08a"));
    m.visible = false;
    scene.add(m);
    particles.push({ mesh: m, velocity: new THREE.Vector3(), life: 0, maxLife: 1, size: 1, active: false });
  }
  const burst = (x: number, z: number, kind: "nouvelle" | "grandit" | "stade") => {
    const count = reduced ? 6 : kind === "stade" ? 30 : 16;
    const colors = kind === "grandit" ? ["#7cc6dc", "#aee0ee"] : kind === "stade" ? ["#f2c14e", "#7bc08a", "#ffffff"] : ["#7bc08a", "#4e9a62", "#f2c14e"];
    let made = 0;
    for (const p of particles) {
      if (made >= count) break;
      if (p.active) continue;
      made++;
      const color = colors[made % colors.length] ?? "#7bc08a";
      p.mesh.geometry = kind === "grandit" ? dropGeo : particleGeo;
      p.mesh.material = mat(color);
      const a = Math.random() * Math.PI * 2;
      const spread = 0.6 + Math.random() * 0.9;
      p.velocity.set(Math.cos(a) * spread, 2.4 + Math.random() * 1.6, Math.sin(a) * spread);
      p.mesh.position.set(x * TILE, GROUND + 0.35, z * TILE);
      p.life = p.maxLife = 0.8 + Math.random() * 0.5;
      p.size = 0.8 + Math.random() * 0.8;
      p.active = true;
      p.mesh.visible = true;
    }
  };

  // Toucher : distingue un toucher d'une rotation de caméra ------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND);
  const hit = new THREE.Vector3();
  let down: { x: number; y: number; t: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 500;
    down = null;
    if (moved > 8 || !quick) return;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(plantsGroup, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.tile) o = o.parent;
      const tile = o?.userData.tile as { x: number; z: number } | undefined;
      if (tile) {
        events.onTileTap(tile.x, tile.z);
        return;
      }
    }
    if (raycaster.ray.intersectPlane(groundPlane, hit)) {
      const tx = Math.round(hit.x / TILE);
      const tz = Math.round(hit.z / TILE);
      const inside = Math.abs(hit.x - tx * TILE) < 0.5 && Math.abs(hit.z - tz * TILE) < 0.5;
      if (inside && ISLAND_TILES.some((t) => t.x === tx && t.z === tz)) {
        events.onTileTap(tx, tz);
        return;
      }
    }
    events.onEmptyTap();
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);

  // Taille --------------------------------------------------------------------------------------------
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // Boucle --------------------------------------------------------------------------------------------
  const clock = new THREE.Clock();
  const waterPos = waterGeo.getAttribute("position") as THREE.BufferAttribute;
  const sway = reduced ? 0.012 : 0.035;
  let frame = 0;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 30);
    const t = clock.elapsedTime;
    frame++;

    if (!controls.autoRotate && !reduced && performance.now() - lastInteraction > 10_000) controls.autoRotate = true;
    controls.update();

    // Houle (une image sur deux suffit).
    if (!reduced && frame % 2 === 0) {
      for (let i = 0; i < waterPos.count; i++) {
        const x = waterBase[i * 3] ?? 0;
        const z = waterBase[i * 3 + 2] ?? 0;
        waterPos.setY(i, Math.sin(x * 0.55 + t * 1.1) * 0.07 + Math.cos(z * 0.7 + t * 0.85) * 0.05 - 0.04);
      }
      waterPos.needsUpdate = true;
      waterGeo.computeVertexNormals();
    }

    // Plantes : ressort de taille et vent.
    for (const n of nodes.values()) {
      const accel = (n.target - n.scale) * 95 - n.velocity * 9;
      n.velocity += accel * dt;
      n.scale += n.velocity * dt;
      const s = Math.max(0.001, n.scale);
      n.group.scale.set(s, s * (1 + Math.max(0, n.velocity) * 0.03), s);
      n.group.rotation.x = Math.sin(t * 1.4 + n.phase) * sway;
      n.group.rotation.z = Math.cos(t * 1.1 + n.phase) * sway;
      for (const child of n.group.children) {
        const k = child.userData.sparkle as number | undefined;
        if (k === undefined) continue;
        const a = t * 1.2 + k * 2.1;
        child.position.set(Math.cos(a) * 0.45, 0.4 + Math.sin(t * 2 + k) * 0.25, Math.sin(a) * 0.45);
        child.rotation.y = t * 3;
      }
    }

    // Sélection : anneau qui respire, flèche qui rebondit.
    if (selection.visible) {
      const pulse = 1 + Math.sin(t * 5) * 0.08;
      ring.scale.set(pulse, pulse, 1);
      arrow.position.y = GROUND + 1.5 + Math.abs(Math.sin(t * 4)) * 0.25;
      arrow.rotation.y = t * 2;
    }

    // Tigou : respiration, clignement, sauts.
    const body = tigou.body;
    body.scale.set(1 - Math.sin(t * 3) * 0.02, 1 + Math.sin(t * 3) * 0.035, 1 - Math.sin(t * 3) * 0.02);
    tigou.leaves.rotation.z = Math.sin(t * 2.2) * 0.12;
    blinkAt -= dt;
    const blinking = blinkAt < 0.12;
    for (const eye of tigou.eyes) eye.scale.y = blinking ? 0.15 : 1;
    if (blinkAt < 0) blinkAt = 2.5 + Math.random() * 3;
    if (hop) {
      hop.t += dt / 0.65;
      const k = Math.min(1, hop.t);
      tigou.root.position.lerpVectors(hop.from, hop.to, k);
      tigou.root.position.y = GROUND + Math.sin(k * Math.PI) * 0.55;
      tigou.root.lookAt(hop.to.x, tigou.root.position.y, hop.to.z);
      if (k >= 1) {
        if (hop.jumps > 0) {
          hop = { from: hop.to.clone(), to: hop.to.clone(), t: 0, jumps: hop.jumps - 1 };
        } else {
          hop = null;
        }
      }
    } else {
      const look = Math.atan2(camera.position.x - tigou.root.position.x, camera.position.z - tigou.root.position.z);
      const turn = ((((look - tigou.root.rotation.y + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      tigou.root.rotation.y += turn * Math.min(1, dt * 2);
    }

    // Nuages, pollen.
    clouds.rotation.y = t * 0.015;
    if (!reduced) {
      const pp = pollenGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < POLLEN; i++) {
        pp.setXYZ(
          i,
          (pollenBase[i * 3] ?? 0) + Math.sin(t * 0.4 + i) * 0.3,
          (pollenBase[i * 3 + 1] ?? 0) + Math.sin(t * 0.7 + i * 1.7) * 0.25,
          (pollenBase[i * 3 + 2] ?? 0) + Math.cos(t * 0.35 + i) * 0.3,
        );
      }
      pp.needsUpdate = true;
    }

    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.velocity.y -= 6.5 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (p.mesh.position.y < GROUND) p.mesh.position.y = GROUND;
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 4;
      p.mesh.scale.setScalar(p.size * (p.life / p.maxLife));
    }

    renderer.render(scene, camera);
  });

  return {
    setPlants,
    setPlanting(seed) {
      planting = seed;
      refreshTiles();
    },
    setSelected(tile) {
      selection.visible = tile !== null;
      if (tile) selection.position.set(tile.x * TILE, 0, tile.z * TILE);
    },
    celebrate(x, z, kind) {
      burst(x, z, kind);
      // Tigou accourt à côté de la plante, côté caméra, et saute de joie.
      const toCamera = new THREE.Vector3(camera.position.x, 0, camera.position.z).normalize();
      const to = new THREE.Vector3(x * TILE + toCamera.x * 0.62, GROUND, z * TILE + toCamera.z * 0.62);
      hop = { from: tigou.root.position.clone().setY(GROUND), to, t: 0, jumps: kind === "stade" ? 2 : 1 };
    },
    dispose() {
      renderer.setAnimationLoop(null);
      window.clearInterval(phaseTimer);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", onControlStart);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      tileGeo.dispose();
      freeMat.dispose();
      growMat.dispose();
      disposeMaterials();
      renderer.dispose();
    },
  };
}
