import { Scanner } from "./scanner";

export const metadata = {
  title: "Portaria · Pérolas",
  robots: { index: false },
  // "Adicionar à tela inicial": abre em tela cheia, como aplicativo
  manifest: "/portaria.webmanifest",
  appleWebApp: { capable: true, title: "Portaria Pérolas", statusBarStyle: "black-translucent" as const },
};
export const viewport = { themeColor: "#110c2e" };

export default function PortariaPage() {
  return <Scanner />;
}
