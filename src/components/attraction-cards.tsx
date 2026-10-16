"use client";

import { useEffect, useRef, useState } from "react";

export type CardAttraction = {
  id: string;
  name: string;
  genre: string;
  time: string;
  announced: boolean;
  headliner: boolean;
  instagram: string;
  imageUrl: string;
  imageFocus?: string; // object-position da foto (ex.: "50% 30%")
  videoUrl?: string;
};

/**
 * Inclinação 3D seguindo o mouse, com brilho que acompanha o cursor (port do design-ref/motion/tilt.js).
 * Só liga com mouse de verdade e sem "reduzir movimento"; no toque o card fica parado.
 */
function useTilt<T extends HTMLElement>(max = 7) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cur = { rx: 0, ry: 0, gx: 50, gy: 50, go: 0 };
    const tgt = { ...cur };
    let raf = 0;
    const step = () => {
      let moving = false;
      for (const k of Object.keys(cur) as (keyof typeof cur)[]) {
        cur[k] += (tgt[k] - cur[k]) * 0.12;
        if (Math.abs(tgt[k] - cur[k]) > 0.02) moving = true;
      }
      el.style.setProperty("--rx", `${cur.rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${cur.ry.toFixed(2)}deg`);
      el.style.setProperty("--gx", `${cur.gx.toFixed(1)}%`);
      el.style.setProperty("--gy", `${cur.gy.toFixed(1)}%`);
      el.style.setProperty("--go", cur.go.toFixed(3));
      raf = moving ? requestAnimationFrame(step) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = ((e.clientY - r.top) / r.height) * 2 - 1;
      Object.assign(tgt, { rx: -y * max, ry: x * max, gx: (x + 1) * 50, gy: (y + 1) * 50, go: 1 });
      kick();
    };
    const leave = () => {
      Object.assign(tgt, { rx: 0, ry: 0, go: 0 });
      kick();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, [max]);
  return ref;
}

/** Título com a última palavra em itálico dourado ("Davi *Alencar*"), como nos cards da Curativa. */
function SplitTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  const last = words.pop();
  return (
    <>
      {words.length > 0 && `${words.join(" ")} `}
      <em className="text-accent">{last}</em>
    </>
  );
}

/** Arte da Pérolas quando não há foto: concha em linhas + pérola. Para "Em breve", a pérola guarda um "?". */
function CardArt({ mystery, initials }: { mystery: boolean; initials: string }) {
  return (
    <div className="card-art" aria-hidden>
      <svg viewBox="0 0 200 150" className="absolute inset-x-0 bottom-0 w-full">
        {Array.from({ length: 6 }, (_, i) => (
          <path
            key={i}
            d={`M ${100 - (40 + i * 14)} 150 A ${40 + i * 14} ${34 + i * 14} 0 0 1 ${100 + 40 + i * 14} 150`}
            fill="none"
            stroke="var(--accent-2)"
            strokeOpacity={0.12 + i * 0.06}
          />
        ))}
      </svg>
      <div className="pearl card-pearl">
        <span>{mystery ? "?" : initials}</span>
      </div>
    </div>
  );
}

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useTilt<HTMLDivElement>();
  return (
    <div ref={ref} className={`tilt attraction-card ${className}`}>
      {children}
    </div>
  );
}

const igUrl = (handle: string) => `https://www.instagram.com/${handle}/`;

function AnnouncedCard({ a, hint }: { a: CardAttraction; hint?: string }) {
  const initials = a.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2);
  return (
    <Frame className={a.headliner ? "is-headliner" : ""}>
      <div className="card-media">
        {a.headliner && <span className="feature-badge">Confirmado</span>}
        {a.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto enviada pela Pérolas, servida de /public
          <img src={a.imageUrl} alt={a.name} loading="lazy" className="size-full object-cover" style={a.imageFocus ? { objectPosition: a.imageFocus } : undefined} />
        ) : (
          <CardArt mystery={false} initials={initials} />
        )}
      </div>
      <div className="card-body">
        <span className="eyebrow eyebrow-center">{a.genre || (a.headliner ? "Atração principal" : "Atração")}</span>
        <h3 className="card-title">
          <SplitTitle text={a.name} />
        </h3>
        {a.time && <p className="text-sm text-fg-muted">No palco: {a.time}</p>}
        {hint && <p className="text-sm text-fg-faint">{hint}</p>}
        {a.instagram && !hint && (
          <a href={igUrl(a.instagram)} target="_blank" rel="noopener noreferrer" className="btn mt-5 px-6! py-3!">
            @{a.instagram}
          </a>
        )}
      </div>
    </Frame>
  );
}

