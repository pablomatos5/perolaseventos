import { deviceFromRequest } from "@/lib/portaria-auth";

/** Confere se o código do aparelho vale (usado na ativação e ao abrir a portaria). */
export async function GET(req: Request) {
  const auth = await deviceFromRequest(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  return Response.json({ ok: true, name: auth.name });
}
