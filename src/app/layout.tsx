import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { CURRENT_EDITION } from "@/content/site";
import { connection } from "next/server";
import { Suspense } from "react";
import { isDemo } from "@/lib/payment-mode";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

const description = "Réveillon Pérolas 2K27, 6ª edição: 7 horas de open bar e a virada mais exclusiva de Cametá-PA. Ingressos por lotes, com QR code no celular.";

export const metadata: Metadata = {
  // links absolutos da prévia (WhatsApp/Instagram) apontam para o domínio do site
  metadataBase: new URL(process.env.APP_URL ?? "https://perolaseventos.store"),
  title: { default: "Réveillon Pérolas 2K27 · Ingressos", template: "%s" },
  description,
  openGraph: { type: "website", locale: "pt_BR", siteName: "Pérolas Eventos", title: "Réveillon Pérolas 2K27 · 6ª edição", description },
  twitter: { card: "summary_large_image", title: "Réveillon Pérolas 2K27", description },
};

// barra do navegador (iPhone/Android) na cor da noite do site
export const viewport: Viewport = { themeColor: "#0c0719", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-edition={CURRENT_EDITION} className={`${cormorant.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <DemoRibbon />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

/** Faixa do modo demonstração: lida a cada acesso (trocar o .env para vendas reais a remove sem novo build). */
async function DemoRibbon() {
  await connection();
  if (!isDemo()) return null;
  return (
    <div className="demo-ribbon" role="note">
      Demonstração · nenhum pagamento é cobrado e os ingressos de teste não valem para o evento
    </div>
  );
}
