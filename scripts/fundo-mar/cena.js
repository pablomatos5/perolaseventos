// Cena 3D do fundo do mar do rodapé (three.js). Renderizada UMA vez por scripts/fundo-mar/render.mjs e
// salva como imagem em public/2027/fundo-mar-*.webp: qualidade de 3D com custo zero no celular.
// Valva da concha igual à de src/lib/sea3d.ts (mesmos parâmetros).
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const params = new URLSearchParams(location.search);
const W = Number(params.get("w") || 2880);
const H = Number(params.get("h") || 760);
const MOBILE = params.get("m") === "1";

// aleatório com semente (a mesma imagem toda vez)
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a, b) => a + (b - a) * rnd();

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.78;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG = new THREE.Color(0xeccbe0);
scene.fog = new THREE.Fog(FOG, 10, 30);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

scene.add(new THREE.HemisphereLight(0xffeef4, 0xb497e6, 0.45));
const sun = new THREE.DirectionalLight(0xffe6cc, 2.4);
sun.position.set(-3, 9, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8, near: 1, far: 30 });
sun.shadow.radius = 6;
sun.shadow.bias = -0.0004;
scene.add(sun);

const camera = new THREE.PerspectiveCamera(MOBILE ? 36 : 24, W / H, 0.1, 100);
if (MOBILE) {
  camera.position.set(0, 1.9, 7.6);
  camera.lookAt(0, 0.55, 0);
} else {
  camera.position.set(0, 1.35, 7.2);
  camera.lookAt(0, 0.75, 0);
}

const shadowy = (o) => {
  o.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
};

// ───────── areia: dunas suaves + ondulações + variação de cor ─────────
{
  const g = new THREE.PlaneGeometry(40, 18, 400, 180);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = [];
  const c1 = new THREE.Color(0xeec3a8);
  const c2 = new THREE.Color(0xdca48e);
  const c3 = new THREE.Color(0xe2b7d4);
  const t = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const dune = 0.22 * Math.sin(x * 0.45 + 1.3) * Math.cos(z * 0.35) + 0.12 * Math.sin(x * 0.9 - z * 0.6);
    const ripple = 0.018 * Math.sin(x * 5.5 + z * 1.8 + Math.sin(z * 0.7) * 2);
    p.setY(i, dune + ripple - 0.05);
    const k = 0.5 + 0.5 * Math.sin(x * 0.7 + z * 0.9);
    t.copy(c1).lerp(c2, k * 0.6).lerp(c3, Math.max(0, -z / 18));
    col.push(t.r, t.g, t.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const sand = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  sand.receiveShadow = true;
  sand.position.z = -4;
  scene.add(sand);
}
const groundY = (x, z) => {
  const zz = z + 4;
  return 0.22 * Math.sin(x * 0.45 + 1.3) * Math.cos(zz * 0.35) + 0.12 * Math.sin(x * 0.9 - zz * 0.6) - 0.05;
};

// ───────── concha (mesma valva de src/lib/sea3d.ts) ─────────
function valveGeometry({ R = 1, depth = 0.24, ribs = 11, ribAmp = 0.05, spread = 150, sign }) {
  const phiMax = (spread / 2) * (Math.PI / 180);
  const U = 48;
  const V = 160;
  const pos = [];
  const col = [];
  const idx = [];
  const A = new THREE.Color(0xf6d2b4);
  const B = new THREE.Color(0xe2cdf6);
  const C = new THREE.Color(0xf8c6dc);
  const tmp = new THREE.Color();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      const phi = -phiMax + 2 * phiMax * v;
      const wave = Math.pow(0.5 + 0.5 * Math.cos(v * ribs * 2 * Math.PI), 0.7);
      const r = u * R * (1 + 0.05 * wave);
      const side = Math.pow(Math.cos((phi / phiMax) * (Math.PI / 2) * 0.92), 0.6);
      const cup = depth * Math.pow(Math.sin(Math.PI * Math.min(u, 0.999)), 0.85) * side;
      const rib = ribAmp * Math.pow(u, 0.7) * wave;
      pos.push(r * Math.sin(phi), sign * (cup + rib), r * Math.cos(phi));
      if (u < 0.5) tmp.copy(A).lerp(B, u / 0.5);
      else tmp.copy(B).lerp(C, (u - 0.5) / 0.5);
      tmp.lerp(new THREE.Color(0xffffff), 0.25 * wave * u);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < U; i++)
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      const b = a + V + 1;
      if (sign > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const nacre = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.4, clearcoat: 0.5, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 0.5, side: THREE.BackSide });
