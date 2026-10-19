"use client";

import { useEffect, useRef, useState } from "react";
import { prewarmShell3D, ShellPearl3D } from "./shell-pearl-3d";

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
  [14, 62, 1.5],
  [17, 50, 1.05],
  [31, 76, 1.15],
  [79, 60, 1.6],
  [89, 76, 1.1],
  [69, 82, 1.3],
  [6, 38, 0.95],
  [92, 40, 1],
] as const;

const WAVE_MS = 1800; // duração de uma ida e volta da onda (casa com @keyframes swash no CSS)
const PEAK_MS = 620; // momento em que a onda cobre a areia: é aí que a escrita troca
const DRY_MS = 5200; // areia molhada secando (casa com .drying / @keyframes wet no CSS)
const AUTO_MS = 5600; // troca automática: tempo de leitura de cada etapa
const HOLD_MS = 12000; // depois que a pessoa mexe, o automático espera este tanto
const SWIPE_PX = 40; // arrasto mínimo (dedo ou mouse) para trocar de etapa

/**
 * "Carrossel da areia": a praia ocupa uma tela e cada troca manda uma onda; no pico ela cobre a areia,
 * a escrita troca, e ao recuar revela a próxima informação (data → atrações → convite).
 * Não depende da rolagem da página (cada aparelho rola de um jeito, e isso fazia pular ou travar
 * etapas): troca sozinho a cada poucos segundos e responde a arrasto, setas, pontinhos e teclado,
 * sempre uma etapa por gesto. Só transform/opacity/clip-path; nenhum canvas.
 */
