"use client";

import { useEffect } from "react";

/**
 * Um mar só: todas as faixas de água (horizonte do topo, ondas do topo, faixa da praia e a onda que vai e vem)
 * usam a mesma ilustração (/2027/agua.webp) e este script alinha a posição vertical de cada uma pela distância
 * até a linha do horizonte, para a água continuar de uma faixa para a outra sem emenda.
 */
export function AguaContinua() {
  useEffect(() => {
    const strip = document.querySelector<HTMLElement>(".sea-strip");
    const waves = document.querySelector<HTMLElement>(".hero-2027 .ocean-waves");
    const beach = document.querySelector<HTMLElement>(".beach");
    const wave = document.querySelector<HTMLElement>(".beach-wave");
    if (!strip || !waves || !beach || !wave) return;
    const measure = () => {
      const y0 = strip.getBoundingClientRect().top + scrollY;
      const wTop = waves.getBoundingClientRect().top + scrollY;
      const heroWater = waves.getBoundingClientRect().bottom + scrollY - y0;
      document.documentElement.style.setProperty("--agua-ondas", `${-(wTop - y0)}px`);
      // praia: a faixa fixa continua de onde o topo parou; a onda (deslocada -91% em repouso) segue a faixa
      const stripH = beach.clientHeight * 0.09;
      beach.style.setProperty("--agua-praia", `${-heroWater}px`);
      // onda: água de perto (linhas 260–760 da ilustração, espelhadas); a borda em repouso continua o mar do topo
      wave.style.setProperty("--agua-onda", `${wave.clientHeight * 0.91 - (heroWater - 260)}px`);
      beach.style.setProperty("--agua-faixa", `${stripH}px`);
      // borda da onda (SVG esticado): mesma água de perto, continuando o corpo da onda sem degrau
      const foam = wave.querySelector<SVGSVGElement>(".beach-foam");
      const pat = foam?.querySelector("pattern");
      const img = pat?.querySelector("image");
      if (foam && pat && img) {
        const sx = foam.clientWidth / 1440;
        const sy = foam.clientHeight / 120;
        const w = 2400 / sx;
        const h = 1000 / sy;
        const off = wave.clientHeight * 0.91 - (heroWater - 260) - wave.clientHeight; // topo do ladrilho, relativo ao fim da onda
        const fl = (wave.clientWidth - foam.clientWidth) / 2; // svg é 110% da onda, centrado
        for (const [k, v] of [["width", w], ["height", h]] as const) {
          pat.setAttribute(k, String(v));
          img.setAttribute(k, String(v));
        }
        pat.setAttribute("x", String(((wave.clientWidth - 2400) / 2 - fl) / sx));
        pat.setAttribute("y", String(off / sy));
      }
    };
    measure();
    addEventListener("resize", measure);
    const t = setTimeout(measure, 1500);
    return () => {
      removeEventListener("resize", measure);
      clearTimeout(t);
    };
  }, []);
  return null;
}
