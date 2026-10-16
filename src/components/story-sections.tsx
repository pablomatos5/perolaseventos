import { campaign, faq, history, manifesto, sponsors2026, stats, testimonials, ticker } from "@/content/site";

/** Manifesto + números + linha do tempo das edições. */
export function Story() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div>
          <span className="eyebrow rule">Nossa história</span>
          <p className="mt-6 font-display text-[clamp(2rem,4.6vw,3.6rem)] font-light leading-[1.05]">
            {manifesto.map((line, i) => (
              <span key={line} className={`block ${i === manifesto.length - 1 ? "italic text-accent" : ""}`}>
                {line}
              </span>
            ))}
          </p>
          <dl className="mt-12 grid grid-cols-3 gap-4 border-t border-line pt-8">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-4xl text-accent-2 md:text-5xl">{s.value}</dd>
                <dd className="mt-1 text-xs uppercase tracking-[0.18em] text-fg-faint">{s.label}</dd>
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

type Sponsor = (typeof sponsors2026)[number];

function SponsorTile({ s, hidden }: { s: Sponsor; hidden?: boolean }) {
  const inner = (
    <>
      <span className={`sponsor-art ${s.light ? "is-light" : ""} ${s.image ? "" : "is-text"}`}>
        {s.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- recorte já otimizado em /public
          <img src={s.image} alt="" loading="lazy" decoding="async" />
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
    <a href={`https://www.instagram.com/${s.instagram}/`} target="_blank" rel="noopener noreferrer" className="sponsor-tile" {...a11y}>
      {inner}
    </a>
  ) : (
    <div className="sponsor-tile" {...a11y}>
      {inner}
    </div>
  );
}

/**
 * Patrocinadores numa faixa sempre em movimento (mesmo esquema dos cartazes da jessassinaturas):
 * a lista aparece 4x e a faixa anda -50% em loop linear, então o fim encaixa no começo sem salto.
 * Para quando o mouse passa por cima ou um link recebe foco; sem animação vira rolagem manual.
 */
export function SponsorCarousel() {
  const loop = [0, 1, 2, 3].flatMap((copy) => sponsors2026.map((s) => ({ s, copy })));
  return (
    <div className="sponsor-marquee">
      <ul className="sponsor-track" aria-label="Patrocinadores">
        {loop.map(({ s, copy }) => (
          <li key={`${copy}-${s.name}`}>
            <SponsorTile s={s} hidden={copy > 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Perguntas frequentes com <details>: abre e fecha sem JavaScript. */
export function Faq() {
  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-20 md:py-28">
      <span className="eyebrow rule">Dúvidas</span>
      <h2 className="display mt-4 text-[clamp(2.2rem,5vw,3.6rem)]!">
        Antes da <em>virada</em>
      </h2>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {faq.map((f) => (
          <details key={f.q} className="faq group py-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-lg">
              {f.q}
              <span className="text-2xl text-accent transition-transform duration-300 group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-fg-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Campanha 2027: os três pilares do story oficial + fechamento. */
export function Campaign() {
  return (
    <section className="relative overflow-hidden py-20 text-center md:py-28">
      <div className="ambient-glow left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 bg-ocean opacity-20" />
      <div className="relative mx-auto max-w-5xl px-5">
        <span className="eyebrow">6ª edição · {campaign.tagline}</span>
        <ul className="mt-10 grid gap-8 sm:grid-cols-3">
          {campaign.pillars.map((p) => (
            <li key={p} className="glass-card px-6 py-8">
              <span className="mx-auto mb-4 block size-2 rotate-45 bg-accent" />
              <p className="font-display text-2xl">{p}</p>
            </li>
          ))}
        </ul>
        <p className="mt-14 font-display text-[clamp(1.8rem,4vw,3rem)] font-light italic">
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

/** Destaque "Relatos": frases de quem viveu a edição passada. */
export function Testimonials() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <span className="eyebrow rule">Relatos</span>
      <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
        Quem viveu, <em>conta</em>
      </h2>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t) => (
          <figure key={t.quote} className="glass-card flex flex-col justify-between p-7">
            <blockquote className="font-display text-2xl leading-snug font-light">
              <span className="text-accent">“</span>
              {t.quote}
              <span className="text-accent">”</span>
            </blockquote>
            <figcaption className="mt-6 text-xs uppercase tracking-[0.2em] text-fg-faint">
              <span className="text-fg-muted">{t.author}</span> · {t.role}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Faixa rolando com ✦ entre os itens (a "roleta"). Lista duplicada para o loop não ter emenda. */
export function Ticker({ items = ticker }: { items?: string[] }) {
  return (
    <div className="ticker" aria-label={items.join(", ")}>
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
