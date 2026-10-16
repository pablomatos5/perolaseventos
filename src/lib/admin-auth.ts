import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Sessão do painel: cookie "<expira>.<hmac>" assinado com TICKET_SECRET. Sem banco, sem tabela de usuários.
// Uma senha só (ADMIN_PASSWORD) para a equipe da Pérolas; trocar a senha não derruba sessões abertas,
// trocar o TICKET_SECRET derruba (e invalida QR codes, então não faça isso perto do evento).
const COOKIE = "pe_admin";
const TTL_SECONDS = 12 * 60 * 60;

function sign(exp: number) {
  const secret = process.env.TICKET_SECRET;
  if (!secret) throw new Error("TICKET_SECRET ausente");
  return createHmac("sha256", secret).update(`admin.${exp}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function passwordOk(given: string) {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  // senha vazia ou curta = painel desligado
  return expected.length >= 8 && safeEqual(given, expected);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!exp || !sig || exp * 1000 < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

/** Use no começo de TODA página e Server Action do painel: ações são alcançáveis por POST direto. */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function startSession() {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
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
