import { ImageResponse } from "next/og";

// Ícone de "Adicionar à Tela de Início" no iPhone.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 40%, #3a2a78 0%, #1b1236 50%, #0c0719 100%)",
        }}
      >
        <div style={{ position: "absolute", width: 140, height: 140, borderRadius: 999, border: "2px solid rgba(243,194,126,0.5)" }} />
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            background: "radial-gradient(circle at 32% 28%, #ffffff 0%, #ffffff 16%, #f4ecff 42%, #b9a3e8 100%)",
            boxShadow: "0 0 30px 6px rgba(255,222,190,0.45)",
          }}
        />
      </div>
    ),
    size,
  );
}