/** "Em breve": a carta vira (hover no desktop, toque no celular) e mostra o recado do story Perguntas. */
function MysteryCard({ n }: { n: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`Atração ${n}: revelação em breve. Virar a carta`}
      className={`flip-card ${flipped ? "is-flipped" : ""}`}
      onClick={() => setFlipped((f) => !f)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <span className="flip-inner">
        <span className="flip-face">
          <Frame>
            <div className="card-media">
              <CardArt mystery initials="" />
            </div>
            <div className="card-body">
              <span className="eyebrow eyebrow-center">Atração {String(n).padStart(2, "0")}</span>
              <span className="card-title">
                Revelação <em className="text-accent">em breve</em>
              </span>
              <span className="text-sm text-fg-faint">Toque para espiar</span>
            </div>
          </Frame>
        </span>
        <span className="flip-face flip-back">
          <span className="attraction-card flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="eyebrow eyebrow-center">Segredo da 6ª edição</span>
            <span className="font-display text-3xl leading-tight">
              Anúncio oficial em breve! <em className="text-accent">Segura só mais um pouquinho</em>
            </span>
            <span className="text-sm text-fg-muted">Ative as notificações do @perolaseventos para saber primeiro.</span>
          </span>
        </span>
      </span>
    </div>
  );
}

const PLAYING_EVENT = "perolas:video-play"; // só um vídeo de atração toca por vez

/**
 * Atração com vídeo: frente com a foto, verso com o vídeo do anúncio COM SOM.
 * Navegadores só liberam áudio depois de um clique/toque: virar por clique toca com som;
 * virar só passando o mouse tenta com som e, se bloqueado, toca mudo com botão para ativar.
 * O vídeo só é baixado na primeira virada (preload="none") e pausa ao desvirar.
 */
function VideoFlipCard({ a }: { a: CardAttraction }) {
  const [flipped, setFlipped] = useState(false);
  const [hover, setHover] = useState(false);
  const [muted, setMuted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const showBack = flipped || hover;

  const play = (withSound: boolean) => {
    const v = video.current;
    if (!v) return;
    window.dispatchEvent(new CustomEvent(PLAYING_EVENT, { detail: v }));
    v.volume = 0.85;
    v.muted = !withSound;
    setMuted(!withSound);
    v.play().catch(() => {
      // áudio bloqueado (sem clique ainda): toca mudo e deixa o botão de som à vista
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  };
  const stop = () => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };

  // outro card começou a tocar: este pausa
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== video.current) video.current?.pause();
    };
    window.addEventListener(PLAYING_EVENT, onOther);
    return () => window.removeEventListener(PLAYING_EVENT, onOther);
  }, []);

  const toggleFlip = () => {
    const next = !flipped;
    setFlipped(next);
    // dentro do clique = gesto do usuário: o navegador libera o som
    if (next || hover) play(true);
    else stop();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${a.name}: virar a carta para ver o vídeo do anúncio, com som`}
      className={`flip-card ${showBack ? "is-flipped" : ""}`}
      onClick={toggleFlip}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(true);
        if (!flipped) play(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        setHover(false);
        if (!flipped) stop();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleFlip();
        }
      }}
    >
      <span className="flip-inner no-hover-flip">
        <span className="flip-face">
          <AnnouncedCard a={a} hint="Vire para ver o anúncio 🔊" />
        </span>
        <span className="flip-face flip-back">
          <span className="attraction-card video-back">
            <video ref={video} src={a.videoUrl} poster={showBack ? a.videoUrl?.replace(/\.mp4$/, "-poster.jpg") : undefined} loop playsInline preload="none" className="video-fill" />
            <button
              type="button"
              className="sound-btn"
              aria-label={muted ? "Ativar som" : "Desativar som"}
              onClick={(e) => {
                e.stopPropagation(); // não desvira a carta
                const v = video.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
                if (v.paused) v.play().catch(() => {});
              }}
            >
              {muted ? "🔇 Ativar som" : "🔊"}
            </button>
            <span className="video-caption">
              <span className="eyebrow eyebrow-center">{a.genre || "Atração"}</span>
              <span className="card-title">
                <SplitTitle text={a.name} />
              </span>
              {a.instagram && <span className="text-sm text-fg-muted">@{a.instagram}</span>}
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}

/** Atrações do ano: cards viráveis grandes (2 por linha no desktop, carrossel no celular). */
export function AttractionCards({ attractions }: { attractions: CardAttraction[] }) {
  return (
    <ul className="card-rail card-rail-xl">
      {attractions.map((a, i) => (
        <li key={a.id}>
          {!a.announced ? <MysteryCard n={i + 1} /> : a.videoUrl ? <VideoFlipCard a={a} /> : <AnnouncedCard a={a} />}
        </li>
      ))}
    </ul>
  );
}
