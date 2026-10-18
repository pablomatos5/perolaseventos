"use client";

import { useEffect } from "react";

/**
 * Ao rolar a página, a pérola se solta da concha e cai até o mar na base do hero.
 * Quando toca a água: some e dispara o anel de "splash"; logo abaixo a praia revela as informações.
 * Rolando de volta, a pérola sobe para a concha. Clicar na pérola leva direto para a praia.
 *
 * Onde o navegador tem animação ligada à rolagem (Chrome, Safari 26+), a queda é feita pelo próprio
 * navegador (.shell-pearl.sd no CSS): anda colada na rolagem, sem tremer no celular. O JS só mede a
 * distância e liga o splash. Nos navegadores antigos, o JS move a pérola a cada quadro (como antes).
 */
export function PearlDrop() {
  useEffect(() => {
    const pearl = document.querySelector<HTMLElement>("[data-pearl]");
    const water = document.querySelector<HTMLElement>("[data-water]");
    if (!pearl || !water) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const native = typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");

    let fall = 0; // distância (px) da pérola até a linha d'água, medida com a página no topo
    let hitAt = 1; // rolagem (px) em que a pérola toca a água
    const measure = () => {
      pearl.classList.remove("sd");
      pearl.style.translate = "";
      pearl.style.scale = "";
      const p = pearl.getBoundingClientRect();
      const w = water.getBoundingClientRect();
      // para na superfície (logo abaixo da borda da água) e mergulha se dissolvendo: nunca atravessa a borda
      fall = w.top + w.height * 0.12 - (p.top + p.height / 2);
      hitAt = Math.max(1, fall / 1.35); // a pérola desce um pouco mais rápido que a rolagem
      water.style.setProperty("--splash-x", `${p.left + p.width / 2 - w.left}px`);
      if (native && fall > 0) {
        pearl.style.setProperty("--fall", `${fall.toFixed(1)}px`);
        // a queda vai até 88% da animação; os 12% finais são o mergulho (encolhe e se dissolve na superfície)
        pearl.style.setProperty("--fall-range", `${(hitAt / 0.88).toFixed(1)}px`);
        pearl.classList.add("sd");
      }
    };

    let raf = 0;
    let splashed = false;
    const update = () => {
      raf = 0;
      if (fall <= 0) return;
      const t = Math.min(1, window.scrollY / hitAt);
      const hit = t >= 1;
      if (hit !== splashed) {
        splashed = hit;
        water.classList.toggle("is-splash", hit);
      }
      if (native) return; // o navegador já move a pérola
      const eased = t * t * (3 - 2 * t); // suave no começo e no fim
      pearl.style.translate = `0 ${(eased * fall).toFixed(1)}px`;
      pearl.classList.toggle("is-sunk", hit);
      pearl.style.scale = hit ? "0.35" : String(1 - eased * 0.25);
      if (hit) pearl.style.translate = `0 ${(fall + 6).toFixed(1)}px`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };
    const toBeach = () => document.querySelector(".beach")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // espera a entrada da concha e da pérola terminar (pearl-in: 1,1 s + 1,1 s) para medir a posição final
    const timer = setTimeout(onResize, 2300);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    pearl.addEventListener("click", toBeach);
    pearl.style.cursor = "pointer";
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      pearl.removeEventListener("click", toBeach);
    };
  }, []);
  return null;
}
