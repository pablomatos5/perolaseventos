import { connection } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { revokeDeviceAction } from "../../actions";
import { ConfirmButton, DeviceForm } from "../../forms";

export default async function PortariaAdminPage() {
  await connection();
  await requireAdmin();
  const devices = await db.portariaDevice.findMany({ orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }] });

  return (
    <div className="grid gap-10">
      <div>
        <span className="eyebrow rule">Entrada</span>
        <h1 className="display mt-3 text-[clamp(2rem,4vw,3rem)]!">
          Aparelhos da <em>portaria</em>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-muted">
          Só aparelhos autorizados aqui validam ingressos. Cada um recebe uma chave própria: se um celular sumir, desautorize só ele. Antes de abrir os
          portões, abra a portaria em cada aparelho com internet para ele baixar a lista de ingressos (modo offline).
        </p>
      </div>

      <DeviceForm />

      <ul className="grid gap-3">
        {devices.map((d) => (
          <li key={d.id} className={`glass-card flex flex-wrap items-center justify-between gap-3 p-5 text-sm ${d.revokedAt ? "opacity-50" : ""}`}>
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-xs text-fg-faint">
                autorizado {formatDateTime(d.createdAt)}
                {d.lastSeenAt && ` · usado por último ${formatDateTime(d.lastSeenAt)}`}
                {d.revokedAt && ` · desautorizado ${formatDateTime(d.revokedAt)}`}
              </div>
            </div>
            {!d.revokedAt && (
              <form action={revokeDeviceAction.bind(null, d.id)}>
                <ConfirmButton className="btn px-4! py-2!" message={`Desautorizar "${d.name}"? Ele para de validar ingressos na hora.`}>
                  Desautorizar
                </ConfirmButton>
              </form>
            )}
          </li>
        ))}
        {devices.length === 0 && <li className="text-fg-faint">Nenhum aparelho autorizado ainda.</li>}
      </ul>
    </div>
  );
}
