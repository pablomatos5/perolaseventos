"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// `dev: true` = aba que só aparece para o papel de desenvolvedor (Insights e auditoria).
const NAV = [
  { href: "/admin", label: "Vendas e lotes" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cortesias", label: "Cortesias" },
  { href: "/admin/portaria", label: "Portaria" },
  { href: "/admin/insights", label: "Insights", dev: true },
  { href: "/admin/registro", label: "Registro", dev: true },
];

/** Menu do painel com a aba atual destacada. As abas de dev só entram quando `isDev`. */
export function PainelNav({ isDev = false }: { isDev?: boolean }) {
  const path = usePathname();
  return (
    <nav className="painel-nav" aria-label="Seções do painel">
      {NAV.filter((n) => !n.dev || isDev).map((n) => {
        const active = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
