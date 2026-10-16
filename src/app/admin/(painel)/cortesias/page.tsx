import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { activeEvent, batchReport } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { CourtesyForm } from "../../forms";

export default async function CortesiasPage() {
  await connection();
  await requireAdmin();
  const event = await activeEvent();
  if (!event) return <p className="text-fg-muted">Nenhum evento publicado.</p>;

  const report = await batchReport(event.id);
  const hidden = report.flatMap((t) => t.rows.filter((r) => r.hidden).map((r) => ({ id: r.id, label: `${t.name} · ${r.name}`, remaining: r.remaining })));
  const issued = await db.order.findMany({
    where: { eventId: event.id, status: "PAID", totalCents: 0 },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <div className="grid gap-10">
      <div>
        <span className="eyebrow rule">Lista e convidados</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          <em>Cortesias</em>
        </h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          Sai um ingresso com QR igual ao vendido, já pago e enviado por e-mail. Fica num lote oculto: não aparece no site e não conta na receita.
        </p>
      </div>

      {hidden.length ? (
        <CourtesyForm batches={hidden} />
      ) : (
        <p className="text-fg-muted">Crie um lote oculto (hidden) para cortesias no banco antes de emitir.</p>
      )}

      <section>
        <h2 className="eyebrow rule">Emitidas ({issued.reduce((s, o) => s + o._count.tickets, 0)})</h2>
        <ul className="mt-5 divide-y divide-line-soft border-y border-line-soft text-sm">
          {issued.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
              <span className="font-mono text-xs text-accent">{o.code}</span>
              <span className="flex-1">{o.buyerName}</span>
              <span className="text-fg-muted">{o.email}</span>
              <span className="tabular-nums">{o._count.tickets}×</span>
              <span className="text-fg-faint">{o.paymentRef?.replace(/^cortesia:?\s*/, "") || "—"}</span>
              <span className="text-xs text-fg-faint">{formatDateTime(o.createdAt)}</span>
            </li>
          ))}
          {issued.length === 0 && <li className="py-4 text-fg-faint">Nenhuma cortesia emitida ainda.</li>}
        </ul>
      </section>
    </div>
  );
}
