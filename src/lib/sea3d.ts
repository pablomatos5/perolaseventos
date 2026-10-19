// Peças 3D do fundo do mar (three.js), usadas pela concha do carrossel da areia (shell-pearl-3d.tsx).
// O mesmo modelo de valva é usado no gerador do fundo do mar do rodapé (scripts/render-fundo-mar.mjs).
import type * as T from "three";

type Three = typeof T;

/**
 * Valva de vieira com volume: leque com cuia (côncava), nervuras em relevo e borda recortada.
 * Deitada no plano XZ com a dobradiça na origem e a ponta para +Z. `sign` = +1 (cúpula para cima,
 * valva de cima fechada) ou -1 (tigela para baixo, valva de baixo).
 */
export function valveGeometry(THREE: Three, o: { R?: number; depth?: number; ribs?: number; ribAmp?: number; spread?: number; scallop?: number; sign: 1 | -1 }) {
  const R = o.R ?? 1;
  const sc = o.scallop ?? 0.05; // recorte da borda (0 = borda lisa)
  const D = o.depth ?? 0.24;
  const ribs = o.ribs ?? 11;
  const ribAmp = o.ribAmp ?? 0.05;
  const phiMax = ((o.spread ?? 150) / 2) * (Math.PI / 180);
  const U = 48;
  const V = 160;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  // madrepérola: pêssego na dobradiça → lilás no meio → rosa na borda; cristas das nervuras mais claras
  const A = new THREE.Color(0xf6d2b4);
  const B = new THREE.Color(0xe2cdf6);
  const C = new THREE.Color(0xf8c6dc);
  const tmp = new THREE.Color();
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    for (let j = 0; j <= V; j++) {
      const v = j / V;
      const phi = -phiMax + 2 * phiMax * v;
      const c = 0.5 + 0.5 * Math.cos(v * ribs * 2 * Math.PI);
      const wave = Math.pow(c, 0.7); // nervura arredondada (1 = crista)
      const r = u * R * (1 + sc * wave);
      const side = Math.pow(Math.cos((phi / phiMax) * (Math.PI / 2) * 0.92), 0.6); // cuia mais funda no meio
      const cup = D * Math.pow(Math.sin(Math.PI * Math.min(u, 0.999)), 0.85) * side;
      const rib = ribAmp * Math.pow(u, 0.7) * wave;
      pos.push(r * Math.sin(phi), o.sign * (cup + rib), r * Math.cos(phi));
      if (u < 0.5) tmp.copy(A).lerp(B, u / 0.5);
      else tmp.copy(B).lerp(C, (u - 0.5) / 0.5);
      tmp.lerp(new THREE.Color(0xffffff), 0.25 * wave * u);
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      const b = a + V + 1;
      if (o.sign > 0) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Madrepérola (interior) e dourado (exterior). */
export function shellMaterials(THREE: Three) {
  const nacre = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    iridescence: 0.55,
    iridescenceIOR: 1.6,
    iridescenceThicknessRange: [250, 650],
    envMapIntensity: 0.45,
    side: THREE.FrontSide,
  });
  const gold = new THREE.MeshPhysicalMaterial({
    color: 0xd9a55c,
    roughness: 0.32,
    metalness: 0.55,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xfff1d6),
    side: THREE.BackSide,
  });
  return { nacre, gold };
}

/** Uma valva = mesma geometria com as duas faces (interior perolado, exterior dourado). */
export function valve(THREE: Three, sign: 1 | -1, mats: ReturnType<typeof shellMaterials>, opts: Partial<Parameters<typeof valveGeometry>[1]> = {}) {
  const g = valveGeometry(THREE, { ...opts, sign });
  const group = new THREE.Group();
  // a valva de cima tem o interior virado para baixo: troca as faces
  const inside = new THREE.Mesh(g, mats.nacre.clone());
  const outside = new THREE.Mesh(g, mats.gold.clone());
  (inside.material as T.Material).side = THREE.BackSide;
  (outside.material as T.Material).side = THREE.FrontSide;
  group.add(inside, outside);
  return group;
}

/**
 * Pérola com a foto da atração: esfera perolada atrás e, na frente, um medalhão com a foto em cor
 * original (sem luz nem reflexo por cima, para a foto ficar nítida), com aro de pérola e um brilho suave.
 * `focusX` = ponto da foto que fica no centro (0..1), como o object-position do CSS.
 */
