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
    let armed = false; // queda já ligada (não esperar o tempo fixo se a pessoa rolar antes)
    const measure = () => {
      // mede a posição de REPOUSO da pérola mesmo com a animação de entrada ainda rodando:
      // congela a entrada por um instante (layout puro, sem o transform da animação) e lê a caixa.
      const anim = pearl.style.animation;
      pearl.style.animation = "none";
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
        pearl.style.animation = ""; // devolve o controle ao CSS: a classe .sd faz a queda pela rolagem
        pearl.classList.add("sd");
      } else {
        pearl.style.animation = anim; // caminho JS (navegador antigo): restaura a entrada
      }
      armed = true;
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
      if (native) return; // o navegador já move a pérola (queda colada na rolagem, no compositor)
      pearl.style.animation = "none"; // caminho JS: desliga a entrada para o translate inline valer
      const eased = t * t * (3 - 2 * t); // suave no começo e no fim
      pearl.style.translate = `0 ${(eased * fall).toFixed(1)}px`;
      pearl.classList.toggle("is-sunk", hit);
      pearl.style.scale = hit ? "0.35" : String(1 - eased * 0.25);
      if (hit) pearl.style.translate = `0 ${(fall + 6).toFixed(1)}px`;
    };
    const onScroll = () => {
      // liga a queda já na primeira rolagem, sem esperar o tempo fixo da entrada (antes a pérola
      // ficava travada até ~2,3 s, ainda mais sob o carregamento inicial)
      if (!armed) measure();
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };
    const toBeach = () => document.querySelector(".beach")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // se a pessoa não rolar, mede a posição final quando a entrada da pérola termina (rise-sun: 0,4 s + 2,2 s);
    // se rolar antes, onScroll já ligou a queda na hora (sem esperar)
    const timer = setTimeout(onResize, 2600);
    window.addEventListener("scroll", onScroll, { passive: true });
    // se a pessoa já rolou durante o carregamento (antes deste efeito montar), liga a queda na hora
    if (window.scrollY > 0) onScroll();
    // celular: a barra de endereço aparece/some na rolagem e dispara "resize" só de altura; ignora
    let lastW = innerWidth;
    const onWidth = () => {
      if (innerWidth === lastW) return;
      lastW = innerWidth;
      onResize();
    };
    window.addEventListener("resize", onWidth);
    pearl.addEventListener("click", toBeach);
    pearl.style.cursor = "pointer";
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onWidth);
      pearl.removeEventListener("click", toBeach);
    };
  }, []);
  return null;
}
