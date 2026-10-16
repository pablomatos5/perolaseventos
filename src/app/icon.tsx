import { ImageResponse } from "next/og";

// Ícone da aba: uma pérola sobre a noite lilás (substitui o favicon padrão do Next).
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0719", borderRadius: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "radial-gradient(circle at 32% 28%, #ffffff 0%, #ffffff 16%, #f4ecff 42%, #b9a3e8 100%)",
            boxShadow: "0 0 10px 2px rgba(243,194,126,0.6)",
          }}
        />
      </div>
    ),
    size,
  );
}
