"use client";

import { useEffect, useRef, useState } from "react";

export type TideStep = {
  key: string;
  eyebrow?: string;
  big: string;
  small?: string[];
  mystery?: boolean; // atração ainda não anunciada: pérola com "?"
  imageUrl?: string; // foto da atração num medalhão "afundado" na areia
  cta?: { label: string; href: string };
};

// [esquerda %, topo %, tamanho rem]: deixadas pela maré, fora do texto central
const SAND_PEARLS = [
  [9, 72, 1.5],
  [17, 52, 1.05],
  [26, 80, 1.15],
  [79, 60, 1.6],
  [89, 76, 1.1],
  [69, 82, 1.3],
  [6, 38, 0.95],
  [92, 40, 1],
] as const;

const WAVE_MS = 1800; // duração de uma ida e volta da onda (casa com @keyframes swash no CSS)
const PEAK_MS = 620; // momento em que a onda cobre a areia: é aí que a escrita troca

/**
 * "Maré de atrações": a praia fica fixa na tela enquanto a seção rola. Cada trecho de rolagem
 * manda uma onda; no pico ela cobre a areia, a escrita troca, e ao recuar revela a próxima
 * informação (data → atrações → convite). Só transform/opacity/clip-path; nenhum canvas.
 */
export function TideReveal({ steps }: { steps: TideStep[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(-1); // escrita visível (-1 = areia lisa, antes da primeira onda)
  const target = useRef(-1); // etapa pedida pela rolagem
  const current = useRef(-1); // etapa escrita na areia agora
  const washing = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let swapTimer = 0;
    let endTimer = 0;

    const wash = () => {
      if (reduced) {
        current.current = target.current;
        setShown(target.current);
        stage.classList.add("is-in");
        return;
      }
      // reinicia a animação da onda (remove → reflow → adiciona)
      stage.classList.remove("washing");
      void stage.offsetWidth;
      stage.classList.add("washing");
      washing.current = true;
      clearTimeout(swapTimer);
      clearTimeout(endTimer);
      swapTimer = window.setTimeout(() => {
        current.current = target.current;
        setShown(target.current);
        stage.classList.add("is-in"); // libera as pérolas na areia depois da primeira maré
      }, PEAK_MS);
      endTimer = window.setTimeout(() => {
        washing.current = false;
        stage.classList.remove("washing");
        // rolou de novo enquanto a onda voltava: manda outra
        if (target.current !== current.current) wash();
      }, WAVE_MS);
    };

    const update = () => {
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // a praia "acorda" quando metade dela entra na tela
      if (r.top > vh * 0.5) return;
      const scrollable = Math.max(1, r.height - vh);
      const p = Math.min(0.999, Math.max(0, -r.top / scrollable));
      const idx = Math.floor(p * steps.length);
      if (idx === target.current) return;
      target.current = idx;
      if (!washing.current) wash();
    };

    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          update();
        });
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
      clearTimeout(swapTimer);
      clearTimeout(endTimer);
    };
  }, [steps.length]);

  return (
    // altura = 1 tela de praia + ~70% de tela de rolagem por etapa
    <section ref={sectionRef} className="tide" style={{ height: `calc(100svh + ${steps.length * 70}svh)` }} aria-label="Informações do evento e atrações">
      <div ref={stageRef} className="beach tide-stage">
        <div className="beach-wet" />

        {steps.map((s, i) => (
          <div key={s.key} className={`tide-writing ${i === shown ? "is-active" : ""}`} aria-hidden={i !== shown}>
            {s.imageUrl && (
              <span className="sand-photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto em /public, já otimizada */}
                <img src={s.imageUrl} alt="" loading="lazy" />
              </span>
            )}
            {s.eyebrow && <p className="sand-eyebrow">{s.eyebrow}</p>}
            {s.mystery ? (
              <p className="sand-mystery">
                <span className="pearl" />
                <span className="sand-big">?</span>
              </p>
            ) : (
              <p className={`sand-big ${s.big.length > 12 ? "is-long" : s.big.length > 5 ? "is-name" : ""}`}>{s.big}</p>
            )}
            {s.mystery && <p className="sand-small">{s.big}</p>}
            {s.small?.map((t) => (
              <p key={t} className="sand-small">
                {t}
              </p>
            ))}
            {s.cta && (
              <a href={s.cta.href} className="btn solid mt-6" tabIndex={i === shown ? 0 : -1}>
                {s.cta.label}
              </a>
            )}
          </div>
        ))}

        {SAND_PEARLS.map(([left, top, size]) => (
          <span
            key={`${left}-${top}`}
            className="beach-pearl"
            style={
              {
                left: `${left}%`,
                top: `${top}%`,
                width: `${size}rem`,
                // a maré recua de baixo para cima: pérola mais baixa aparece primeiro
                "--pd": `${(0.2 + (1 - top / 100) * 1.2).toFixed(2)}s`,
                // cintilar fora de sincronia entre as pérolas
                "--sd": `${((left * 7 + top * 3) % 40) / 10}s`,
                "--st": `${(2 + ((left + top) % 9) / 6).toFixed(2)}s`,
              } as React.CSSProperties
            }
          />
        ))}

        <ol className="tide-dots" aria-hidden>
          {steps.map((s, i) => (
            <li key={s.key} className={i === shown ? "is-on" : ""} />
          ))}
        </ol>

        <div className="beach-wave" aria-hidden>
          <svg className="beach-foam" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <path d="M0 30 C 180 70, 360 0, 540 34 S 900 70, 1080 30 S 1320 0, 1440 34 V0 H0 Z" fill="var(--wave-body)" />
            <path d="M0 30 C 180 70, 360 0, 540 34 S 900 70, 1080 30 S 1320 0, 1440 34" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="5" />
            <path d="M0 44 C 200 76, 380 14, 560 46 S 920 76, 1100 42 S 1330 14, 1440 46" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" />
          </svg>
        </div>
      </div>

      {/* leitores de tela recebem tudo de uma vez, sem depender da animação */}
      <ul className="sr-only">
        {steps.map((s) => (
          <li key={s.key}>{[s.eyebrow, s.big, ...(s.small ?? [])].filter(Boolean).join(" · ")}</li>
        ))}
      </ul>
    </section>
  );
}
