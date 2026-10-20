"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Vendas e lotes" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/cortesias", label: "Cortesias" },
  { href: "/admin/portaria", label: "Portaria" },
  { href: "/admin/registro", label: "Registro" },
];

/** Menu do painel com a aba atual destacada. */
export function PainelNav() {
  const path = usePathname();
  return (
    <nav className="painel-nav" aria-label="Seções do painel">
      {NAV.map((n) => {
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
