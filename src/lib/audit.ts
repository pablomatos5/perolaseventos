import { db } from "@/lib/db";

/** Registra uma ação sensível (quem, o quê, detalhe). Falha ao registrar nunca derruba a ação. */
export async function audit(actor: string, action: string, detail = "") {
  try {
    await db.auditLog.create({ data: { actor: actor.slice(0, 60), action: action.slice(0, 80), detail: detail.slice(0, 400) } });
  } catch (e) {
    console.error("[auditoria] não registrou:", action, e);
  }
}
