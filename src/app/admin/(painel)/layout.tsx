import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "../actions";

export const metadata = { title: "Painel · Pérolas", robots: { index: false } };

// Toda página do painel lê o cookie da sessão: navegação bloqueante é o esperado (só a equipe usa).
export const instant = false;

const NAV = [
  { href: "/admin", label: "Vendas e lotes" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cortesias", label: "Cortesias" },
  { href: "/admin/portaria", label: "Portaria" },
  { href: "/admin/registro", label: "Registro" },
];

export default function PainelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4">
          <span className="font-display text-2xl italic">Pérolas</span>
          <nav className="flex flex-1 flex-wrap gap-x-5 gap-y-1 text-sm text-fg-muted">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="hover:text-accent">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction}>
            <button className="text-sm text-fg-faint hover:text-fg">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <Suspense fallback={<p className="text-fg-faint">Carregando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
