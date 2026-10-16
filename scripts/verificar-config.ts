// Confere o .env antes de subir o site. Não imprime nenhum valor secreto, só o que falta.
// Uso: npm run check:config          (ou NODE_ENV=production npm run check:config no servidor)
import "dotenv/config";
import { paymentMode } from "../src/lib/payment-mode";

const env = process.env;
const prod = env.NODE_ENV === "production";
const problems: string[] = [];
const warnings: string[] = [];
const ok: string[] = [];

const need = (key: string, why: string) => (env[key] ? ok.push(key) : problems.push(`${key} vazio: ${why}`));

need("DATABASE_URL", "sem banco o site não abre");
need("APP_URL", "usado nos links do e-mail e no retorno do pagamento");
need("PORTARIA_PIN", "sem PIN ninguém valida ingresso na portaria");
if ((env.ADMIN_PASSWORD ?? "").length < 8) problems.push("ADMIN_PASSWORD ausente ou com menos de 8 caracteres: painel /admin fica trancado");
else ok.push("ADMIN_PASSWORD");
if (prod && env.DATABASE_POOL_MAX === "1") warnings.push("DATABASE_POOL_MAX=1 é só para o banco local de dev: remova em produção");
if ((env.TICKET_SECRET ?? "").length < 32) problems.push("TICKET_SECRET ausente ou com menos de 32 caracteres");
else ok.push("TICKET_SECRET");

if (prod && !env.APP_URL?.startsWith("https://")) problems.push("APP_URL precisa ser https:// em produção");
if (prod && (env.PORTARIA_PIN ?? "").length < 6) warnings.push("PORTARIA_PIN curto: use 6+ dígitos em produção");

const mode = paymentMode();
if (mode === "off") {
  if (env.PAYMENT_PROVIDER === "mercadopago") problems.push("PAYMENT_PROVIDER=mercadopago mas MP_ACCESS_TOKEN está vazio");
  else if (env.PAYMENT_PROVIDER === "mock" && prod) problems.push("PAYMENT_PROVIDER=mock não funciona em produção (daria ingresso de graça)");
  else problems.push(`PAYMENT_PROVIDER="${env.PAYMENT_PROVIDER ?? ""}" inválido: use "mercadopago" (ou "mock" só em dev)`);
} else ok.push(`pagamento: ${mode}`);

if (mode === "mercadopago") {
  const token = env.MP_ACCESS_TOKEN!;
  if (token.startsWith("TEST-")) (prod ? warnings : ok).push(prod ? "MP_ACCESS_TOKEN é de TESTE: ninguém paga de verdade" : "MP_ACCESS_TOKEN de teste (sandbox)");
  else if (!prod) warnings.push("MP_ACCESS_TOKEN de PRODUÇÃO em ambiente de dev: compras serão cobradas de verdade");
  if (!env.MP_WEBHOOK_SECRET) {
    (prod ? problems : warnings).push("MP_WEBHOOK_SECRET vazio: o webhook recusa as notificações (em localhost a conciliação no retorno cobre)");
  } else ok.push("MP_WEBHOOK_SECRET");
}

if (env.RESEND_API_KEY) ok.push("e-mail: Resend");
else (prod ? problems : warnings).push("RESEND_API_KEY vazio: e-mails só aparecem no terminal, o cliente não recebe");

console.log(`Ambiente: ${prod ? "PRODUÇÃO" : "desenvolvimento"}\n`);
for (const o of ok) console.log(`  ✔ ${o}`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const p of problems) console.log(`  ✘ ${p}`);
console.log(problems.length ? `\n${problems.length} problema(s) para resolver.` : "\nPronto para rodar.");
process.exit(problems.length ? 1 : 0);
