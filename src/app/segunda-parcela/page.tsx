import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { FindOrderForm } from "@/components/find-order-form";

export const metadata = { title: "Pagar 2ª parcela do Pix · Pérolas", robots: { index: false } };

/** Atalho para quem comprou no Pix em 2x: o mesmo "Encontrar meu pedido" (CPF + e-mail), que abre direto
 *  o pedido com a 2ª parcela em aberto e o Pix para pagar. */
export default function SecondInstallmentPage() {
  return (
    <main className="pagina-noite mx-auto w-full max-w-md px-5 py-10">
      <Link href="/" className="page-logo" aria-label="Início">
        <BrandLogo kind="reveillon" tone="dourado" sizes="16rem" priority />
      </Link>
      <span className="eyebrow rule flex">Pix em 2x</span>
      <h1 className="display mt-4 text-[clamp(2rem,7vw,3rem)]!">
        Pagar a <em>2ª parcela</em>
      </h1>
      <p className="mt-3 mb-8 text-sm text-fg-muted">
        Informe o CPF e o e-mail que você usou na compra. Seu pedido abre na hora com o Pix da 2ª parcela; assim que ela for paga, os ingressos são liberados.
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
