import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Prévia do link (WhatsApp, Instagram, Facebook...): gerada no build com as fontes do site.
export const alt = "Réveillon Pérolas 2K27 · 6ª edição · Cametá-PA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (f: string) => readFile(join(process.cwd(), "assets", "fonts", f));

export default async function Image() {
  const [display, sans] = await Promise.all([font("CormorantGaramond-LightItalic.ttf"), font("Montserrat-SemiBold.ttf")]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          background: "radial-gradient(circle at 78% 45%, #3a2a78 0%, #1b1236 38%, #0c0719 78%)",
          color: "#fff",
          fontFamily: "Montserrat",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 26, letterSpacing: 12, color: "#f3c27e" }}>RÉVEILLON</div>
          <div style={{ fontFamily: "Cormorant", fontStyle: "italic", fontSize: 190, lineHeight: 1, marginTop: 6 }}>Pérolas</div>
          <div style={{ fontSize: 26, letterSpacing: 8, color: "#ffe3b8", marginTop: 14 }}>2K27 · 6ª EDIÇÃO</div>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.72)", marginTop: 34 }}>31 de dezembro · Cametá-PA · 7 horas de open bar</div>
          <div
            style={{
              display: "flex",
              marginTop: 34,
              padding: "16px 34px",
              borderRadius: 999,
              background: "linear-gradient(90deg, #ffe3b8, #f3c27e, #c98f4a)",
              color: "#140c26",
              fontSize: 22,
              letterSpacing: 4,
              alignSelf: "flex-start",
            }}
          >
            INGRESSOS À VENDA
          </div>
        </div>
        {/* pérola com aros dourados */}
        <div style={{ position: "relative", width: 380, height: 380, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", width: 380, height: 380, borderRadius: 999, border: "2px solid rgba(243,194,126,0.35)" }} />
          <div style={{ position: "absolute", width: 300, height: 300, borderRadius: 999, border: "2px solid rgba(243,194,126,0.55)" }} />
          <div
            style={{
              width: 210,
              height: 210,
              borderRadius: 999,
              background: "radial-gradient(circle at 32% 28%, #ffffff 0%, #ffffff 14%, #f4ecff 40%, #b9a3e8 100%)",
              boxShadow: "0 0 80px 20px rgba(255,222,190,0.35)",
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant", data: display, style: "italic", weight: 300 },
        { name: "Montserrat", data: sans, style: "normal", weight: 600 },
      ],
    },
  );
}
