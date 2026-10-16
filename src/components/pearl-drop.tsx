"use client";

import { useEffect } from "react";

/**
 * Ao rolar a página, a pérola se solta da concha e cai até o mar na base do hero.
 * Quando toca a água: some e dispara o anel de "splash"; logo abaixo a praia revela as informações.
 * Rolando de volta, a pérola sobe para a concha. Só transform/opacity, atualizado num rAF por evento de scroll.
 * Clicar na pérola leva direto para a praia.
 */
export function PearlDrop() {
  useEffect(() => {
    const pearl = document.querySelector<HTMLElement>("[data-pearl]");
    const water = document.querySelector<HTMLElement>("[data-water]");
    if (!pearl || !water) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let fall = 0; // distância (px) da pérola até a linha d'água, medida com a página no topo
    const measure = () => {
      pearl.style.translate = "";
      const p = pearl.getBoundingClientRect();
      const w = water.getBoundingClientRect();
      fall = w.top + w.height * 0.42 - (p.top + p.height / 2);
      water.style.setProperty("--splash-x", `${p.left + p.width / 2 - w.left}px`);
    };

    let raf = 0;
    let splashed = false;
    const update = () => {
      raf = 0;
      if (fall <= 0) return;
      // A pérola desce um pouco mais rápido que a rolagem: na tela ela "cai" de encontro ao mar que sobe.
      const t = Math.min(1, (window.scrollY * 1.35) / fall);
      const eased = t * t * (3 - 2 * t); // suave no começo e no fim
      const hit = t >= 1;
      pearl.style.translate = `0 ${(eased * fall).toFixed(1)}px`;
      // ao tocar a água: afunda (desce mais um pouco, encolhe e some com transição suave no CSS)
      pearl.classList.toggle("is-sunk", hit);
      pearl.style.scale = hit ? "0.35" : String(1 - eased * 0.25);
      if (hit) pearl.style.translate = `0 ${(fall + 18).toFixed(1)}px`;
      if (hit !== splashed) {
        splashed = hit;
        water.classList.toggle("is-splash", hit);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };
    const toBeach = () => document.querySelector(".beach")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // espera a entrada da concha terminar para medir a posição final da pérola
    const timer = setTimeout(onResize, 1600);
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
