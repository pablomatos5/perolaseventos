"use client";

import { useEffect } from "react";

/**
 * Um mar só: todas as faixas de água (horizonte do topo, ondas do topo, faixa da praia, a onda que vai e vem e a
 * borda dela) usam a mesma textura (/2027/agua-perto.webp, ladrilho de 1000 px que se repete na vertical).
 * Este script ancora o ladrilho no topo do horizonte, para a água continuar de uma faixa para a outra sem emenda.
 */
export function AguaContinua() {
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>(".sea-strip");
    const waves = document.querySelector<HTMLElement>(".hero-2027 .ocean-waves");
    const beach = document.querySelector<HTMLElement>(".beach");
    const wave = document.querySelector<HTMLElement>(".beach-wave");
    if (!strip || !waves || !beach || !wave) return;
    const measure = () => {
      const top = (el: Element) => el.getBoundingClientRect().top + scrollY;
      const y0 = top(strip);
      const beachTop = top(beach);
      const waveTop = beachTop - wave.clientHeight * 0.91; // onda em repouso (translateY(-91%))
      document.documentElement.style.setProperty("--agua-ondas", `${y0 - top(waves)}px`);
      beach.style.setProperty("--agua-praia", `${y0 - beachTop}px`);
      wave.style.setProperty("--agua-onda", `${y0 - waveTop}px`);
      // borda da onda (SVG esticado): o mesmo ladrilho, continuando o corpo da onda
      const foam = wave.querySelector<SVGSVGElement>(".beach-foam");
      const pat = foam?.querySelector("pattern");
      const img = pat?.querySelector("image");
      if (foam && pat && img) {
        const sx = foam.clientWidth / 1440;
        const sy = foam.clientHeight / 120;
        for (const [k, v] of [["width", 2400 / sx], ["height", 1000 / sy]] as const) {
          pat.setAttribute(k, String(v));
          img.setAttribute(k, String(v));
        }
        const fl = (wave.clientWidth - foam.clientWidth) / 2; // svg tem 110% da largura da onda, centrado
        pat.setAttribute("x", String(((wave.clientWidth - 2400) / 2 - fl) / sx));
        pat.setAttribute("y", String((y0 - (waveTop + wave.clientHeight)) / sy));
      }
    };
    measure();
    // celular: a barra de endereço aparece/some na rolagem e dispara "resize" só de altura; ignora
    let lastW = innerWidth;
    const onWidth = () => {
      if (innerWidth === lastW) return;
      lastW = innerWidth;
      measure();
    };
    addEventListener("resize", onWidth);
    const t = setTimeout(measure, 1500);
    return () => {
      removeEventListener("resize", onWidth);
      clearTimeout(t);
    };
  }, []);
  return null;
}
