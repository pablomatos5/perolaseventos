import { BrandLogo } from "@/components/brand-logo";
import { connection } from "next/server";
import { Suspense } from "react";
import { type Role, sessionRole } from "@/lib/admin-auth";
import { logoutAction } from "../actions";
import { PainelNav } from "./nav";

export const metadata = { title: "Painel · Pérolas", robots: { index: false } };

// Toda página do painel lê o cookie da sessão: navegação bloqueante é o esperado (só a equipe usa).
export const instant = false;

// Visual próprio do painel (claro e legível, na paleta da Pérolas): classe .painel no globals.css.
export default function PainelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="painel min-h-svh">
      <header className="painel-header">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
          <BrandLogo kind="wordmark" tone="ameixa" sizes="7rem" className="page-brand page-brand-sm" />
          {/* o menu e o selo dependem do cookie: leitura dentro de <Suspense> (cacheComponents ligado) */}
          <Suspense fallback={<HeaderBits />}>
            <HeaderBitsLive />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Suspense fallback={<p className="text-fg-faint">Carregando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}

/** Menu + selo de papel + botão Sair. Sem `role` (fallback) mostra só as abas da equipe, sem selo. */
function HeaderBits({ role }: { role?: Role | null }) {
  return (
    <>
      <PainelNav isDev={role === "dev"} />
      <div className="painel-header-right ml-auto flex items-center gap-3">
        {role && <span className={`painel-papel${role === "dev" ? " is-dev" : ""}`}>{role === "dev" ? "Desenvolvedor" : "Equipe"}</span>}
        <form action={logoutAction}>
          <button className="painel-sair">Sair</button>
        </form>
      </div>
    </>
  );
}

async function HeaderBitsLive() {
  await connection();
  const role = await sessionRole();
  return <HeaderBits role={role} />;
}
