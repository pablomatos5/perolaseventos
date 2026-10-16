import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function RegistroPage() {
  await connection();
  await requireAdmin();
  const logs = await db.auditLog.findMany({ orderBy: { at: "desc" }, take: 300 });

  return (
    <div className="grid gap-8">
      <div>
        <span className="eyebrow rule">Auditoria</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          <em>Registro</em> de ações
        </h1>
        <p className="mt-2 max-w-xl text-sm text-fg-muted">
          Viradas de lote, cortesias, reemissões, aparelhos da portaria, entradas manuais e trocas de titular. Últimas 300.
        </p>
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
        {logs.length === 0 && <li className="bg-bg p-4 text-fg-faint">Nada registrado ainda.</li>}
      </ol>
    </div>
  );
}
