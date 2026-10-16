import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// Tudo que vira link ou QR é "<prefixo>.<id>.<assinatura>". Sem a chave do servidor
// ninguém consegue fabricar um ingresso válido nem abrir o pedido de outra pessoa.
const TICKET_PREFIX = "PE1";
const ORDER_PREFIX = "PO1";

function secret() {
  const s = process.env.TICKET_SECRET;
  if (!s || s.length < 32) throw new Error("TICKET_SECRET ausente ou curto (mínimo 32 caracteres)");
  return s;
}

function sign(prefix: string, id: string) {
  return createHmac("sha256", secret()).update(`${prefix}.${id}`).digest("base64url").slice(0, 22);
}

function verify(prefix: string, token: string): string | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== prefix) return null;
  const [, id, sig] = parts;
  const expected = Buffer.from(sign(prefix, id));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return id;
}

export const ticketToken = (ticketId: string) => `${TICKET_PREFIX}.${ticketId}.${sign(TICKET_PREFIX, ticketId)}`;
export const verifyTicketToken = (token: string) => verify(TICKET_PREFIX, token);

export const orderToken = (orderId: string) => `${ORDER_PREFIX}.${orderId}.${sign(ORDER_PREFIX, orderId)}`;
export const verifyOrderToken = (token: string) => verify(ORDER_PREFIX, token);

// Código curto para o cliente falar no suporte. Sem 0/O/1/I para não confundir.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function orderCode() {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
