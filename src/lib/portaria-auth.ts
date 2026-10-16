import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { allow, blocked, fail, ipFrom } from "@/lib/rate-limit";

// Cada aparelho da portaria é autorizado no painel e recebe um código secreto aleatório (fica só no
// aparelho; no banco vai o hash). Substitui o PIN único: nada para adivinhar, e dá para revogar um a um.

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Cria um aparelho e devolve o código que vai no link de ativação (mostrado uma única vez). */
export async function createDevice(name: string) {
  const token = randomBytes(24).toString("base64url");
  const device = await db.portariaDevice.create({ data: { name: name.slice(0, 40), tokenHash: hash(token) } });
  return { device, token };
}

export type DeviceAuth = { ok: true; id: string; name: string } | { ok: false; status: 401 | 429; message: string };

/**
 * Confere o "Authorization: Bearer <código>" de uma chamada da portaria.
 * Erros repetidos do mesmo IP bloqueiam por 15 min (ninguém fica chutando códigos).
 */
export async function deviceFromRequest(req: Request): Promise<DeviceAuth> {
  const ip = ipFrom(req.headers);
  const key = `portaria-auth:${ip}`;
  if (blocked(key, 10, 15 * 60_000)) return { ok: false, status: 429, message: "Muitas tentativas inválidas. Aguarde 15 minutos." };

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const device = token.length >= 20 ? await db.portariaDevice.findUnique({ where: { tokenHash: hash(token) } }) : null;
  if (!device || device.revokedAt) {
    fail(key);
    return { ok: false, status: 401, message: device?.revokedAt ? "Aparelho desautorizado no painel" : "Aparelho não autorizado" };
  }
  // "visto por último" no máximo a cada minuto por aparelho (não escreve no banco a cada leitura)
  if (allow(`portaria-seen:${device.id}`, 1, 60_000)) {
    await db.portariaDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return { ok: true, id: device.id, name: device.name };
}
