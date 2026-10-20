import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireDev } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const DAY_MS = 86_400_000;
const PERIODS: { value: string; label: string }[] = [
  { value: "1", label: "Últimas 24h" },
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "", label: "Tudo" },
];
const LIMITS = [100, 300, 1000, 3000];

export default async function RegistroPage({ searchParams }: PageProps<"/admin/registro">) {
  await connection();
  await requireDev();

  const sp = await searchParams;
  const actor = typeof sp.actor === "string" ? sp.actor : "";
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const days = typeof sp.days === "string" && sp.days !== "" ? Number(sp.days) : null;
  const take = LIMITS.includes(Number(sp.n)) ? Number(sp.n) : 300;

  // escopo (ator + período) para o resumo; a busca de texto entra só na lista
  const scope: Prisma.AuditLogWhereInput = {};
  if (actor) scope.actor = actor;
  if (days) scope.at = { gte: new Date(new Date().getTime() - days * DAY_MS) };
  const where: Prisma.AuditLogWhereInput = { ...scope };
  if (q) where.OR = [{ action: { contains: q, mode: "insensitive" } }, { detail: { contains: q, mode: "insensitive" } }];

  const [logs, total, actors, topActions] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { at: "desc" }, take }),
    db.auditLog.count({ where }),
    db.auditLog.findMany({ distinct: ["actor"], select: { actor: true }, orderBy: { actor: "asc" }, take: 50 }),
    db.auditLog.groupBy({ by: ["action"], where: scope, _count: { _all: true }, orderBy: { _count: { action: "desc" } }, take: 8 }),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <span className="eyebrow rule">Auditoria · desenvolvedores</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          <em>Registro</em> de ações
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          Quem fez o quê: logins, viradas e preços de lote, cortesias, reemissões, conexão do Mercado Pago, aparelhos da portaria, entradas manuais e
          trocas de titular. Filtre por responsável, período ou texto.
        </p>
      </div>

      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar na ação ou no detalhe (ex.: pedido, lote, Portão 1)"
          className="min-w-0 rounded-xl border border-line bg-bg/60 px-4 py-3 outline-none focus:border-accent"
        />
        <select name="actor" defaultValue={actor} className="rounded-xl border border-line bg-bg/60 px-4 py-3" aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          {actors.map((a) => (
            <option key={a.actor} value={a.actor}>{a.actor}</option>
          ))}
        </select>
        <select name="days" defaultValue={days ? String(days) : ""} className="rounded-xl border border-line bg-bg/60 px-4 py-3" aria-label="Período">
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select name="n" defaultValue={String(take)} className="rounded-xl border border-line bg-bg/60 px-4 py-3" aria-label="Quantidade">
          {LIMITS.map((n) => (
            <option key={n} value={n}>{n} linhas</option>
          ))}
        </select>
        <button className="btn sm:col-span-4 sm:w-fit">Filtrar</button>
      </form>

      {/* resumo do período: total + ações mais frequentes */}
      <div className="glass-card grid gap-3 p-5 md:p-6">
        <p className="text-sm text-fg-muted">
          <strong className="text-fg">{total}</strong> ação(ões) no escopo{actor && <> · responsável <strong className="text-fg">{actor}</strong></>}
          {days ? <> · últimos {days} dia(s)</> : <> · desde o começo</>}.
        </p>
        {topActions.length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs">
            {topActions.map((a) => (
              <li key={a.action} className="rounded-full bg-surface px-3 py-1">
                {a.action} <span className="font-semibold text-accent">{a._count._all}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ol className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line text-sm">
        {logs.map((l) => (
          <li key={l.id} className="grid gap-1 bg-bg p-4 md:grid-cols-[11rem_12rem_1fr] md:gap-4">
            <time className="text-xs text-fg-faint tabular-nums">{formatDateTime(l.at)}</time>
            <span className="text-fg-muted">{l.actor}</span>
            <span>
              <strong className="font-medium">{l.action}</strong>
              {l.detail && <span className="text-fg-muted"> · {l.detail}</span>}
            </span>
          </li>
        ))}
        {logs.length === 0 && <li className="bg-bg p-4 text-fg-faint">Nada encontrado com esses filtros.</li>}
      </ol>
      {total > logs.length && (
        <p className="text-xs text-fg-faint">
          Mostrando as {logs.length} mais recentes de {total}. Aumente a quantidade ou estreite o período para ver o resto.
        </p>
      )}
    </div>
  );
}
