import { TicketRules } from "@/components/ticket-rules";
import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { formatDateTime, genderLabel } from "@/lib/format";
import { qrDataUrl } from "@/lib/qr";
import { ticketToken, verifyTicketLinkToken } from "@/lib/tokens";

export const metadata = { title: "Seu ingresso · Pérolas", robots: { index: false } };

/** Ingresso individual: o link que o comprador manda a quem vai usar. Morre quando o QR é reemitido. */
export default function SingleTicketPage({ params }: PageProps<"/i/[token]">) {
  return (
    <Suspense fallback={<div className="grid min-h-svh place-items-center text-fg-faint">Carregando…</div>}>
      <SingleTicket params={params} />
    </Suspense>
  );
}

async function SingleTicket({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const parsed = verifyTicketLinkToken(decodeURIComponent((await params).token));
  if (!parsed) notFound();

  const t = await db.ticket.findUnique({
    where: { id: parsed.id },
    include: { ticketType: true, batch: true, order: { include: { event: true } } },
  });
  if (!t || t.order.status !== "PAID") notFound();
  const event = t.order.event;
  const stale = t.qrVersion !== parsed.version;

  return (
    <main className="pagina-noite mx-auto w-full max-w-md px-5 py-10">
      <Link href="/" className="page-logo" aria-label="Início">
        <BrandLogo kind="reveillon" tone="dourado" sizes="16rem" priority />
      </Link>
      <span className="eyebrow rule flex">
        {event.name} {event.edition}
      </span>
      {stale || t.status !== "VALID" ? (
        <>
          <h1 className="display mt-4 text-[clamp(2rem,7vw,3rem)]!">
            Link <em>sem validade</em>
          </h1>
          <p className="mt-4 text-fg-muted">
            Este ingresso foi transferido, reemitido ou cancelado, e este link não vale mais na entrada. Peça o link novo a quem comprou.
          </p>
        </>
      ) : (
        <TicketBody
          pdf={`/i/${encodeURIComponent((await params).token)}/pdf`}
          qr={await qrDataUrl(ticketToken(t.id, t.qrVersion))}
          holder={t.holderName}
          used={t.usedAt}
          title={`${event.name} ${event.edition}`}
          when={`${formatDateTime(event.startsAt)} · ${event.venue}`}
          type={`${t.ticketType.name} · ${t.batch.name} · ${genderLabel(t.gender)}`}
          code={t.order.code}
        />
      )}
    </main>
  );
}

function TicketBody(p: { pdf: string; qr: string; holder: string; used: Date | null; title: string; when: string; type: string; code: string }) {
  return (
    <>
      <h1 className="display mt-4 text-[clamp(2rem,7vw,3rem)]!">
        Te vemos na <em>virada</em>
      </h1>
      <p className="mt-2 text-sm text-fg-muted">{p.when}</p>
      <article className="glass-card mt-8 grid justify-items-center gap-5 p-6 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor */}
        <img src={p.qr} alt="QR code do ingresso" className={`size-72 rounded-xl bg-white ${p.used ? "opacity-30" : ""}`} />
        <div>
          <h2 className="font-display text-3xl">{p.holder}</h2>
          <p className="mt-1 text-sm text-fg-muted">{p.type}</p>
          {p.used && <p className="mt-3 text-sm text-accent">Utilizado em {formatDateTime(p.used)}</p>}
        </div>
        {!p.used && (
          <a href={p.pdf} className="btn solid" download>
            Baixar ingresso (PDF)
          </a>
        )}
      </article>
      <TicketRules className="mt-6" />
      <p className="mt-4 text-xs leading-relaxed text-fg-faint">
        Baixe o PDF: na festa pode faltar sinal. Se quem comprou trocar o nome deste ingresso, este QR deixa de valer.
      </p>
    </>
  );
}
