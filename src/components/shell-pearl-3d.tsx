"use client";

import { useEffect, useRef, useState } from "react";
import { ShellPearl } from "./shell-pearl";

// Concha 3D (three.js) do carrossel da areia: duas valvas com volume presas pela dobradiça. Chega fechada,
// balança, a valva de cima gira de verdade até ficar em pé e a pérola (com a foto da atração) sobe.
// Leve: three.js só carrega quando a etapa aparece; desenha só durante a abertura (~3 s) e para.
// Aparelho fraco (html.lite), movimento reduzido ou sem WebGL: usa a concha 2D (shell-pearl.tsx).

const OPEN_DEG = 96;
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
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2"));
  } catch {
    return false;
  }
}

export function ShellPearl3D({ src, active }: { src: string; active: boolean }) {
  const [mode, setMode] = useState<"3d" | "2d" | null>(null);
  const holder = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // decide no navegador (o servidor não sabe se há WebGL)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- escolha única depois de montar
    setMode(webglOk() ? "3d" : "2d");
  }, []);

  useEffect(() => {
    if (mode !== "3d" || !active || !holder.current) return;
    const el = holder.current;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { valve, valveRim, shellMaterials, photoPearl } = await import("@/lib/sea3d");
      if (disposed) return;

      const w = el.clientWidth;
      const h = el.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;
      scene.add(new THREE.HemisphereLight(0xfff3e6, 0xb9a3e6, 0.55));
      const sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
      sun.position.set(1.5, 3, 2.5);
      scene.add(sun);
      const glow = new THREE.PointLight(0xffe3b2, 0, 3);
      glow.position.set(0, 0.45, 0.45);
      scene.add(glow);

      const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
      camera.position.set(0, 1.25, 3.7);
      camera.lookAt(0, 0.5, 0.1);

      const mats = shellMaterials(THREE);
      const shell = new THREE.Group();
      const bottom = valve(THREE, -1, mats);
      bottom.add(valveRim(THREE, { sign: -1 }));
      const top = valve(THREE, 1, mats);
      top.add(valveRim(THREE, { sign: 1 }));
      const hinge = new THREE.Group(); // gira em volta da dobradiça (eixo X na origem)
      hinge.add(top);
      shell.add(bottom, hinge);
      shell.position.y = 0.22;
      scene.add(shell);

      const tex = await new THREE.TextureLoader().loadAsync(src).catch(() => null);
      if (disposed) return;
      if (tex) tex.colorSpace = THREE.SRGBColorSpace;
      const pearl = photoPearl(THREE, tex, 0.42);
      pearl.position.set(0, 0.22, 0.5);
      pearl.scale.setScalar(0.001);
      scene.add(pearl);

      let raf = 0;
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
        pearl.scale.setScalar(Math.max(0.001, k));
        pearl.position.y = 0.22 + 0.36 * k;
        // medalhão sempre de frente para a câmera (sem ficar torto), girando para a frente ao subir
        pearl.lookAt(camera.position);
        pearl.rotateY((1 - k) * -1.2);
        glow.intensity = 2.5 * k;
        renderer.render(scene, camera);
      };
      const frame = (now: number) => {
        const t = (now - t0) / 1000;
        draw(t);
        if (t < DURATION && !disposed) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      // só em desenvolvimento: congelar a animação num instante (testes de captura de tela)
      if (process.env.NODE_ENV !== "production") (window as unknown as { __shellAt?: (t: number) => void }).__shellAt = (t) => { cancelAnimationFrame(raf); draw(t); };

      cleanup = () => {
        cancelAnimationFrame(raf);
        scene.traverse((o) => {
          const m = o as T3Mesh;
          m.geometry?.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
          else mat?.dispose();
        });
        tex?.dispose();
        env.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    })().catch(() => setMode("2d"));

    return () => {
      disposed = true;
      cleanup();
    };
  }, [mode, active, src]);

  if (mode === "2d") return <ShellPearl src={src} />;
  return <span ref={holder} className="sand-shell sand-shell-3d" aria-hidden />;
}

type T3Mesh = { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
