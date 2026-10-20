import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/audit";
import { connectWithCode } from "@/lib/mp-account";

/** Retorno da autorização do Mercado Pago: confere o "state" e troca o código pelos tokens do vendedor. */
export async function GET(req: Request) {
  await requireAdmin();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expected = jar.get("mp_oauth_state")?.value ?? "";
  jar.delete({ name: "mp_oauth_state", path: "/api/mercadopago/conectar" });

  const sameState = expected.length > 0 && expected.length === state.length && timingSafeEqual(Buffer.from(expected), Buffer.from(state));
  if (!code || !sameState) redirect("/admin?mp=recusado");

  let result = "conectado";
  try {
    const acc = await connectWithCode(code);
    await audit("painel", "conectou a conta Mercado Pago do evento", `${acc.nickname || "conta"} (${acc.mpUserId})`);
  } catch (e) {
    console.error("[mercadopago] falha ao conectar a conta:", e);
    result = "erro";
  }
  redirect(`/admin?mp=${result}`);
}