export function photoPearl(THREE: Three, tex: T.Texture | null, radius = 0.42, focusX = 0.52) {
  const group = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.MeshPhysicalMaterial({ color: 0xf6eefc, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.8, iridescenceIOR: 1.5, envMapIntensity: 0.8 }),
  );
  group.add(ball);
  if (tex) {
    const img = tex.image as { width: number; height: number };
    const aspect = img.width / img.height;
    // recorte "cover" quadrado
    if (aspect > 1) {
      tex.repeat.set(1 / aspect, 1);
      tex.offset.set(Math.min(1 - 1 / aspect, Math.max(0, focusX - 0.5 / aspect)), 0);
    } else {
      tex.repeat.set(1, aspect);
      tex.offset.set(0, (1 - aspect) / 2);
    }
    const r = radius * 0.86;
    const photo = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    photo.position.z = radius * 1.01;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, radius * 0.07, 16, 96),
      new THREE.MeshPhysicalMaterial({ color: 0xfbf4ff, roughness: 0.2, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.5 }),
    );
    ring.position.z = radius * 1.01;
    // brilho de pérola: reflexo pequeno no canto de cima (transparente, não apaga a foto)
    const shine = new THREE.Mesh(
      new THREE.CircleGeometry(r * 0.22, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, toneMapped: false }),
    );
    shine.position.set(-r * 0.42, r * 0.5, radius * 1.02);
    shine.scale.set(1.4, 0.8, 1);
    shine.rotation.z = 0.5;
    group.add(photo, ring, shine);
  }
  return group;
}

/** Fio dourado na borda recortada da valva (acabamento que dá leitura de "concha" de longe). */
export function valveRim(THREE: Three, o: { R?: number; ribs?: number; spread?: number; scallop?: number; sign: 1 | -1 }) {
  const R = o.R ?? 1;
  const sc = o.scallop ?? 0.05;
  const ribs = o.ribs ?? 11;
  const phiMax = ((o.spread ?? 150) / 2) * (Math.PI / 180);
  const pts: T.Vector3[] = [];
  for (let j = 0; j <= 200; j++) {
    const v = j / 200;
    const phi = -phiMax + 2 * phiMax * v;
    const wave = Math.pow(0.5 + 0.5 * Math.cos(v * ribs * 2 * Math.PI), 0.7);
    const r = R * (1 + sc * wave);
    pts.push(new THREE.Vector3(r * Math.sin(phi), o.sign * sc * wave, r * Math.cos(phi)));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 260, o.scallop === 0 ? 0.026 : 0.014, 10, false);
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0xe0b06a, metalness: 0.8, roughness: 0.25, clearcoat: 1 }));
}

/** Corpo da valva atrás do relevo (uma peça só): mesma curvatura, em ouro rosado mais escuro, para os vãos
 *  entre as faixas/raios lerem como sulcos de UMA concha e não como várias conchas soltas. */
function valveBody(THREE: Three, shape: T.Shape, bend: (x: number, y: number) => number, offset: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 4 });
  const a = g.attributes.position as T.BufferAttribute;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i);
    const y = a.getY(i);
    a.setXYZ(i, x, bend(x, y) + a.getZ(i) - 0.015 + offset, y);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0xd9a47e, metalness: 0.6, roughness: 0.38, clearcoat: 0.4, side: THREE.DoubleSide }));
}

/** Dourado champanhe das peças no estilo da logo (faixas de cima e raios de baixo). */
function logoGold(THREE: Three) {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf5d8ac,
    metalness: 0.78,
    roughness: 0.24,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xffd9e6),
    side: THREE.DoubleSide,
  });
}

/**
 * Valva de cima no estilo da concha oficial Pérolas: faixas onduladas concêntricas (como curvas de nível),
 * separadas por vãos, em dourado champanhe. Mesmo sistema de eixos da valveGeometry (dobradiça na origem,
 * ponta para +Z, cúpula para cima quando fechada).
 */