const goldOut = (hex = 0xd9a55c) => new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.32, metalness: 0.55, clearcoat: 0.6, side: THREE.FrontSide });
function valve(sign, gold, opts = {}) {
  const g = valveGeometry({ ...opts, sign });
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(g, nacre), new THREE.Mesh(g, gold));
  return grp;
}
function scallop({ open = 95, scale = 1, gold = goldOut() } = {}) {
  const s = new THREE.Group();
  s.add(valve(-1, gold));
  const hinge = new THREE.Group();
  hinge.add(valve(1, gold));
  hinge.rotation.x = -(open * Math.PI) / 180;
  s.add(hinge);
  s.scale.setScalar(scale);
  return shadowy(s);
}
const pearlMat = new THREE.MeshPhysicalMaterial({ color: 0xf7f0ff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.5, sheen: 0.6, sheenColor: new THREE.Color(0xffe3f0) });
const pearl = (r) => shadowy(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), pearlMat));

// concha grande no centro, aberta, com a pérola brilhando
{
  const s = scallop({ open: 98, scale: 1.25 });
  s.position.set(0, groundY(0, 0) + 0.32, 0);
  s.rotation.y = 0;
  scene.add(s);
  const p = pearl(0.36);
  p.position.set(0, groundY(0, 0) + 0.62, 0.55);
  scene.add(p);
  const glow = new THREE.PointLight(0xffe6c4, 6, 4, 1.6);
  glow.position.set(0, 1.1, 1.3);
  scene.add(glow);
}

// ───────── corais ramificados ─────────
const coralMats = [0xa985e6, 0xe98ab4, 0xf0a47e, 0x9b7fe0].map(
  (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.2 }),
);
function branch(group, start, dir, len, radius, depth, mat) {
  const pts = [start.clone()];
  const d = dir.clone();
  let p = start.clone();
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    d.add(new THREE.Vector3(between(-0.25, 0.25), between(0, 0.15), between(-0.2, 0.2))).normalize();
    p = p.clone().addScaledVector(d, len / steps);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.TubeGeometry(curve, 24, radius, 10, false);
  // afina até a ponta
  const pos = tube.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 11) / 24;
    const c = curve.getPoint(Math.min(1, seg));
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(c).multiplyScalar(1 - seg * 0.55);
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  tube.computeVertexNormals();
  group.add(new THREE.Mesh(tube, mat));
  const tip = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 12, 8), mat);
  tip.position.copy(p);
  group.add(tip);
  if (depth > 0) {
    const n = depth > 1 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const t = between(0.45, 0.85);
      const from = curve.getPoint(t);
      const nd = d.clone().add(new THREE.Vector3(between(-0.9, 0.9), between(0.2, 0.6), between(-0.5, 0.5))).normalize();
      branch(group, from, nd, len * between(0.5, 0.7), radius * 0.68, depth - 1, mat);
    }
  }
}
function coral(x, z, size, matIdx) {
  const g = new THREE.Group();
  const mat = coralMats[matIdx % coralMats.length];
  const trunks = 3;
  for (let i = 0; i < trunks; i++) {
    branch(g, new THREE.Vector3(between(-0.15, 0.15), 0, between(-0.1, 0.1)), new THREE.Vector3(between(-0.4, 0.4), 1, between(-0.3, 0.3)).normalize(), size, size * 0.11, 2, mat);
  }
  g.position.set(x, groundY(x, z) - 0.02, z);
  scene.add(shadowy(g));
}

// coral "cérebro" (bola com sulcos)
function brainCoral(x, z, r, hex) {
  const geo = new THREE.SphereGeometry(r, 96, 64, 0, Math.PI * 2, 0, Math.PI / 1.8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const n = v.clone().normalize();
    const k = 1 + 0.05 * Math.sin(n.x * 22 + Math.sin(n.z * 9) * 2) * Math.cos(n.y * 18);
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.7, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }));
  m.scale.y = 0.7;
  m.position.set(x, groundY(x, z) - 0.05, z);
  scene.add(shadowy(m));
}

// ───────── algas (fitas onduladas) ─────────
const weedMats = [0x8f74de, 0xb898ec, 0xdc7fab].map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, side: THREE.DoubleSide, sheen: 0.5 }));
function weed(x, z, h, matIdx) {
  const pts = [];
  const ph = between(0, 6);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(Math.sin(t * 5 + ph) * 0.12 * t, t * h, Math.cos(t * 4 + ph) * 0.06 * t));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const shape = new THREE.Shape();
  shape.ellipse(0, 0, 0.07, 0.018, 0, Math.PI * 2);
  const geo = new THREE.ExtrudeGeometry(shape, { steps: 40, extrudePath: curve, bevelEnabled: false });
  const m = new THREE.Mesh(geo, weedMats[matIdx % weedMats.length]);
  m.position.set(x, groundY(x, z) - 0.03, z);
  scene.add(shadowy(m));
}

