"use client";

import { useEffect, useRef } from "react";
import { sponsors2026 } from "@/content/site";

type Sponsor = (typeof sponsors2026)[number];

const COPIES = 3; // 3 cópias: dá para arrastar para os dois lados e "dar a volta" sem emenda
const SPEED = 38; // px por segundo
const HOLD_MS = 2500; // depois de mexer, volta a girar sozinho

function SponsorTile({ s, hidden }: { s: Sponsor; hidden?: boolean }) {
  const inner = (
    <>
      <span className={`sponsor-art ${s.light ? "is-light" : ""} ${s.image ? "" : "is-text"}`}>
        {s.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- recorte já otimizado em /public
          <img src={s.image} alt="" width={352} height={176} loading="lazy" decoding="async" draggable={false} />
        ) : (
          <span className="font-display text-3xl leading-tight italic">{s.name}</span>
        )}
      </span>
      <span className="mt-3 block font-display text-xl italic">{s.name}</span>
      {s.instagram && <span className="block text-xs tracking-wide text-fg-faint">@{s.instagram}</span>}
    </>
  );
  // cópias da faixa (para o loop sem emenda) ficam fora do Tab e dos leitores de tela
  const a11y = hidden ? { tabIndex: -1, "aria-hidden": true as const } : {};
  return s.instagram ? (
    <a href={`https://www.instagram.com/${s.instagram}/`} target="_blank" rel="noopener noreferrer" className="sponsor-tile" draggable={false} {...a11y}>
      {inner}
    </a>
  ) : (
    <div className="sponsor-tile" {...a11y}>
      {inner}
    </div>
  );
}

/**
 * Patrocinadores numa faixa que gira sozinha e também pode ser arrastada (dedo, roda do mouse ou
 * clicar e arrastar no computador). Depois de mexer, volta a girar em 2,5 s. As 3 cópias da lista
 * deixam "dar a volta" para os dois lados: passou de uma cópia inteira, pula de volta sem aparecer.
 */
export function SponsorCarousel() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let hold = 0;
    let hover = false;
    let pos = 0;
    let raf = 0;
    let last = 0;
    const copy = () => el.scrollWidth / COPIES;

    // começa na cópia do meio
    pos = copy();
    el.scrollLeft = pos;

    const wrap = () => {
      const w = copy();
      if (!w) return;
      if (el.scrollLeft >= 2 * w) el.scrollLeft -= w;
      else if (el.scrollLeft <= 1) el.scrollLeft += w;
    };
    const onScroll = () => {
      wrap();
      if (Date.now() < hold) pos = el.scrollLeft; // a pessoa mexeu: o giro continua de onde ela parou
    };
    const touch = () => (hold = Date.now() + HOLD_MS);

    // arrastar com o mouse (no celular o dedo já rola a faixa nativamente)
    let dragX = 0;
    let dragStart = 0;
    let moved = false;
    const down = (e: PointerEvent) => {
      touch();
      if (e.pointerType !== "mouse") return;
      dragX = e.clientX;
      dragStart = el.scrollLeft;
      moved = false;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - dragX;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = dragStart - dx;
      touch();
    };
    const up = (e: PointerEvent) => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    // depois de arrastar, o clique não abre o Instagram do patrocinador
    const click = (e: MouseEvent) => {
      if (moved) {
        e.preventDefault();
        moved = false;
      }
    };

    const tick = (t: number) => {
      if (!visible) {
        raf = 0;
        last = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(64, t - last) : 0;
      last = t;
      if (reduced || hover || document.hidden || Date.now() < hold) return;
      pos += (SPEED * dt) / 1000;
      const w = copy();
      if (w && pos >= 2 * w) pos -= w;
      el.scrollLeft = pos; // posição em ponto flutuante: anda liso mesmo com passos menores que 1 px
    };
    // fora da tela o laço para de vez (nada rodando por quadro à toa, principalmente no celular)
    let visible = false;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    io.observe(el);

    const enter = () => (hover = true);
    const leave = () => (hover = false);
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", touch, { passive: true });
    el.addEventListener("wheel", touch, { passive: true });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("click", click, true);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    el.addEventListener("focusin", enter);
    el.addEventListener("focusout", leave);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", touch);
      el.removeEventListener("wheel", touch);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("click", click, true);
      el.removeEventListener("mouseenter", enter);
      el.removeEventListener("mouseleave", leave);
      el.removeEventListener("focusin", enter);
      el.removeEventListener("focusout", leave);
    };
  }, []);

  const loop = Array.from({ length: COPIES }, (_, copy) => sponsors2026.map((s) => ({ s, copy }))).flat();
  return (
    <div ref={ref} className="sponsor-marquee">
      <ul className="sponsor-track" aria-label="Patrocinadores">
        {loop.map(({ s, copy }) => (
          <li key={`${copy}-${s.name}`}>
            <SponsorTile s={s} hidden={copy !== 1} />
          </li>
        ))}
      </ul>
    </div>
  );
}
