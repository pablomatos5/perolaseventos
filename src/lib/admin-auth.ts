import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Sessão do painel: cookie "<papel>.<expira>.<hmac>" assinado com TICKET_SECRET. Sem banco, sem tabela de usuários.
// Duas entradas pela MESMA tela de login, muda só a senha:
//   • equipe da Pérolas → ADMIN_PASSWORD (papel "admin": vendas, pedidos, cortesias, portaria)
//   • desenvolvedores    → DEV_PASSWORD  (papel "dev": tudo acima + Insights e Registro de auditoria)
// Trocar a senha não derruba sessões abertas; trocar o TICKET_SECRET derruba (e invalida QR codes, então não faça isso perto do evento).
const COOKIE = "pe_admin";
const TTL_SECONDS = 12 * 60 * 60;

export type Role = "admin" | "dev";

function sign(role: Role, exp: number) {
  const secret = process.env.TICKET_SECRET;
  if (!secret) throw new Error("TICKET_SECRET ausente");
  return createHmac("sha256", secret).update(`${role}.${exp}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Confere a senha digitada e devolve o papel correspondente, ou null. Senha vazia/curta = aquele acesso fica desligado. */
export function checkPassword(given: string): Role | null {
  // dev primeiro: se alguém reaproveitar a mesma senha, o acesso maior vence
  const dev = process.env.DEV_PASSWORD ?? "";
  if (dev.length >= 8 && safeEqual(given, dev)) return "dev";
  const admin = process.env.ADMIN_PASSWORD ?? "";
  if (admin.length >= 8 && safeEqual(given, admin)) return "admin";
  return null;
}

/** Papel da sessão atual, ou null se não houver sessão válida. O cookie antigo (2 partes) vale como "admin". */
export async function sessionRole(): Promise<Role | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const parts = value.split(".");
  // novo: papel.exp.hmac · antigo: exp.hmac (sempre admin)
  const [role, expStr, sig] = parts.length === 3 ? parts : ["admin", parts[0], parts[1]];
  if (role !== "admin" && role !== "dev") return null;
  const exp = Number(expStr);
  if (!exp || !sig || exp * 1000 < Date.now()) return null;
  return safeEqual(sig, sign(role, exp)) ? role : null;
}

/** Tem sessão (equipe ou dev). O dev também passa como admin: enxerga tudo. */
export async function isAdmin() {
  return (await sessionRole()) !== null;
}

/** É uma sessão de desenvolvedor (acesso elevado). */
export async function isDev() {
  return (await sessionRole()) === "dev";
}

/** Use no começo de TODA página e Server Action do painel: ações são alcançáveis por POST direto. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** Páginas só de dev (Insights, Registro): sem sessão → login; equipe sem papel dev → volta ao painel. */
export async function requireDev() {
  const role = await sessionRole();
  if (role === null) redirect("/admin/login");
  if (role !== "dev") redirect("/admin");
}

export async function startSession(role: Role) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  (await cookies()).set(COOKIE, `${role}.${exp}.${sign(role, exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}
