import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Prévia do link (WhatsApp, Instagram, Facebook...) na identidade 2027 da campanha:
// céu violeta → rosa → pêssego, logo dourado com a estrela de 4 pontas no O e a pérola sobre o mar.
export const alt = "Réveillon Pérolas 2027 · Um novo ciclo. Infinitas possibilidades. · 31 de dezembro, Ponte do Assunção, Cametá-PA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (f: string) => readFile(join(process.cwd(), "assets", "fonts", f));
const STAR = "M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z";

export default async function Image() {
  const [serif, sans] = await Promise.all([font("CormorantGaramond-Regular.ttf"), font("Montserrat-SemiBold.ttf")]);
  const gold = "#8c6230";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse 55% 45% at 50% 46%, rgba(255,240,226,0.95) 0%, rgba(255,227,178,0.45) 45%, rgba(255,227,178,0) 75%), linear-gradient(180deg, #4b39b8 0%, #8a6fe3 22%, #c9a5ee 45%, #f2b1cf 66%, #ffc9a3 84%, #b99af7 100%)",
          fontFamily: "Montserrat",
          color: gold,
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 14, marginRight: -14, color: "#7b5a2c" }}>RÉVEILLON</div>
        <div style={{ display: "flex", alignItems: "center", fontFamily: "Cormorant", fontSize: 170, lineHeight: 1, letterSpacing: 6, marginTop: 6, color: gold }}>
          PÉR
          <div style={{ position: "relative", display: "flex" }}>
            O
            <svg viewBox="0 0 24 24" width="42" height="42" style={{ position: "absolute", left: 38, top: 72 }}>
              <path d={STAR} fill="#b4843f" />
            </svg>
          </div>
          LAS
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 6, fontSize: 34, letterSpacing: 16, color: "#7b5a2c" }}>
          <div style={{ width: 110, height: 2, background: "rgba(123,90,44,0.6)", marginRight: 26 }} />
          2027
          <div style={{ width: 110, height: 2, background: "rgba(123,90,44,0.6)", marginLeft: 10 }} />
        </div>
        <div style={{ marginTop: 26, fontSize: 22, letterSpacing: 7, color: "#5440a8" }}>UM NOVO CICLO. INFINITAS POSSIBILIDADES.</div>
        <div style={{ marginTop: 34, display: "flex", padding: "14px 34px", borderRadius: 999, background: "linear-gradient(90deg, #ffe3b2, #f3c98c, #c8955a)", color: "#2a1a3d", fontSize: 21, letterSpacing: 4 }}>
          31 DE DEZEMBRO · PONTE DO ASSUNÇÃO · CAMETÁ-PA
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant", data: serif, style: "normal", weight: 400 },
        { name: "Montserrat", data: sans, style: "normal", weight: 600 },
      ],
    },
  );
}
