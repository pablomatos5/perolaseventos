import Link from "next/link";

export const metadata = { title: "Página não encontrada · Pérolas" };

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center px-5 text-center">
      <div className="grid justify-items-center gap-5">
        <div className="pearl w-20" aria-hidden />
        <span className="eyebrow">Erro 404</span>
        <h1 className="display text-[clamp(2.4rem,8vw,4.5rem)]!">
          Essa pérola <em>se perdeu</em>
        </h1>
        <p className="max-w-sm text-fg-muted">O endereço não existe ou o link expirou. Volte para o início para ver os ingressos do Réveillon.</p>
        <Link href="/" className="btn solid mt-2">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
}
