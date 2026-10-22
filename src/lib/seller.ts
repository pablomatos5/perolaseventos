/**
 * Quem vende e como falar com ele (Decreto 7.962/2013: identificação e contato no comércio eletrônico).
 * Vem do .env da VPS e é lido a cada acesso, então trocar não precisa de novo build:
 *   SELLER_NAME       nome completo do organizador (ou nome empresarial)
 *   SELLER_CPF        CPF (só números); no site aparece mascarado: 123.***.***-45
 *   SELLER_CNPJ       se houver empresa (aparece inteiro, como manda a lei)
 *   SUPPORT_WHATSAPP  número do atendimento com DDD (só números, ex.: 91985551234)
 */
const INSTAGRAM = "perolaseventos";
export const SELLER_CITY = "Cametá – PA";

export function seller() {
  const name = process.env.SELLER_NAME?.trim() || "Pérolas Eventos";
  const cpf = (process.env.SELLER_CPF ?? "").replace(/\D/g, "");
  const cnpj = (process.env.SELLER_CNPJ ?? "").replace(/\D/g, "");
  const doc =
    cnpj.length === 14
      ? `CNPJ ${cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`
      : cpf.length === 11
        ? `CPF ${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`
        : null;
  const wa = (process.env.SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");
  const whatsapp =
    wa.length >= 10
      ? { label: `(${wa.slice(0, 2)}) ${wa.slice(2, -4)}-${wa.slice(-4)}`, url: `https://wa.me/55${wa}` }
      : null;
  return { name, doc, city: SELLER_CITY, whatsapp, instagram: { label: `@${INSTAGRAM}`, url: `https://www.instagram.com/${INSTAGRAM}/` } };
}

/** Linha de contato em texto (e-mails): WhatsApp quando houver, sempre o Instagram. */
export function supportLine() {
  const s = seller();
  return [s.whatsapp && `WhatsApp ${s.whatsapp.label}`, `Instagram ${s.instagram.label}`].filter(Boolean).join(" · ");
}
