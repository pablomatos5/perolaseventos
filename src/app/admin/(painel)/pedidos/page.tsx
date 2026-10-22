import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { isDev, requireAdmin } from "@/lib/admin-auth";
import { activeEvent } from "@/lib/admin-data";
import { db } from "@/lib/db";
import { orderLink } from "@/lib/delivery";
import { formatBRL, formatDateTime } from "@/lib/format";
import { refundOrderAction, reissueAction, resendAction } from "../../actions";
import { ConfirmButton } from "../../forms";

const STATUS: Record<string, string> = {
  PENDING: "aguardando pagamento",
  PARTIAL: "Pix 2x · 1ª parcela paga",
  PAID: "pago",
  EXPIRED: "expirado",
  CANCELED: "cancelado",
  REFUNDED: "estornado",
};

export default async function PedidosPage({ searchParams }: PageProps<"/admin/pedidos">) {
  await connection();
  await requireAdmin();
  const event = await activeEvent();
  if (!event) return <p className="text-fg-muted">Nenhum evento publicado.</p>;

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const status = typeof sp.status === "string" ? sp.status : "";
  const digits = q.replace(/\D/g, "");
  // botão de estorno: só para os desenvolvedores (a ação também confere no servidor)
  const dev = await isDev();
  const refundResult = sp.estorno === "ok" ? "ok" : sp.estorno === "erro" ? (typeof sp.msg === "string" ? sp.msg : "erro desconhecido") : null;

  const where: Prisma.OrderWhereInput = { eventId: event.id };
  if (status && status in STATUS) where.status = status as Prisma.OrderWhereInput["status"];
  if (q) {
    where.OR = [
      { code: { equals: q.toUpperCase() } },
      { buyerName: { contains: q, mode: "insensitive" } },
      { email: { contains: q.toLowerCase() } },
      ...(digits.length >= 4 ? [{ cpf: { contains: digits } }, { phone: { contains: digits } }] : []),
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      _count: { select: { tickets: true } },
      deliveries: { orderBy: { createdAt: "desc" }, take: 4 },
    },
  });

  return (
    <div className="grid gap-8">
      <div>
        <span className="eyebrow rule">Suporte</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          <em>Pedidos</em>
        </h1>
      </div>

      {refundResult && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${refundResult === "ok" ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger"}`}>
          {refundResult === "ok" ? "Estorno feito: o dinheiro volta ao comprador e os QRs do pedido não valem mais." : `O estorno não foi feito: ${refundResult}`}
        </p>
      )}

      <form className="flex flex-wrap gap-3" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Código, nome, e-mail, CPF ou celular"
          className="min-w-64 flex-1 rounded-xl border border-line bg-bg/60 px-4 py-3 outline-none focus:border-accent"
        />
        <select name="status" defaultValue={status} className="rounded-xl border border-line bg-bg/60 px-4 py-3">
          <option value="">Todos</option>
          {Object.entries(STATUS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn">Buscar</button>
      </form>

      <ul className="grid gap-3">
        {orders.map((o) => {
          const lastEmail = o.deliveries.find((d) => d.channel === "EMAIL");
          return (
            <li key={o.id} className="glass-card grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-1 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-accent">{o.code}</span>
                  <span className="font-medium">{o.buyerName}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${o.status === "PAID" ? "bg-ok/15 text-ok" : "bg-surface text-fg-muted"}`}>
                    {STATUS[o.status]}
                    {o.paidLate && " · pago após expirar"}
                    {o.status === "PARTIAL" && ` (${formatBRL(o.firstPaidCents)}) · 2ª ${o.expiresAt < new Date() ? "vencida em" : "até"} ${formatDateTime(o.expiresAt)}`}
                    {o.status === "PAID" && o.paymentPlan === "PIX_2X" && " · Pix 2x"}
                  </span>
                </div>
                <div className="text-fg-muted">
                  {o.email} · {o.phone || "sem celular"} · {o._count.tickets} ingresso(s) · {o.totalCents ? formatBRL(o.totalCents) : "cortesia"}
                </div>
                <div className="text-xs text-fg-faint">
                  {formatDateTime(o.createdAt)}
                  {lastEmail && ` · e-mail: ${lastEmail.ok ? "enviado" : `falhou (${lastEmail.detail})`}`}
                </div>
              </div>
              {o.status === "PAID" && (
                <div className="flex flex-wrap gap-2">
                  <a href={orderLink(o.id)} target="_blank" rel="noopener noreferrer" className="btn px-4! py-2!">
                    Ver ingressos
                  </a>
                  <form action={resendAction.bind(null, o.id)}>
                    <button className="btn solid px-4! py-2!">Reenviar</button>
                  </form>
                  <form action={reissueAction.bind(null, o.id)}>
                    <ConfirmButton
                      className="btn px-4! py-2!"
                      message={`Reemitir os QR do pedido ${o.code}? Os QR atuais (e prints) deixam de valer e o cliente recebe o link de novo.`}
                    >
                      Reemitir QR
                    </ConfirmButton>
                  </form>
                  {dev && o.paymentRef && /^\d+$/.test(o.paymentRef) && (
                    <form action={refundOrderAction.bind(null, o.id)}>
                      <ConfirmButton
                        className="btn btn-danger px-4! py-2!"
                        message={`Estornar o pedido ${o.code} (${formatBRL(o.totalCents)}) pelo Mercado Pago? O dinheiro volta para ${o.buyerName}, a taxa de serviço volta junto e os QR codes param de valer. Não dá para desfazer.`}
                      >
                        Estornar
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {orders.length === 0 && <li className="text-fg-faint">Nenhum pedido encontrado.</li>}
      </ul>
    </div>
  );
}
