import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { seller } from "@/lib/seller";

/** Molde das páginas legais (termos e privacidade): mesmo visual noturno do pedido, texto em card claro. */
export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: React.ReactNode; updated: string; children: React.ReactNode }) {
  const s = seller();
  return (
    <main className="pagina-noite mx-auto w-full max-w-2xl px-5 py-10">
      <Link href="/" className="page-logo" aria-label="Início">
        <BrandLogo kind="reveillon" tone="dourado" sizes="16rem" priority />
      </Link>
      <span className="eyebrow rule flex">{eyebrow}</span>
      <h1 className="display mt-4 text-[clamp(2rem,6vw,3rem)]!">{title}</h1>
      <p className="mt-2 text-xs text-fg-faint">Atualizado em {updated}</p>
      <article className="legal glass-card mt-8 p-6 md:p-8">{children}</article>
      <p className="mt-6 text-center text-xs text-fg-faint">
        {s.name}
        {s.doc && ` · ${s.doc}`} · {s.city} ·{" "}
        <Link href="/termos" className="underline">
          Termos de compra
        </Link>{" "}
        ·{" "}
        <Link href="/privacidade" className="underline">
          Privacidade
        </Link>{" "}
        ·{" "}
        <Link href="/" className="underline">
          Voltar para o site
        </Link>
      </p>
    </main>
  );
}

/** Formas de contato do atendimento, com links. */
export function SupportContacts() {
  const s = seller();
  return (
    <>
      {s.whatsapp && (
        <>
          WhatsApp{" "}
          <a href={s.whatsapp.url} target="_blank" rel="noopener noreferrer">
            {s.whatsapp.label}
          </a>{" "}
          ou{" "}
        </>
      )}
      Instagram{" "}
      <a href={s.instagram.url} target="_blank" rel="noopener noreferrer">
        {s.instagram.label}
      </a>
    </>
  );
}
