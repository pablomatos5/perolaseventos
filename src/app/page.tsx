import { connection } from "next/server";
import { Suspense } from "react";
import { TideReveal, type TideStep } from "@/components/tide-reveal";
import { Countdown } from "@/components/countdown";
import { Lineup, PartyDetails } from "@/components/party-sections";
import { OceanWaves, ShellOpening, Sparkles } from "@/components/shell-opening";
import { Campaign, Faq, Story, Ticker } from "@/components/story-sections";
import { PastEditions } from "@/components/past-editions";
import { PearlDrop } from "@/components/pearl-drop";
import { StickyBuy } from "@/components/sticky-buy";
import { Starfield } from "@/components/starfield";
import { campaign } from "@/content/site";
import { TicketPicker, type PickerType } from "@/components/ticket-picker";
import { currentBatch } from "@/lib/batches";
import { db } from "@/lib/db";
import { formatDateTime, halfPrice } from "@/lib/format";

export default function Home() {
  return (
    <Suspense fallback={<div className="grid min-h-svh place-items-center text-fg-faint">Carregando…</div>}>
      <EventPage />
    </Suspense>
  );
}

async function EventPage() {
  await connection(); // lotes e estoque mudam a todo momento: sempre ler na hora
  const now = new Date();
  const event = await db.event.findFirst({
    where: { published: true, startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      highlights: { orderBy: { sortOrder: "asc" } },
      attractions: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!event) {
    return <main className="grid min-h-svh place-items-center p-8 text-center text-fg-muted">Nenhum evento à venda no momento.</main>;
  }

  const types: PickerType[] = [];
  for (const t of event.ticketTypes) {
    const s = await currentBatch(db, t, now);
    if (s.state !== "open" && (await db.batch.count({ where: { ticketTypeId: t.id, hidden: false } })) === 0) continue; // só cortesia
    const open = s.state === "open" ? s : null;
    types.push({
      id: t.id,
      name: t.name,
      description: t.description,
      allowHalf: t.allowHalfPrice,
      maxPerOrder: t.maxPerOrder,
      status: s.state,
      batchName: open?.batch.name ?? null,
      priceCents: open?.batch.priceCents ?? 0,
      halfCents: open ? halfPrice(open.batch) : 0,
      remaining: open?.remaining ?? 0,
      lowStock: open ? open.remaining / open.batch.quantity <= 0.2 : false,
      next: open?.nextBatch ? { name: open.nextBatch.name, priceCents: open.nextBatch.priceCents } : null,
    });
  }

  // Maré de atrações: data → cada atração anunciada → "em breve" → convite para os ingressos.
  const announced = event.attractions.filter((a) => a.announced);
  const soonCount = event.attractions.length - announced.length;
  const tideSteps: TideStep[] = [
    { key: "data", eyebrow: `Réveillon ${event.edition} · 6ª edição`, big: "31·12", small: [event.venue, event.city, "7 horas de open bar"] },
    ...announced.map((a) => ({
      key: a.id,
      eyebrow: a.genre || "Atração confirmada",
      big: a.name,
      small: a.instagram ? [`@${a.instagram}`] : [],
      imageUrl: a.imageUrl || undefined,
    })),
    ...(soonCount > 0
      ? [{ key: "em-breve", mystery: true, big: `+${soonCount} atrações em breve`, small: ["Os anúncios saem no @perolaseventos"] }]
      : []),
    { key: "convite", eyebrow: "Lotes abertos", big: "A virada que você merece", cta: { label: "Garantir meu ingresso", href: "#ingressos" } },
  ];

  return (
    <main>
      <Starfield />
      {/* Hero e praia formam uma cena só: céu → concha → mar (OceanWaves) → maré de atrações na areia (TideReveal). */}
      <section className="hero-sky relative flex min-h-svh flex-col overflow-hidden">
        <Sparkles />
        <div className="ambient-glow left-1/2 top-[22%] size-[34rem] -translate-x-1/2 bg-accent opacity-[0.16]" />

        <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-12">
          <span className="font-display text-2xl italic">Pérolas</span>
          <a href="#ingressos" className="btn px-5! py-2.5!">Ingressos</a>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 pb-2 text-center">
          <ShellOpening className="w-[min(86vw,30rem,40svh)]" />
          <span className="eyebrow rv mt-2" style={{ animationDelay: "1.5s" }}>
            Réveillon · {event.edition} · 6ª edição
          </span>
          <h1 className="hero-title rv" style={{ animationDelay: "1.6s" }}>
            Pérolas
          </h1>
          <p className="rv max-w-md text-fg-muted" style={{ animationDelay: "1.75s" }}>
            <em className="font-display text-xl text-accent">{campaign.tagline}</em>
          </p>
          <p className="rv mt-3 text-xs uppercase tracking-[0.25em] text-fg-faint" style={{ animationDelay: "1.85s" }}>
            {formatDateTime(event.startsAt)} · {event.venue}
          </p>
          <div className="rv mt-6" style={{ animationDelay: "2s" }}>
            <Countdown target={new Date(Date.UTC(event.startsAt.getUTCFullYear(), 0, 1, 3)).toISOString()} />
          </div>
          <a href="#ingressos" data-hero-cta className="btn solid rv mt-6" style={{ animationDelay: "2.15s" }}>
            Garantir meu ingresso
          </a>
        </div>
        <OceanWaves />
      </section>

      <TideReveal steps={tideSteps} />

      <Ticker />
      <Campaign />
      <PartyDetails highlights={event.highlights} />
      <Lineup attractions={event.attractions} />

      <section id="ingressos" className="mx-auto w-full max-w-6xl scroll-mt-8 px-5 py-20 md:px-8 md:py-28">
        <span className="eyebrow rule">Ingressos</span>
        <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
          Escolha o seu <em>lugar</em> na virada
        </h2>
        <p className="mt-4 max-w-xl text-fg-muted">{event.description}</p>
        <div className="mt-12">
          <TicketPicker eventId={event.id} types={types} />
        </div>
      </section>

      <PastEditions />
      <Story />
      <Faq />
      <StickyBuy />
      <PearlDrop />

      <footer className="border-t border-line px-5 py-10 text-center text-xs text-fg-faint">
        Pérolas Eventos · {event.city} ·{" "}
        <a className="underline-offset-4 hover:underline" href="https://www.instagram.com/perolaseventos/">
          @perolaseventos
        </a>
      </footer>
    </main>
  );
}
