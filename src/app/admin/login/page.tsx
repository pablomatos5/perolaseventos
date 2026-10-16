import { LoginForm } from "../forms";

export const metadata = { title: "Entrar · Painel Pérolas", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="grid min-h-svh place-items-center p-6">
      <LoginForm />
    </main>
  );
}
