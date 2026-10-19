"use client";

import { useEffect, useRef, useState } from "react";
import type * as T from "three";
import { ShellPearl } from "./shell-pearl";

// Concha 3D (three.js) do carrossel da areia: duas valvas com volume presas pela dobradiça. Chega fechada,
// balança, a valva de cima gira de verdade até ficar em pé e a pérola (com a foto da atração) sobe.
//
// Rápida: um motor só para a página toda (um canvas, ambiente, materiais e shaders já compilados),
// preparado ANTES da praia aparecer (prewarmShell3D, chamado pelo carrossel da areia) junto com as fotos.
// Se o motor ainda não estiver pronto quando a etapa abre, essa abertura usa a concha 2D (nunca fica vazio).
// Desenha só durante a abertura (~3 s) e para. Aparelho fraco (html.lite), movimento reduzido ou sem
// WebGL: sempre a concha 2D (shell-pearl.tsx).

const OPEN_DEG = 80; // valva de cima fica de frente para a câmera (que olha um pouco de cima), como a logo
const DURATION = 3.0; // s

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const easeBack = (t: number) => {
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
const clamp = (x: number) => Math.min(1, Math.max(0, x));

function webglOk() {
  if (document.documentElement.classList.contains("lite")) return false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

type Engine = {
  photo(src: string): Promise<T.Object3D>;
  play(el: HTMLElement, src: string): () => void;
};

let enginePromise: Promise<Engine> | null = null;
let engineReady: Engine | null = null;

async function buildEngine(): Promise<Engine> {
  const [THREE, { RoomEnvironment }, { valveRim, logoValveTop, logoValveBottom, photoPearl }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
    import("@/lib/sea3d"),
  ]);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "sand-shell-canvas";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff3e6, 0xb9a3e6, 0.55));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
  sun.position.set(1.5, 3, 2.5);
  scene.add(sun);
  const glow = new THREE.PointLight(0xffe3b2, 0, 3);
  glow.position.set(0, 0.45, 0.45);
  scene.add(glow);

  const camera = new THREE.PerspectiveCamera(30, 400 / 330, 0.1, 50);
  camera.position.set(0, 1.25, 3.7);
  camera.lookAt(0, 0.5, 0.1);

  // no estilo da concha oficial Pérolas: valva de cima em faixas onduladas, de baixo em leque com sulcos
  const shell = new THREE.Group();
  const bottom = new THREE.Group();
  bottom.add(logoValveBottom(THREE));
  bottom.add(valveRim(THREE, { sign: -1, ribs: 16, spread: 160, scallop: 0 }));
  // como na logo: os sulcos do leque de baixo convergem para baixo (ponta virada para a frente)
  bottom.rotation.y = Math.PI;
  bottom.position.z = 0.95;
  const top = logoValveTop(THREE);
  const hinge = new THREE.Group(); // gira em volta da dobradiça (eixo X na origem)
  hinge.add(top);
  shell.add(bottom, hinge);
  shell.position.y = 0.22;
  scene.add(shell);

  // uma pérola (com a foto) por atração, montada uma vez e trocada na cena
  const pearls = new Map<string, Promise<T.Object3D>>();
  const photo = (src: string) => {
    let p = pearls.get(src);
    if (!p) {
      p = new THREE.TextureLoader()
        .loadAsync(src)
        .catch(() => null)
        .then((tex) => {
          if (tex) tex.colorSpace = THREE.SRGBColorSpace;
          const g = photoPearl(THREE, tex, 0.42);
          g.position.set(0, 0.22, 0.5);
          g.scale.setScalar(0.001);
          return g;
        });
      pearls.set(src, p);
    }
    return p;
  };

  // compila os shaders agora (a primeira compilação é o que mais demora; antes travava a abertura)
  const warm = await photo("");
  scene.add(warm);
  renderer.setSize(8, 8);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  scene.remove(warm);

  let current: T.Object3D | null = null;
  let raf = 0;

  return {
    photo,
    play(el, src) {
      cancelAnimationFrame(raf);
      const w = el.clientWidth || 400;
      const h = el.clientHeight || 330;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      el.appendChild(renderer.domElement);
      if (current) scene.remove(current);
      current = null;
      let pearl: T.Object3D | null = null;
      photo(src).then((p) => {
        pearl = p;
        current = p;
        scene.add(p);
      });

      const t0 = performance.now();
      const draw = (t: number) => {
        // entrada (0–0,4 s): cresce um pouco
        shell.scale.setScalar(0.88 + 0.12 * ease(clamp(t / 0.4)));
        // balança fechada (0,4–1 s), depois abre (1–2,2 s) com leve passada do ponto
        const wob = t > 0.4 && t < 1 ? Math.sin((t - 0.4) * 22) * 0.06 * (1 - (t - 0.4) / 0.6) : 0;
        const open = easeBack(clamp((t - 1) / 1.2));
        hinge.rotation.x = -(open * OPEN_DEG * Math.PI) / 180 - Math.abs(wob);
        shell.rotation.z = wob * 0.5;
        // pérola sobe e vira para a frente (1,7–2,7 s)
        const k = ease(clamp((t - 1.7) / 1));
        if (pearl) {
          pearl.scale.setScalar(Math.max(0.001, k));
          pearl.position.y = 0.22 + 0.36 * k;
          pearl.lookAt(camera.position); // medalhão sempre de frente (sem ficar torto)
          pearl.rotateY((1 - k) * -1.2);
        }
        glow.intensity = 2.5 * k;
        renderer.render(scene, camera);
      };
      const frame = (now: number) => {
        const t = (now - t0) / 1000;
        draw(t);
        // continua até a pérola aparecer mesmo se a foto chegou atrasada
        if (t < DURATION || (!pearl && t < DURATION + 3)) raf = requestAnimationFrame(frame);
        else if (pearl) draw(DURATION);
      };
      raf = requestAnimationFrame(frame);
      // só em desenvolvimento: congelar a animação num instante (testes de captura de tela)
      if (process.env.NODE_ENV !== "production") (window as unknown as { __shellAt?: (t: number) => void }).__shellAt = (t) => { cancelAnimationFrame(raf); draw(t); };

      return () => cancelAnimationFrame(raf);
    },
  };
}

/** Prepara o motor 3D e as fotos das atrações antes da praia aparecer. Pode ser chamado várias vezes. */
export function prewarmShell3D(srcs: string[]) {
  if (typeof window === "undefined" || !webglOk()) return;
  enginePromise ??= buildEngine().then((e) => (engineReady = e));
  enginePromise.then((e) => srcs.forEach((s) => e.photo(s))).catch(() => {});
}

export function ShellPearl3D({ src, active }: { src: string; active: boolean }) {
  const [use3d, setUse3d] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);

  // a cada abertura decide: motor pronto → 3D; senão 2D nesta vez (e o motor continua carregando)
  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- escolha no início de cada abertura
    setUse3d(Boolean(engineReady));
    if (!engineReady) prewarmShell3D([src]);
  }, [active, src]);

  useEffect(() => {
    if (!use3d || !active || !holder.current || !engineReady) return;
    return engineReady.play(holder.current, src);
  }, [use3d, active, src]);

  if (!use3d) return <ShellPearl src={src} />;
  return <span ref={holder} className="sand-shell sand-shell-3d" aria-hidden />;
}
