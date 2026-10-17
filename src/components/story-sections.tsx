import { campaign, faq, history, manifesto, stats, ticker } from "@/content/site";
import { Scallop, SeaDecor } from "@/components/sea-decor";

/** Manifesto + números + linha do tempo das edições. */
export function Story() {
  return (
    <section className="cv-auto relative mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <SeaDecor
        items={[
          { kind: "starfish", at: "-left-16 top-10", size: "size-16", rotate: -20 },
          { kind: "coral", at: "-right-14 bottom-24", size: "size-20" },
        ]}
      />
      <div className="relative grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div>
          <span className="eyebrow rule">Nossa história</span>
          <p className="mt-6 font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.05]">
            {manifesto.map((line, i) => (
              <span key={line} className={`block ${i === manifesto.length - 1 ? "italic text-accent" : ""}`}>
                {line}
              </span>
            ))}
          </p>
          <dl className="mt-12 grid grid-cols-3 gap-3 border-t border-line pt-8 sm:gap-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-4xl text-accent-2 md:text-5xl">{s.value}</dd>
                <dd className="mt-1 text-[0.62rem] leading-snug uppercase tracking-[0.1em] text-fg-faint sm:text-xs sm:tracking-[0.18em]">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <ol className="relative grid gap-10 border-l border-line pl-8">
          {history.map((h) => (
            <li key={h.year} className="relative">
              <span className={`absolute -left-[2.3rem] top-1.5 size-3 rounded-full ${h.current ? "bg-accent shadow-[0_0_16px_4px_rgb(var(--pearl-glow)/0.6)]" : "border border-line bg-bg"}`} />
              <div className="flex items-baseline gap-4">
                <span className={`font-display text-4xl italic ${h.current ? "text-accent" : "text-fg-muted"}`}>{h.year}</span>
                <span className="eyebrow">{h.title}</span>
              </div>
              <p className="mt-2 max-w-md text-sm text-fg-muted">{h.text}</p>
              {"lineup" in h && h.lineup && (
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-fg-faint">No palco: {h.lineup.join(" · ")}</p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Perguntas frequentes com <details>: abre e fecha sem JavaScript. */
export function Faq() {
  return (
    <section className="cv-auto relative mx-auto w-full max-w-3xl px-5 py-20 md:py-28">
      <SeaDecor
        items={[
          { kind: "scallop", at: "-right-24 top-20", size: "size-16", rotate: 16 },
          { kind: "pearls", at: "-left-20 top-1/2", size: "size-12" },
        ]}
      />
      <span className="eyebrow rule">Dúvidas</span>
      <h2 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)]!">
        Antes da <em>virada</em>
      </h2>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {faq.map((f) => (
          <details key={f.q} className="faq group py-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-lg">
              {f.q}
              <Scallop className="faq-shell" />
            </summary>
            <p className="mt-3 text-sm text-fg-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Campanha 2027: os três pilares do story oficial + fechamento. */
/**
 * Campanha 2027 como um colar: fio dourado com as três pérolas-pilar penduradas
 * (no desktop o fio faz a curva do colar; no celular desce na vertical).
 */
export function Campaign() {
  const [lead, rest] = splitTagline(campaign.tagline);
  return (
    <section className="cv-auto relative overflow-hidden py-24 text-center md:py-32">
      <div className="ambient-glow left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 bg-ocean opacity-25" />
      <SeaDecor
        items={[
          { kind: "scallop", at: "left-[6%] top-16", size: "size-20", rotate: -18, mobile: true },
          { kind: "starfish", at: "right-[7%] top-24", size: "size-16", rotate: 14 },
          { kind: "pearls", at: "left-[12%] bottom-16", size: "size-12" },
          { kind: "coral", at: "right-[10%] bottom-10", size: "size-20" },
        ]}
      />
      <div className="relative mx-auto max-w-5xl px-5">
        <span className="eyebrow">6ª edição · campanha 2027</span>
        <h2 className="display mt-5 text-[clamp(2.3rem,6vw,4.6rem)]!">
          {lead} <em>{rest}</em>
        </h2>

        <div className="necklace mt-12 md:mt-16">
          <svg className="necklace-thread" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
            <path d="M0 4 Q 50 52 100 4" fill="none" stroke="url(#necklace-gold)" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
            <defs>
              <linearGradient id="necklace-gold" x1="0" x2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
                <stop offset="0.2" stopColor="var(--accent-2)" />
                <stop offset="0.8" stopColor="var(--accent-2)" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <ul className="necklace-pearls">
            {campaign.pillars.map((p, i) => (
              <li key={p} style={{ "--i": i } as React.CSSProperties}>
                <span className="pearl necklace-pearl" aria-hidden />
                <p className="font-display text-[1.65rem] leading-tight md:text-3xl">{p}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-16 font-display text-[clamp(1.9rem,4.5vw,3.2rem)] font-light italic md:mt-20">
          {campaign.closing.map((c, i) => (
            <span key={c} className={i === campaign.closing.length - 1 ? "text-accent" : ""}>
              {c}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/** "Um novo ciclo. Infinitas possibilidades." → ["Um novo ciclo.", "Infinitas possibilidades."] (2ª parte em destaque). */
function splitTagline(t: string): [string, string] {
  const m = /[.,]\s/.exec(t);
  return m ? [t.slice(0, m.index + 1), t.slice(m.index + 2).trim()] : ["", t];
}

/** Faixa rolando com ✦ entre os itens (a "roleta"). Lista duplicada para o loop não ter emenda. */
export function Ticker({ items = ticker }: { items?: string[] }) {
  return (
    <div className="ticker" role="marquee" aria-label={items.join(", ")}>
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {[...items, ...items].map((t, i) => (
            <span key={i} className="ticker-item">
              {t}
              <span className="ticker-star">✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