export function logoValveTop(THREE: Three, o: { R?: number; bands?: number; inner?: number; spread?: number; depth?: number; lobes?: number; sign?: 1 | -1; bodyInner?: number; onlyRim?: boolean; rays?: number } = {}) {
  const R = o.R ?? 1;
  const sg = o.sign ?? 1; // +1 valva de cima (cúpula), -1 valva de baixo (tigela)
  const N = o.bands ?? 8;
  const inner = o.inner ?? 0.3;
  const p = ((o.spread ?? 196) / 2) * (Math.PI / 180);
  const D = o.depth ?? 0.13;
  const L = o.lobes ?? 5;
  const step = (R - inner) / N;
  const bandW = step * 0.58; // o resto é vão (o chanfro engorda a faixa)
  const thick = 0.07; // faixas grossas: relevo de metal com volume
  const S = 160;
  const mat = logoGold(THREE);
  const group = new THREE.Group();
  // ondulação igual em todas as faixas (paralelas, como na logo), mais forte para fora
  const off = (r: number, phi: number) => 0.05 * Math.pow(r / R, 0.9) * Math.cos(L * Math.PI * (phi / p));
  for (let k = o.onlyRim ? N - 1 : 0; k < N; k++) {
    const r0 = inner + k * step;
    const r1 = r0 + bandW;
    const pk = p * (0.9 + 0.1 * (k / (N - 1))); // as de dentro terminam um pouco antes (pontas em degrau)
    const shape = new THREE.Shape();
    for (let j = 0; j <= S; j++) {
      const phi = -pk + (2 * pk * j) / S;
      const r = r1 + off(r1, phi);
      if (j === 0) shape.moveTo(r * Math.sin(phi), r * Math.cos(phi));
      else shape.lineTo(r * Math.sin(phi), r * Math.cos(phi));
    }
    for (let j = S; j >= 0; j--) {
      const phi = -pk + (2 * pk * j) / S;
      const r = r0 + off(r0, phi);
      shape.lineTo(r * Math.sin(phi), r * Math.cos(phi));
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.012, bevelSegments: 4, curveSegments: 4 });
    const a = g.attributes.position as T.BufferAttribute;
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i);
      const y = a.getY(i);
      const z = a.getZ(i);
      const r = Math.hypot(x, y);
      const phi = Math.atan2(x, y);
      const side = Math.pow(Math.max(0, Math.cos(Math.min(Math.abs(phi) / p, 1) * (Math.PI / 2) * 0.92)), 0.6);
      const cup = D * Math.pow(Math.sin(Math.PI * Math.min(r / R, 0.999)), 0.85) * side;
      a.setXYZ(i, x, sg * cup + z - thick / 2, y); // plano da forma (XY) → plano da valva (XZ), cúpula em Y
    }
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, mat));
  }
  // raios finos (os sulcos da logo) do fundo da tigela até o aro
  if (o.rays) {
    const rIn = 0.1;
    const rOut = inner + (N - 1) * step - 0.01;
    for (let k = 0; k < o.rays; k++) {
      const phi = -p * 0.86 + (2 * p * 0.86 * k) / (o.rays - 1);
      const w = 0.012;
      const shape = new THREE.Shape();
      const ax = Math.cos(phi) * w;
      const ay = -Math.sin(phi) * w;
      const e = rOut + off(rOut, phi);
      shape.moveTo(rIn * Math.sin(phi) - ax, rIn * Math.cos(phi) - ay);
      shape.lineTo(e * Math.sin(phi) - ax * 1.8, e * Math.cos(phi) - ay * 1.8);
      shape.lineTo(e * Math.sin(phi) + ax * 1.8, e * Math.cos(phi) + ay * 1.8);
      shape.lineTo(rIn * Math.sin(phi) + ax, rIn * Math.cos(phi) + ay);
      shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.006, bevelSegments: 2 });
      const a = g.attributes.position as T.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i);
        const y = a.getY(i);
        const r = Math.hypot(x, y);
        const ph = Math.atan2(x, y);
        const side = Math.pow(Math.max(0, Math.cos(Math.min(Math.abs(ph) / p, 1) * (Math.PI / 2) * 0.92)), 0.6);
        const cup = D * Math.pow(Math.sin(Math.PI * Math.min(r / R, 0.999)), 0.85) * side;
        a.setXYZ(i, x, sg * cup + a.getZ(i) - 0.012, y);
      }
      g.computeVertexNormals();
      group.add(new THREE.Mesh(g, mat));
    }
  }
  // corpo único atrás das faixas (do lado de fora da concha: fica atrás quando ela abre)
  {
    const rOut = inner + (N - 1) * step + bandW;
    const body = new THREE.Shape();
    for (let j = 0; j <= S; j++) {
      const phi = -p + (2 * p * j) / S;
      const r = rOut + off(rOut, phi);
      if (j === 0) body.moveTo(r * Math.sin(phi), r * Math.cos(phi));
      else body.lineTo(r * Math.sin(phi), r * Math.cos(phi));
    }
    for (let j = S; j >= 0; j--) {
      const phi = -p + (2 * p * j) / S;
      const ri = o.bodyInner ?? inner;
      const r = ri + off(ri, phi);
      body.lineTo(r * Math.sin(phi), r * Math.cos(phi));
    }
    const bend = (x: number, y: number) => {
      const r = Math.hypot(x, y);
      const phi = Math.atan2(x, y);
      const side = Math.pow(Math.max(0, Math.cos(Math.min(Math.abs(phi) / p, 1) * (Math.PI / 2) * 0.92)), 0.6);
      return sg * D * Math.pow(Math.sin(Math.PI * Math.min(r / R, 0.999)), 0.85) * side;
    };
    group.add(valveBody(THREE, body, bend, sg * (thick / 2 + 0.02)));
  }
  return group;
}

/** Valva de baixo: mesmo contorno ondulado e mesmo ouro da de cima (as metades casam), em tigela. */
export function logoValveBottom(THREE: Three) {
  // mesmo contorno e material da de cima, mas é a base da MESMA concha: só o aro ondulado + raios finos no fundo
  return logoValveTop(THREE, { sign: -1, depth: 0.2, bodyInner: 0.02, onlyRim: true, rays: 15 });
}
