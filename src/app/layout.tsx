import type { Metadata, Viewport } from "next";
import { Cinzel, Cormorant_Garamond, Montserrat } from "next/font/google";
import { CURRENT_EDITION } from "@/content/site";
import "./globals.css";

// logo "PÉROLAS 2K27" (romana clássica das artes oficiais)
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600"],
});

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
    <html lang="pt-BR" suppressHydrationWarning data-edition={CURRENT_EDITION} className={`${cinzel.variable} ${cormorant.variable} ${montserrat.variable} h-full antialiased`}>
      <head>
        {/* Modo leve: só aparelho realmente fraco (≤2 GB, ≤2 núcleos) ou economia de dados desliga os enfeites
            animados. Roda antes da primeira pintura para não "pular" visualmente. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var n=navigator,m=n.deviceMemory||8,c=n.hardwareConcurrency||8,s=n.connection&&n.connection.saveData;if(m<=2||c<=2||s)document.documentElement.classList.add("lite")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
