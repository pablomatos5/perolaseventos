import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { authorizeUrl, marketplaceConfigured } from "@/lib/mp-account";

/**
 * Botão "Conectar Mercado Pago" do painel: manda o dono do evento à página de autorização do Mercado Pago.
 * O "state" aleatório (cookie de 10 min) impede que alguém forje o retorno com o código de outra conta.
 */
export async function GET() {
  // sem login: pede a senha do painel e volta direto para cá (link único para o dono do evento)
  if (!(await isAdmin())) redirect("/admin/login?next=/api/mercadopago/conectar");
  if (!marketplaceConfigured()) redirect("/admin?mp=sem-aplicacao");
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set("mp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/mercadopago/conectar",
    maxAge: 600,
  });
  redirect(authorizeUrl(state));
}
