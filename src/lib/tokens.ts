import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Tudo que vira link ou QR é "<prefixo>.<partes>.<assinatura>". Sem a chave do servidor
// ninguém consegue fabricar um ingresso válido nem abrir o pedido de outra pessoa.
// Ingresso: "PE1.<id>.<sig>" (versão 0, o formato original) ou "PE2.<id>.<versão>.<sig>" depois de
// reemitido/transferido. Link individual de um ingresso: "PT1.<id>.<versão>.<sig>".
const ORDER_PREFIX = "PO1";

function secret() {
  const s = process.env.TICKET_SECRET;
  if (!s || s.length < 32) throw new Error("TICKET_SECRET ausente ou curto (mínimo 32 caracteres)");
  return s;
}

function sign(...parts: string[]) {
  return createHmac("sha256", secret()).update(parts.join(".")).digest("base64url").slice(0, 22);
}

function sigOk(sig: string, ...parts: string[]) {
  const expected = Buffer.from(sign(...parts));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const VERSION = /^(0|[1-9]\d{0,5})$/;

export function ticketToken(ticketId: string, version = 0) {
  if (version === 0) return `PE1.${ticketId}.${sign("PE1", ticketId)}`;
  return `PE2.${ticketId}.${version}.${sign("PE2", ticketId, String(version))}`;
}

/** QR lido na portaria → id e versão do ingresso (a versão é conferida com o banco). */
export function verifyTicketToken(token: string): { id: string; version: number } | null {
  const p = token.trim().split(".");
  if (p.length === 3 && p[0] === "PE1" && sigOk(p[2], "PE1", p[1])) return { id: p[1], version: 0 };
  if (p.length === 4 && p[0] === "PE2" && VERSION.test(p[2]) && sigOk(p[3], "PE2", p[1], p[2])) return { id: p[1], version: Number(p[2]) };
  return null;
}

/** Link de um ingresso só (para mandar a quem vai usar). Morre quando o QR é reemitido. */
export const ticketLinkToken = (ticketId: string, version: number) => `PT1.${ticketId}.${version}.${sign("PT1", ticketId, String(version))}`;

export function verifyTicketLinkToken(token: string): { id: string; version: number } | null {
  const p = token.trim().split(".");
  if (p.length === 4 && p[0] === "PT1" && VERSION.test(p[2]) && sigOk(p[3], "PT1", p[1], p[2])) return { id: p[1], version: Number(p[2]) };
  return null;
}

export const orderToken = (orderId: string) => `${ORDER_PREFIX}.${orderId}.${sign(ORDER_PREFIX, orderId)}`;

export function verifyOrderToken(token: string): string | null {
  const p = token.trim().split(".");
  return p.length === 3 && p[0] === ORDER_PREFIX && sigOk(p[2], ORDER_PREFIX, p[1]) ? p[1] : null;
}

/** Impressão digital de um QR para a lista offline da portaria: o aparelho compara hashes, sem a chave. */
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

// Código curto para o cliente falar no suporte. Sem 0/O/1/I para não confundir.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function orderCode() {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
