"use client";

import { useEffect, useRef } from "react";

export type TrailItem = { id: string; title: string; description: string; icon: React.ReactNode };

/**
 * "Uma noite para colecionar" em movimento: uma pérola desce por um fio dourado conforme a rolagem.
 * Quando ela passa por um item, o aro do ícone acende, o ícone se desenha e o texto entra; rolando de
 * volta, recolhe. Só transform/opacity/stroke-dashoffset, atualizado num rAF por evento de rolagem.
 */
export function PerkTrail({ items }: { items: TrailItem[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const pearl = root.querySelector<HTMLElement>(".trail-pearl")!;
    const fill = root.querySelector<HTMLElement>(".trail-fill")!;
    const stops = [...root.querySelectorAll<HTMLElement>(".trail-item")];
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stops.forEach((s) => s.classList.add("is-on"));
      return;
    }

    // centro de cada ícone (px a partir do topo da trilha), recalculado ao redimensionar
    let centers: number[] = [];
    let height = 1;
    const measure = () => {
      height = root.offsetHeight || 1;
      const top = root.getBoundingClientRect().top;
      centers = stops.map((s) => {
        const r = s.querySelector<HTMLElement>(".trail-icon")!.getBoundingClientRect();
        return r.top - top + r.height / 2;
      });
    };

    let raf = 0;
    const update = () => {
      raf = 0;
      const top = root.getBoundingClientRect().top;
      // a pérola fica a 62% da altura da tela; a trilha "anda" por baixo dela
      const y = Math.min(Math.max(innerHeight * 0.62 - top, 0), height);
      pearl.style.transform = `translate3d(-50%, ${y.toFixed(1)}px, 0)`;
      fill.style.transform = `scaleY(${(y / height).toFixed(4)})`;
      stops.forEach((s, i) => s.classList.toggle("is-on", y >= centers[i] - 8));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div ref={ref} className="trail">
      <div className="trail-line" aria-hidden>
        <div className="trail-fill" />
      </div>
      <div className="trail-pearl" aria-hidden />
      <ol>
        {items.map((it, i) => (
          <li key={it.id} className="trail-item">
            <span className="trail-icon">{it.icon}</span>
            <div className="trail-text">
              <span className="perk-num">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-2xl leading-tight md:text-[2rem]">{it.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted md:text-base">{it.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
