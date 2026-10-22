import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { FindOrderForm } from "@/components/find-order-form";

export const metadata = { title: "Encontrar meu pedido · Pérolas", robots: { index: false } };

/** Comprador perdeu o link do pedido (não temos login): CPF + e-mail → o link chega no e-mail cadastrado. */
export default function FindOrderPage() {
  return (
    <main className="pagina-noite mx-auto w-full max-w-md px-5 py-10">
      <Link href="/" className="page-logo" aria-label="Início">
        <BrandLogo kind="reveillon" tone="dourado" sizes="16rem" priority />
      </Link>
      <span className="eyebrow rule flex">Meu pedido</span>
      <h1 className="display mt-4 text-[clamp(2rem,7vw,3rem)]!">
        Encontrar meu <em>pedido</em>
      </h1>
      <p className="mt-3 mb-8 text-sm text-fg-muted">
        Perdeu o link dos seus ingressos ou do Pix em 2x? Informe o CPF e o e-mail que você usou na compra: mandamos o link de novo para esse e-mail.
      </p>
      <FindOrderForm />
      <p className="mt-6 text-center text-xs text-fg-faint">
        <Link href="/" className="underline">
          Voltar para o site
        </Link>
      </p>
    </main>
  );
}
