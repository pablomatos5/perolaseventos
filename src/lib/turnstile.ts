// Verificação anti-robô Cloudflare Turnstile (gratuita, normalmente invisível para o cliente).
// Liga sozinha quando NEXT_PUBLIC_TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY estão no .env;
// sem as chaves o checkout funciona sem ela (os limites por IP/CPF continuam valendo).

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function turnstileEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string, ip: string) {
  if (!turnstileEnabled()) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    // Cloudflare fora do ar não pode travar as vendas: deixa passar e registra (os limites por IP seguem).
    console.error("[turnstile] verificação indisponível:", e);
    return true;
  }
}
