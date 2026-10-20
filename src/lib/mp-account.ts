import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// Conta Mercado Pago do vendedor (dona do evento) ligada à aplicação dos desenvolvedores (OAuth / marketplace).
// - "Conectar Mercado Pago" no painel → /api/mercadopago/conectar → página de autorização do Mercado Pago
//   → /api/mercadopago/conectar/retorno troca o código pelos tokens e guarda aqui (cifrados).
// - As cobranças são criadas com o token do vendedor: o dinheiro do ingresso cai na conta dele e a taxa de
//   serviço (marketplace_fee) cai na conta dona da aplicação (MP_CLIENT_ID / MP_CLIENT_SECRET, dos desenvolvedores).
// - O token vale 180 dias; renovamos sozinhos com o refresh_token quando faltar menos de 30.

const AUTH_URL = "https://auth.mercadopago.com.br/authorization";
const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const RENEW_BEFORE_MS = 30 * 86_400_000;

/** Endereço de retorno cadastrado na aplicação do Mercado Pago (tem que ser idêntico ao do painel deles). */
export const redirectUri = () => process.env.MP_REDIRECT_URI || `${process.env.APP_URL}/api/mercadopago/conectar/retorno`;

/** A aplicação dos desenvolvedores está configurada? (sem ela não há botão "Conectar") */
export const marketplaceConfigured = () => !!(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);

// Chave de cifra: MP_TOKEN_KEY, ou derivada do TICKET_SECRET (HKDF, rótulo próprio) quando não houver.
function key() {
  const base = process.env.MP_TOKEN_KEY || process.env.TICKET_SECRET;
  if (!base || base.length < 32) throw new Error("MP_TOKEN_KEY/TICKET_SECRET ausente ou curto");
  return Buffer.from(hkdfSync("sha256", base, "perolas", "mercadopago-oauth-tokens", 32));
}
function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}
function open(sealed: string) {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1") throw new Error("token cifrado em formato desconhecido");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
}

/** Link da página de autorização do Mercado Pago (o vendedor entra na conta dele e autoriza). */
export function authorizeUrl(state: string) {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", process.env.MP_CLIENT_ID!);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("platform_id", "mp");
  u.searchParams.set("state", state);
  u.searchParams.set("redirect_uri", redirectUri());
  return u.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
  public_key?: string;
  live_mode?: boolean;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    // MP_OAUTH_TEST=true (só em testes): pede credenciais de TESTE da conta conectada (contas de teste do
    // Mercado Pago só cobram em modo teste). Nunca ligar em produção.
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      ...(process.env.MP_OAUTH_TEST === "true" && process.env.NODE_ENV !== "production" && { test_token: true }),
      ...body,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) throw new Error(`Mercado Pago recusou a autorização (${r.status}: ${data.message ?? data.error ?? "sem detalhe"})`);
  return data as TokenResponse;
}

async function save(t: TokenResponse) {
  // apelido só para mostrar no painel quem está conectado
  const me = await fetch("https://api.mercadopago.com/users/me", { headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(10_000) })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  console.log(`[mercadopago] conta ${t.user_id} conectada · live_mode=${t.live_mode} · token ${t.access_token.slice(0, 8)}…`);
  const data = {
    mpUserId: String(t.user_id),
    nickname: String((me as { nickname?: string }).nickname ?? ""),
    accessToken: seal(t.access_token),
    refreshToken: seal(t.refresh_token),
    publicKey: t.public_key ?? "",
    liveMode: t.live_mode ?? true,
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
  };
  return db.mpAccount.upsert({ where: { id: "principal" }, create: { id: "principal", ...data }, update: { ...data, connectedAt: new Date() } });
}

/** Retorno do "Conectar": troca o código de autorização pelos tokens do vendedor. */
export async function connectWithCode(code: string) {
  return save(await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() }));
}

/** Conta conectada (sem os tokens), para o painel. */
export async function connectedAccount() {
  return db.mpAccount.findUnique({ where: { id: "principal" }, select: { mpUserId: true, nickname: true, liveMode: true, expiresAt: true, connectedAt: true } });
}

export async function disconnectAccount() {
  await db.mpAccount.deleteMany({ where: { id: "principal" } });
}

/** Token do vendedor para criar e consultar cobranças; renova sozinho perto do vencimento. null = ninguém conectado. */
export async function sellerAccessToken(): Promise<string | null> {
  const acc = await db.mpAccount.findUnique({ where: { id: "principal" } });
  if (!acc) return null;
  if (acc.expiresAt.getTime() - Date.now() < RENEW_BEFORE_MS && marketplaceConfigured()) {
    try {
      const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: open(acc.refreshToken) });
      await save(t);
      return t.access_token;
    } catch (e) {
      // ainda válido: segue com o atual e tenta renovar na próxima cobrança
      console.error("[mercadopago] não foi possível renovar a autorização do vendedor:", e);
      if (acc.expiresAt > new Date()) return open(acc.accessToken);
      return null;
    }
  }
  return open(acc.accessToken);
}

/** Chave pública da conta conectada (para os campos do cartão no navegador). */
export async function sellerPublicKey() {
  const acc = await db.mpAccount.findUnique({ where: { id: "principal" }, select: { publicKey: true } });
  return acc?.publicKey || null;
}
