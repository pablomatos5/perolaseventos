/**
 * Convite do grupo do evento no WhatsApp: só para quem já pagou (página do pedido pago, e-mail dos ingressos
 * e página do ingresso individual). Vem do .env da VPS (WHATSAPP_GROUP_URL) e é lido a cada acesso: trocar o
 * grupo não precisa de novo build. Só aceita link de convite do WhatsApp; vazio ou inválido = não aparece.
 */
export function whatsappGroupUrl(): string | null {
  const url = process.env.WHATSAPP_GROUP_URL?.trim() ?? "";
  return /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]{10,40}$/.test(url) ? url : null;
}
