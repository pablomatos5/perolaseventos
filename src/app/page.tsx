import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { TideReveal, type TideStep } from "@/components/tide-reveal";
import { Countdown } from "@/components/countdown";
import { Lineup, PartyDetails } from "@/components/party-sections";
import { InstagramIcon } from "@/components/attraction-cards";
import { HeroMermaids, LightSwirls, PearlHorizon, PerolasLogo, Star4 } from "@/components/hero-2027";
import { OceanWaves, Sparkles } from "@/components/shell-opening";
import { PearlDrop } from "@/components/pearl-drop";
import { AguaContinua } from "@/components/agua-continua";
import { Campaign, Faq, Story, Ticker } from "@/components/story-sections";
import { PastEditions } from "@/components/past-editions";
import { StickyBuy } from "@/components/sticky-buy";
import { Starfield } from "@/components/starfield";
import { campaign } from "@/content/site";
import { TicketPicker, type PickerType } from "@/components/ticket-picker";
import { currentBatch } from "@/lib/batches";
import { db } from "@/lib/db";
import { femalePrice } from "@/lib/format";
import { KorakiMark, SandTreasures, Seabed, SideMermaid } from "@/components/sea-decor";

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
      maxPerOrder: t.maxPerOrder,
      status: s.state,
      batchName: open?.batch.name ?? null,
      priceCents: open?.batch.priceCents ?? 0,
      femaleCents: open ? femalePrice(open.batch) : 0,
      remaining: open?.remaining ?? 0,
      lowStock: open ? open.remaining / open.batch.quantity <= 0.2 : false,
      // barra do lote: % vendido (inclui os vendidos fora do site), em número inteiro
      soldPct: open ? Math.min(100, Math.round((1 - open.remaining / Math.max(1, open.batch.quantity)) * 100)) : 0,
      next: open?.nextBatch ? { name: open.nextBatch.name, priceCents: open.nextBatch.priceCents } : null,
    });
  }

  // Aviso de abertura das vendas (ex.: "Vendas liberadas hoje, 22/10, a partir das 17h"): vem do .env da VPS
  // (SALES_NOTICE) e é lido a cada acesso, então dá para trocar ou tirar sem novo build. Vazio = sem aviso.
  const salesNotice = process.env.SALES_NOTICE?.trim() ?? "";

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
      ? [{ key: "em-breve", mystery: true, big: `+${soonCount} ${soonCount === 1 ? "atração" : "atrações"} em breve`, small: ["Os anúncios saem no @perolaseventos"] }]
      : []),
    { key: "convite", eyebrow: salesNotice ? "Vendas em breve" : "Lotes abertos", big: "A virada que você merece", cta: { label: "Garantir meu ingresso", href: "#ingressos" } },
  ];

  return (
    <main className="pagina-inicio">
      <Starfield />
      {/* Hero e praia formam uma cena só: céu → concha → mar (OceanWaves) → maré de atrações na areia (TideReveal). */}
      <section className="hero-2027 relative flex min-h-svh flex-col overflow-hidden">
        <div className="hero-sky-2027" aria-hidden />
        <Sparkles />
        <LightSwirls />
        <HeroMermaids />

        <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-12">
          <a href="https://www.instagram.com/perolaseventos/" target="_blank" rel="noopener noreferrer" className="hero-brand" aria-label="Instagram @perolaseventos">
            {/* assinatura do kit: concha Pérolas + @perolaseventos */}
            <picture>
              <source type="image/webp" srcSet="/2027/logo/assinatura-creme-600.webp 600w, /2027/logo/assinatura-creme.webp 1758w" sizes="12rem" />
              {/* eslint-disable-next-line @next/next/no-img-element -- arte oficial com fallback PNG */}
              <img src="/2027/logo/assinatura-creme.png" width={1758} height={303} alt="@perolaseventos" fetchPriority="high" />
            </picture>
          </a>
          <div className="flex items-center gap-3">
            <a href="https://www.instagram.com/perolaseventos/" target="_blank" rel="noopener noreferrer" className="hero-ig" aria-label="Instagram da Pérolas (@perolaseventos)">
              <InstagramIcon className="size-5" />
            </a>
            <a href="#ingressos" className="btn hero-btn px-5! py-2.5!">
              Ingressos
            </a>
          </div>
        </header>

        <div className="hero-copy relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-5 pb-2 text-center">
          <PerolasLogo year={event.edition.toUpperCase()} className="rv" />
          <p className="hero-tagline rv" style={{ animationDelay: "0.5s" }}>
            {campaign.tagline}
          </p>
          {/* "Save the date" do post oficial, dentro do topo */}
          <p className="hero-save rv" style={{ animationDelay: "0.6s" }}>
            <span>Save the date</span>
            <Star4 className="size-2.5" />
            <span>{event.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Belem" })}</span>
            <Star4 className="size-2.5" />
            <span>{event.venue}</span>
          </p>
          <div className="hero-countdown rv mt-5" style={{ animationDelay: "0.75s" }}>
            <Countdown target={new Date(Date.UTC(event.startsAt.getUTCFullYear(), 0, 1, 3)).toISOString()} />
          </div>
          <a href="#ingressos" data-hero-cta className="btn solid rv mt-5" style={{ animationDelay: "0.9s" }}>
            Garantir meu ingresso
          </a>
        </div>
        <PearlHorizon />
        <OceanWaves />
      </section>

      <TideReveal steps={tideSteps} />

      <Ticker />
      <Campaign />
      <PartyDetails highlights={event.highlights} />
      <Lineup attractions={event.attractions} />

      <section id="ingressos" className="with-mermaid ingressos-sand scroll-mt-8">
        {/* conchas e pérolas deixadas na areia */}
        <SandTreasures />
        <SideMermaid side="left" />
        <SideMermaid side="right" />
        <div className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <span className="eyebrow rule">Ingressos</span>
          <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
            Escolha o seu <em>lugar</em> na virada
          </h2>
          <p className="mt-4 max-w-xl text-fg-muted">{event.description}</p>
          {salesNotice && (
            <p className="sales-notice mt-8" role="status">
              <span aria-hidden>✦</span> {salesNotice}
            </p>
          )}
          <div className="mt-12">
            <TicketPicker eventId={event.id} types={types} pausedNote={salesNotice || undefined} />
          </div>
        </div>
      </section>

      <PastEditions />
      <Story />
      <Faq />
      <StickyBuy />
      <PearlDrop />
      <AguaContinua />

      <footer className="cv-auto seabed-footer px-5 pt-6 text-center">
        <Seabed />
        <div className="footer-content grid justify-items-center gap-5">
          {/* vieira aberta sentada na areia (render 3D: scripts/fundo-mar/concha.py); o botão fica dentro da metade de baixo */}
          <div className="concha-rodape">
            {/* eslint-disable-next-line @next/next/no-img-element -- render fixo em /public/2027 */}
            <img src="/2027/concha-rodape.webp" alt="" width={914} height={828} loading="lazy" decoding="async" aria-hidden />
            <a href="https://www.instagram.com/perolaseventos/" target="_blank" rel="noopener noreferrer" className="btn ig-link px-9! py-5! max-md:px-6! max-md:py-4!">
              <InstagramIcon />
              Siga @perolaseventos
            </a>
            <KorakiMark />
          </div>
          <p className="text-xs text-fg-faint">
            Pérolas Eventos · {event.city} ·{" "}
            <Link href="/pedido" className="underline underline-offset-2">
              Encontrar meu pedido
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
