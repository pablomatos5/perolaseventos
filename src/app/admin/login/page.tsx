import { Suspense } from "react";
import { LoginForm } from "../forms";

export const metadata = { title: "Entrar · Painel Pérolas", robots: { index: false } };

// ?next=... (ex.: o link "Conectar Mercado Pago") faz o login voltar direto para lá; a ação confere o destino.
export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <Suspense fallback={<LoginForm />}>
        <LoginWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginWithNext({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : ""} />;
}
