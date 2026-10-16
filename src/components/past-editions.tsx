"use client";

import { useEffect, useRef, useState } from "react";
import { PLAYING_EVENT } from "@/components/attraction-cards";
import { pastVideos } from "@/content/site";
import { Bubbles } from "@/components/sea-decor";

/**
 * "Quem viveu, conta": vídeos da edição passada em formato de story, cada um com um relato por cima.
 * Faixa sempre girando, como a dos patrocinadores: a lista aparece 2x e anda -50% em loop, então o fim
 * encaixa no começo sem salto. Para com o mouse em cima, com foco ou com o som de um vídeo ligado.
 * Leve no celular: preload="none", só toca (mudo) o vídeo que está quase todo visível e pausa o resto;
 * tocar no vídeo liga o som dele e muta os outros. Sem animação: vira rolagem manual e nada toca sozinho.
 */
export function PastEditions() {
  const [soundOn, setSoundOn] = useState<number | null>(null);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const loop = [0, 1].flatMap((copy) => pastVideos.map((v) => ({ v, copy })));

  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    <section className="relative py-20 md:py-28" aria-labelledby="edicoes-titulo">
      <Bubbles />
      <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
        <span className="eyebrow rule">Réveillon 2026 · 5ª edição</span>
        <h2 id="edicoes-titulo" className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
          Quem viveu, <em>conta</em>
        </h2>
        <p className="mt-4 max-w-xl text-fg-muted">Um pouco da última virada, direto do nosso Instagram. Toque no vídeo para ouvir.</p>
      </div>

      <div className={`story-marquee mt-10${soundOn !== null ? " is-paused" : ""}`}>
        <ul className="story-rail">
          {loop.map(({ v, copy }, i) => (
            <li key={`${copy}-${v.src}`} aria-hidden={copy > 0 || undefined}>
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
                  tabIndex={copy > 0 ? -1 : undefined}
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