// ───────── estrela-do-mar com volume ─────────
function starfish(x, z, size, hex, rot) {
  const s = new THREE.Shape();
  const arms = 5;
  for (let k = 0; k <= arms * 2; k++) {
    const a = (k / (arms * 2)) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 === 0 ? 1 : 0.42;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (k === 0) s.moveTo(px, py);
    else {
      const am = a - Math.PI / (arms * 2);
      const rm = k % 2 === 0 ? 0.62 : 0.62;
      s.quadraticCurveTo(Math.cos(am) * rm * 1.02, Math.sin(am) * rm * 1.02, px, py);
    }
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 6, curveSegments: 16 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.6, sheen: 0.7, sheenColor: new THREE.Color(0xfff1d6), clearcoat: 0.2 }));
  m.scale.setScalar(size);
  m.rotation.y = rot;
  m.position.set(x, groundY(x, z) + 0.02, z);
  scene.add(shadowy(m));
  // pontinhos em relevo
  for (let k = 0; k < arms; k++) {
    const a = (k / arms) * Math.PI * 2 + Math.PI / 2 + rot;
    for (const rr of [0.3, 0.52, 0.72]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.035 * size * 4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1d6, roughness: 0.5 }));
      d.position.set(x + Math.cos(a) * rr * size, groundY(x, z) + 0.17 * size + 0.04, z - Math.sin(a) * rr * size);
      scene.add(d);
    }
  }
}

// ───────── pedrinhas e conchinhas ─────────
function pebble(x, z, r, hex) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 }));
  m.scale.set(1, 0.55, between(0.7, 1));
  m.position.set(x, groundY(x, z) + r * 0.25, z);
  scene.add(shadowy(m));
}

// ───────── composição ─────────
const L = MOBILE ? 0.42 : 1; // no celular aproxima as laterais do centro

// laterais: corais altos e algas emoldurando a concha
const side = (sx) => {
  coral(sx * 4.6 * L, -1.2, 1.35, sx > 0 ? 1 : 0);
  coral(sx * 3.7 * L, -0.4, 0.95, sx > 0 ? 3 : 2);
  coral(sx * 5.6 * L, -2.6, 1.7, sx > 0 ? 2 : 1);
  brainCoral(sx * 3.1 * L, 0.5, 0.55, sx > 0 ? 0xeea68a : 0xb99be8);
  for (let i = 0; i < 5; i++) weed(sx * between(4.9, 6.4) * L, between(-3, -1.5), between(1.6, 2.6), i);
  for (let i = 0; i < 3; i++) weed(sx * between(2.2, 3.0) * L, between(-2.4, -1.6), between(1.0, 1.6), i + 1);
};
side(-1);
side(1);
// fundo distante (some na névoa)
for (let i = 0; i < (MOBILE ? 6 : 10); i++) coral(between(-8, 8) * L, between(-9, -6), between(1.2, 2.2), i);
for (let i = 0; i < (MOBILE ? 8 : 14); i++) weed(between(-9, 9) * L, between(-8, -5), between(1.5, 3), i);

// estrelas-do-mar e conchinhas pela areia
starfish(-1.7 * (MOBILE ? 0.7 : 1), 1.2, 0.34, 0xe3a65d, 0.4);
starfish(1.9 * (MOBILE ? 0.7 : 1), 1.4, 0.26, 0xf0907e, -0.3);
if (!MOBILE) starfish(-4.1, 1.6, 0.22, 0xe3a65d, 1.1);
for (const [x, z, s, r] of [
  [-1.0, 1.9, 0.26, 0.5],
  [2.7 * L, 1.0, 0.22, -0.8],
  [-2.6 * L, 0.6, 0.2, 2.2],
]) {
  const c = scallop({ open: 0, scale: s, gold: goldOut(0xe2b277) });
  c.rotation.y = r;
  c.position.set(x, groundY(x, z) + 0.06, z);
  scene.add(c);
}
// pedrinhas e pérolas soltas
for (let i = 0; i < 26; i++) {
  const x = between(-6, 6) * L;
  const z = between(-1, 2.6);
  if (Math.abs(x) < 1.3 && z < 1.4) continue;
  pebble(x, z, between(0.04, 0.11), [0xd8c4ee, 0xf0cfc0, 0xe8b9c9, 0xfff1e4][i % 4]);
}
for (const [x, z, r] of [
  [0.9, 1.3, 0.07],
  [1.05, 1.45, 0.045],
  [-0.8, 1.5, 0.06],
  [3.3 * L, 1.6, 0.05],
  [-3.4 * L, 1.9, 0.055],
]) {
  const p = pearl(r);
  p.position.set(x, groundY(x, z) + r, z);
  scene.add(p);
}

renderer.render(scene, camera);
window.__pronto = renderer.domElement.toDataURL("image/png");
