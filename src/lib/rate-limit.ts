import { headers } from "next/headers";

// Limite de tentativas em memória (janela deslizante). O site roda num processo só no VPS,
// então isto basta; reiniciar o servidor zera os contadores (aceitável: é só freio de abuso).
const hits = new Map<string, number[]>();
let lastSweep = Date.now();

/** Registra uma tentativa em `key` e diz se ainda está dentro do limite (`max` por `windowMs`). */
export function allow(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    // faxina: não deixa o mapa crescer com chaves velhas
    lastSweep = now;
    for (const [k, list] of hits) if (!list.length || now - list[list.length - 1] > 3_600_000) hits.delete(k);
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Só olha, sem contar (para "bloqueado por erros demais" sem gastar tentativa). */
export function blocked(key: string, max: number, windowMs: number) {
  const now = Date.now();
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs).length >= max;
}

/** Conta uma falha (ex.: senha errada) sem checar. */
export function fail(key: string) {
  const list = hits.get(key) ?? [];
  list.push(Date.now());
  hits.set(key, list);
}

/** IP do visitante. Atrás do nginx vem em X-Real-IP / X-Forwarded-For (configurar no vhost). */
export function ipFrom(h: Headers) {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function clientIp() {
  return ipFrom(await headers());
}
