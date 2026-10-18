"use client";

import { useEffect, useRef, useState } from "react";
import { PLAYING_EVENT } from "@/components/attraction-cards";
import { pastVideos } from "@/content/site";
import { Bubbles } from "@/components/sea-decor";

/**
 * "Quem viveu, conta": vídeos da edição passada em formato de story, cada um com um relato por cima.
 * Carrossel: arrasta com o dedo (scroll-snap), setas e pontinhos, e passa sozinho a cada poucos segundos.
 * Para enquanto a pessoa mexe nele e enquanto um vídeo está com som.
 * Leve no celular: preload="none", só toca (mudo) o vídeo que está quase todo visível e pausa o resto;
 * tocar no vídeo liga o som dele e muta os outros. Sem animação: vira rolagem manual e nada toca sozinho.
 */
// largura de um card + espaço entre eles
function stepPx(rail: HTMLElement) {
  const li = rail.querySelector("li");
  return li ? li.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || "0") : 0;
}

/** Anda um card; no fim volta ao começo (e vice-versa). */
function go(rail: HTMLElement, dir: 1 | -1) {
  const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4;
  if (dir === 1 && atEnd) rail.scrollTo({ left: 0, behavior: "smooth" });
  else if (dir === -1 && rail.scrollLeft <= 4) rail.scrollTo({ left: rail.scrollWidth, behavior: "smooth" });
  else rail.scrollBy({ left: dir * stepPx(rail), behavior: "smooth" });
}

export function PastEditions() {
  const [soundOn, setSoundOn] = useState<number | null>(null);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const railRef = useRef<HTMLUListElement>(null);
  const holdUntil = useRef(0); // pausa o automático até este instante (a pessoa está mexendo)
  const [active, setActive] = useState(0);
  const soundRef = useRef<number | null>(null);
  useEffect(() => {
    soundRef.current = soundOn;
  }, [soundOn]);

  const nudge = (dir: 1 | -1) => {
    holdUntil.current = Date.now() + 8000;
    if (railRef.current) go(railRef.current, dir);
  };

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const hold = () => (holdUntil.current = Date.now() + 8000);
    const onScroll = () => {
      const step = stepPx(rail);
      if (step) setActive(Math.min(pastVideos.length - 1, Math.round(rail.scrollLeft / step)));
    };
    rail.addEventListener("pointerdown", hold);
    rail.addEventListener("touchstart", hold, { passive: true });
    rail.addEventListener("wheel", hold, { passive: true });
    rail.addEventListener("scroll", onScroll, { passive: true });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = reduced
      ? 0
      : window.setInterval(() => {
          if (document.hidden || soundRef.current !== null || Date.now() < holdUntil.current) return;
          const r = rail.getBoundingClientRect();
          if (r.bottom < 0 || r.top > innerHeight) return; // fora da tela: não anda
          go(rail, 1);
        }, 3800);
    return () => {
      clearInterval(timer);
      rail.removeEventListener("pointerdown", hold);
      rail.removeEventListener("touchstart", hold);
      rail.removeEventListener("wheel", hold);
      rail.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    // modo leve (aparelho fraco) ou movimento reduzido: nada toca sozinho
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio >= 0.75 && !reduced) v.play().catch(() => {});
          else if (!e.isIntersecting || e.intersectionRatio < 0.5) {
            // saiu da tela: para e tira o som (ao voltar, recomeça mudo)
            v.pause();
            if (!v.muted) {
              v.muted = true;
              setSoundOn(null);
            }
          }
        }
      },
      { threshold: [0, 0.5, 0.75, 1] },
    );
    refs.current.forEach((v) => v && io.observe(v));
    // outro vídeo do site começou com som: estes ficam mudos
    const onOther = (e: Event) => {
      if (refs.current.includes((e as CustomEvent).detail)) return;
      refs.current.forEach((v) => v && (v.muted = true));
      setSoundOn(null);
    };
    // trocou de aba / bloqueou o celular: pausa tudo
    const onHide = () => {
      if (!document.hidden) return;
      refs.current.forEach((v) => v?.pause());
    };
    window.addEventListener(PLAYING_EVENT, onOther);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      io.disconnect();
      window.removeEventListener(PLAYING_EVENT, onOther);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  function toggleSound(i: number) {
    const next = soundOn === i ? null : i;
    refs.current.forEach((v, k) => {
      if (!v) return;
      v.muted = k !== next;
      if (k === next) {
        window.dispatchEvent(new CustomEvent(PLAYING_EVENT, { detail: v })); // cala os outros vídeos do site
        v.play().catch(() => {});
      }
    });
    setSoundOn(next);
  }

  return (
    <section className="cv-auto relative py-16 md:py-22" aria-labelledby="edicoes-titulo">
      <Bubbles />
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <span className="eyebrow rule">Réveillon 2026 · 5ª edição</span>
        <h2 id="edicoes-titulo" className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
          Quem viveu, <em>conta</em>
        </h2>
        <p className="mt-4 max-w-xl text-fg-muted">Um pouco da última virada, direto do nosso Instagram. Toque no vídeo para ouvir.</p>
      </div>

      <div className="mt-10">
        <ul ref={railRef} className="story-rail" aria-label="Vídeos da edição 2026">
          {pastVideos.map((v, i) => (
            <li key={v.src}>
              <figure className="story-card">
                <video
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  src={v.src}
                  poster={v.poster}
                  muted
                  loop
                  playsInline
                  preload="none"
                  className="story-video"
                  aria-label={v.alt}
                />
                <button
                  type="button"
                  className="story-hit"
                  onClick={() => toggleSound(i)}
                  aria-pressed={soundOn === i}
                  aria-label={soundOn === i ? "Desligar o som" : "Ligar o som"}
                >
                  <span className="story-sound" aria-hidden>
                    {soundOn === i ? "🔊" : "🔇"}
                  </span>
                </button>
                {v.quote && (
                  <figcaption className="story-caption">
                    <blockquote className="font-display text-xl leading-snug italic md:text-2xl">“{v.quote}”</blockquote>
                    <span className="mt-2 block text-[0.65rem] uppercase tracking-[0.22em] text-white/70">
                      {v.author} · {v.role}
                    </span>
                  </figcaption>
                )}
              </figure>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-4 flex w-full max-w-6xl items-center justify-between px-5 md:px-8">
          <div className="story-dots" aria-hidden>
            {pastVideos.map((v, i) => (
              <i key={v.src} className={i === active ? "is-on" : ""} />
            ))}
          </div>
          <div className="story-nav">
            <button type="button" onClick={() => nudge(-1)} aria-label="Vídeo anterior">
              ‹
            </button>
            <button type="button" onClick={() => nudge(1)} aria-label="Próximo vídeo">
              ›
            </button>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-6 w-full max-w-6xl px-5 text-xs text-fg-faint md:px-8">
        Vídeos:{" "}
        <a className="underline-offset-4 hover:underline" href="https://www.instagram.com/perolaseventos/reels/" target="_blank" rel="noopener noreferrer">
          @perolaseventos
        </a>
      </p>
    </section>
  );
}
