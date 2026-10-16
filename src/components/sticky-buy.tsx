"use client";

import { useEffect, useState } from "react";

/**
 * Botão "Comprar ingresso" fixo no rodapé da tela. Aparece quando o botão do hero sai de vista
 * e some enquanto a própria seção de ingressos está na tela.
 */
export function StickyBuy() {
  const [heroGone, setHeroGone] = useState(false);
  const [atTickets, setAtTickets] = useState(false);

  useEffect(() => {
    const hero = document.querySelector("[data-hero-cta]");
    const tickets = document.getElementById("ingressos");
    const observers: IntersectionObserver[] = [];
    if (hero) {
      const io = new IntersectionObserver(([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0));
      io.observe(hero);
      observers.push(io);
    }
    if (tickets) {
      const io = new IntersectionObserver(([e]) => setAtTickets(e.isIntersecting), { threshold: 0.05 });
      io.observe(tickets);
      observers.push(io);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const show = heroGone && !atTickets;
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 transition-all duration-500 md:justify-end md:p-6 ${show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <a href="#ingressos" className="btn solid w-full max-w-sm md:w-auto" tabIndex={show ? 0 : -1}>
        Garantir meu ingresso
      </a>
    </div>
  );
}