export function TideReveal({ steps }: { steps: TideStep[] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(-1); // escrita visível (-1 = areia lisa, antes da primeira onda)
  const goRef = useRef<(i: number, manual?: boolean) => void>(() => {});
  const n = steps.length;

  // concha 3D e fotos das atrações carregam enquanto a pessoa ainda está no topo: quando a praia
  // aparece, a abertura começa na hora (sem esperar baixar e montar o 3D)
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const srcs = steps.flatMap((s) => (s.imageUrl ? [s.imageUrl] : []));
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      prewarmShell3D(srcs);
    };
    const io = new IntersectionObserver(([e]) => e.isIntersecting && go(), { rootMargin: "250% 0px" });
    io.observe(section);
    const idle = window.setTimeout(go, 2500); // ou logo depois da página carregar
    return () => {
      io.disconnect();
      clearTimeout(idle);
    };
  }, [steps]);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current = -1; // etapa escrita na areia agora
    let target = -1; // etapa pedida
    let washing = false;
    let visible = false;
    let hold = 0;
    let swapTimer = 0;
    let endTimer = 0;
    let dryTimer = 0;

    const wash = () => {
      if (reduced) {
        current = target;
        setShown(target);
        stage.classList.add("is-in");
        return;
      }
      const next = target;
      // reinicia a animação da onda (remove → reflow → adiciona)
      stage.classList.remove("washing", "drying");
      void stage.offsetWidth;
      stage.classList.add("washing", "erasing", "drying");
      washing = true;
      clearTimeout(swapTimer);
      clearTimeout(endTimer);
      clearTimeout(dryTimer);
      dryTimer = window.setTimeout(() => stage.classList.remove("drying"), DRY_MS);
      swapTimer = window.setTimeout(() => {
        stage.classList.remove("erasing");
        current = next;
        setShown(next);
        stage.classList.add("is-in"); // libera as pérolas na areia depois da primeira maré
      }, PEAK_MS);
      endTimer = window.setTimeout(() => {
        washing = false;
        stage.classList.remove("washing");
        // pediram outra etapa enquanto a onda voltava: manda mais uma (direto para a pedida)
        if (target !== current) wash();
      }, WAVE_MS);
    };

    const go = (i: number, manual = false) => {
      if (manual) hold = Date.now() + HOLD_MS;
      target = ((i % n) + n) % n;
      if (target !== current && !washing) wash();
    };
    goRef.current = go;
    const step = (dir: 1 | -1) => go((washing ? target : current) + dir, true);

    // primeira onda quando a praia aparece; o automático só anda com ela na tela
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && current < 0 && !washing) go(0);
      },
      { threshold: 0.45 },
    );
    io.observe(stage);
    const auto = window.setInterval(() => {
      if (!visible || washing || document.hidden || Date.now() < hold || current < 0) return;
      go(current + 1);
    }, AUTO_MS);

    // arrastar para o lado: dedo (touch) ou mouse; rolagem vertical da página continua livre
    let sx = 0;
    let sy = 0;
    let tracking = false;
    const start = (x: number, y: number) => {
      sx = x;
      sy = y;
      tracking = true;
    };
    const end = (x: number, y: number) => {
      if (!tracking) return;
      tracking = false;
      const dx = x - sx;
      const dy = y - sy;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) step(dx < 0 ? 1 : -1);
    };
    const ts = (e: TouchEvent) => start(e.touches[0].clientX, e.touches[0].clientY);
    const te = (e: TouchEvent) => end(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    const pd = (e: PointerEvent) => e.pointerType === "mouse" && start(e.clientX, e.clientY);
    const pu = (e: PointerEvent) => e.pointerType === "mouse" && end(e.clientX, e.clientY);
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    stage.addEventListener("touchstart", ts, { passive: true });
    stage.addEventListener("touchend", te, { passive: true });
    stage.addEventListener("pointerdown", pd);
    stage.addEventListener("pointerup", pu);
    section.addEventListener("keydown", key);
    return () => {
      io.disconnect();
      clearInterval(auto);
      clearTimeout(swapTimer);
      clearTimeout(endTimer);
      clearTimeout(dryTimer);
      stage.removeEventListener("touchstart", ts);
      stage.removeEventListener("touchend", te);
      stage.removeEventListener("pointerdown", pd);
      stage.removeEventListener("pointerup", pu);
      section.removeEventListener("keydown", key);
    };
  }, [n]);

  const at = Math.max(shown, 0);
  return (
    <section ref={sectionRef} className="tide" aria-roledescription="carrossel" aria-label="Informações do evento e atrações">
      <div ref={stageRef} className="beach tide-stage">
        <div className="beach-sand" />
        <div className="beach-wet" />
        <Footsteps />

        {steps.map((s, i) => (
          <div key={s.key} className={`tide-writing ${i === shown ? "is-active" : ""}`} aria-hidden={i !== shown}>
            {s.imageUrl && <ShellPearl3D src={s.imageUrl} active={i === shown} />}
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
            {s.small?.map((t) =>
              t.startsWith("@") ? (
                <p key={t} className="sand-small">
                  <a href={`https://www.instagram.com/${t.slice(1)}/`} target="_blank" rel="noopener noreferrer" className="sand-link" tabIndex={i === shown ? 0 : -1}>
                    {t}
                  </a>
                </p>
              ) : (
                <p key={t} className="sand-small">
                  {t}
                </p>
              ),
            )}
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

        <div className="tide-controls">
          <button type="button" className="tide-arrow" onClick={() => goRef.current(at - 1, true)} aria-label="Informação anterior">
            ‹
          </button>
          <ol className="tide-dots">
            {steps.map((s, i) => (
              <li key={s.key}>
                <button type="button" className={i === shown ? "is-on" : ""} onClick={() => goRef.current(i, true)} aria-label={`Ir para: ${s.big}`} aria-current={i === shown || undefined} />
              </li>
            ))}
          </ol>
          <button type="button" className="tide-arrow" onClick={() => goRef.current(at + 1, true)} aria-label="Próxima informação">
            ›
          </button>
        </div>

        <div className="beach-wave" aria-hidden>
          <svg className="beach-foam" viewBox="0 0 1440 120" preserveAspectRatio="none">
            {/* água rasa: língua fina e transparente que avança além da espuma */}
            <path d="M0 30 C 180 70, 360 0, 540 34 S 900 70, 1080 30 S 1320 0, 1440 34 V 70 C 1300 98, 1180 64, 1020 86 S 700 104, 520 80 S 180 96, 0 74 Z" style={{ fill: "var(--wave-edge)" }} />
            <path d="M0 74 C 180 96, 340 64, 520 80 S 880 104, 1020 86 S 1300 98, 1440 70" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
            <path d="M0 30 C 180 70, 360 0, 540 34 S 900 70, 1080 30 S 1320 0, 1440 34 V0 H0 Z" fill="url(#agua-borda)" />
            <path d="M0 30 C 180 70, 360 0, 540 34 S 900 70, 1080 30 S 1320 0, 1440 34" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="5" />
            <path d="M0 44 C 200 76, 380 14, 560 46 S 920 76, 1100 42 S 1330 14, 1440 46" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" />
            <defs>
              {/* mesma água da onda na borda (antes era uma faixa lisa) */}
              <pattern id="agua-borda" patternUnits="userSpaceOnUse" width="1440" height="720">
                <image href="/2027/agua-perto.webp" width="1440" height="720" preserveAspectRatio="none" />
              </pattern>
            </defs>
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

// Pegada de um pé direito humano (dedos para cima, dedão à esquerda): calcanhar, arco fino no lado
// de dentro, planta larga e cinco dedos separados, do dedão ao mindinho.
const SOLE =
  "M30 36C43 34 51 44 50 58C49 72 45 84 44 96C43 108 45 120 39 130C34 138 21 138 18 128C15 118 19 108 23 98C26 90 31 84 29 76C27 68 12 66 11 55C10 43 19 37 30 36Z";
const TOES = [
  [14, 25, 6.4, 8.4, -8],
  [26.5, 21, 4.1, 5, 0],
  [35.5, 23, 3.7, 4.5, 6],
  [43, 28.5, 3.3, 4, 14],
  [48.5, 36, 2.9, 3.5, 24],
] as const;

/** Uma pegada marcada na areia, no canto da praia. Decorativa. */
function Footsteps() {
  return (
    <svg className="beach-steps" viewBox="0 0 60 140" aria-hidden>
      <path d={SOLE} />
      {TOES.map(([cx, cy, rx, ry, rot]) => (
        <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} />
      ))}
    </svg>
  );
}
