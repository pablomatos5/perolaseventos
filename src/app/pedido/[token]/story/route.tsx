import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { verifyOrderToken } from "@/lib/tokens";

// "Presença confirmada" em formato de story (1080×1920), na identidade do flyer oficial 2027.
// Só para pedido pago. Sem QR nem dados do ingresso: é para postar.

const asset = (...p: string[]) => readFile(join(process.cwd(), "assets", ...p));
const dataUrl = async (file: string, type: string) => `data:${type};base64,${(await asset("story", file)).toString("base64")}`;
let cache: Promise<{ fonts: { cinzel: Buffer; corm: Buffer; cormIt: Buffer; sans: Buffer }; img: Record<string, string> }> | null = null;
const load = () =>
  (cache ??= (async () => ({
    fonts: {
      cinzel: await asset("fonts", "Cinzel.ttf"),
      corm: await asset("fonts", "CormorantGaramond-Regular.ttf"),
      cormIt: await asset("fonts", "CormorantGaramond-Italic.ttf"),
      sans: await asset("fonts", "Montserrat-SemiBold.ttf"),
    },
    img: {
      logo: await dataUrl("logo.png", "image/png"),
      sereiaEsq: await dataUrl("sereia-esq.png", "image/png"),
      sereiaDir: await dataUrl("sereia-dir.png", "image/png"),
      mar: await dataUrl("mar.jpg", "image/jpeg"),
    },
  }))());

const GOLD = "linear-gradient(180deg, #fff1c4 0%, #f2cf7a 35%, #d9a54a 60%, #b47c2c 100%)";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  // ?f=feed → post do feed (1080×1350); padrão → story (1080×1920)
  const feed = new URL(req.url).searchParams.get("f") === "feed";
  const H = feed ? 1350 : 1920;
  const k = feed ? 0.7 : 1; // espaçamentos verticais
  await connection();
  const orderId = verifyOrderToken(decodeURIComponent((await ctx.params).token));
  if (!orderId) return new Response("Pedido inválido", { status: 404 });
  const order = await db.order.findUnique({ where: { id: orderId }, include: { event: true, _count: { select: { tickets: true } } } });
  if (!order || order.status !== "PAID") return new Response("Pedido sem pagamento confirmado", { status: 404 });

  const { fonts, img } = await load();
  const raw = order.buyerName.trim().split(/\s+/)[0].slice(0, 18).toLocaleLowerCase("pt-BR");
  const first = raw.charAt(0).toLocaleUpperCase("pt-BR") + raw.slice(1);
  const tz = "America/Belem";
  const dmy = order.event.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz }).split("/").join(" · ");
  const n = order._count.tickets;

  const star = (x: number, y: number, s: number, o = 1) => (
    <svg key={`${x}-${y}`} width={s} height={s} viewBox="0 0 24 24" style={{ position: "absolute", left: x, top: y, opacity: o }}>
      <path d="M12 0C12.5 8 16 11.5 24 12 16 12.5 12.5 16 12 24 11.5 16 8 12.5 0 12 8 11.5 11.5 8 12 0Z" fill="#f6d98e" />
    </svg>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          background: "linear-gradient(180deg, #1c1550 0%, #3b2a8f 18%, #6a4ecf 38%, #b98ae6 56%, #f2a8c7 70%, #ffc9a3 80%, #ffd9b0 84%)",
          fontFamily: "Montserrat",
        }}
      >
        {/* moldura dourada fina, como no flyer */}
        <div style={{ position: "absolute", left: 36, top: 36, right: 36, bottom: 36, border: "2px solid rgba(240,196,119,0.75)", borderRadius: 28, display: "flex" }} />
        {star(120, 150, 34)}
        {star(900, 230, 44)}
        {star(180, 470, 22, 0.8)}
        {star(860, 560, 26, 0.85)}
        {star(80, 820, 18, 0.7)}
        {star(980, 900, 20, 0.7)}

        {/* selo do topo */}
        <div style={{ marginTop: 90 * k, display: "flex", alignItems: "center", padding: "14px 34px", borderRadius: 999, border: "2px solid rgba(240,196,119,0.8)", background: "rgba(28,21,80,0.55)", color: "#f6e3b5", fontSize: 26, letterSpacing: 8 }}>
          6ª EDIÇÃO
          <svg width={22} height={22} viewBox="0 0 24 24" style={{ margin: "0 14px" }}><path d="M12 0C12.5 8 16 11.5 24 12 16 12.5 12.5 16 12 24 11.5 16 8 12.5 0 12 8 11.5 11.5 8 12 0Z" fill="#f2cf7a" /></svg>
          UMA NOVA ERA
        </div>

        {/* logo do site (concha + PÉROLAS 2K27) */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- imagem dentro da ImageResponse */}
        <img alt="" src={img.logo} width={feed ? 760 : 900} height={Math.round(((feed ? 760 : 900) * 371) / 900)} style={{ marginTop: 60 * k }} />

        {/* presença confirmada */}
        <div style={{ marginTop: 40 * k, display: "flex", fontFamily: "CormorantItalic", fontSize: feed ? 56 : 64, color: "#fff", textShadow: "0 2px 18px rgba(60,30,110,0.5)" }}>
          {first}, presença
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            fontFamily: "Cinzel",
            fontSize: feed ? 96 : 112,
            letterSpacing: 6,
            backgroundImage: GOLD,
            backgroundClip: "text",
            color: "transparent",
            textShadow: "0 3px 0 rgba(122,76,22,0.35)",
          }}
        >
          CONFIRMADA
        </div>
        <div style={{ marginTop: 18, display: "flex", fontSize: 26, letterSpacing: 6, color: "#3a2a7a" }}>
          {n > 1 ? `${n} INGRESSOS GARANTIDOS` : "INGRESSO GARANTIDO"}
        </div>

        {/* data e local */}
        <div style={{ marginTop: 56 * k, display: "flex", alignItems: "center", gap: 28 }}>
          <div style={{ width: 120, height: 2, background: "linear-gradient(90deg, transparent, #b47c2c)" }} />
          <div style={{ display: "flex", fontFamily: "Cinzel", fontSize: 64, color: "#8a5c26", letterSpacing: 2 }}>{dmy}</div>
          <div style={{ width: 120, height: 2, background: "linear-gradient(90deg, #b47c2c, transparent)" }} />
        </div>
        <div style={{ marginTop: 6, display: "flex", fontFamily: "Cinzel", fontSize: 44, color: "#8a5c26", letterSpacing: 4 }}>{order.event.venue.toUpperCase()}</div>

        {/* mar e sereias */}
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- imagem dentro da ImageResponse */}
        <img alt="" src={img.mar} width={1080} height={feed ? 260 : 420} style={{ position: "absolute", left: 0, bottom: 0, objectFit: "cover" }} />
        {/* borda de cima do mar se dissolve no céu */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: feed ? 170 : 300, height: feed ? 110 : 140, display: "flex", background: "linear-gradient(180deg, rgba(255,217,176,1), rgba(255,217,176,0))" }} />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- imagem dentro da ImageResponse */}
        <img alt="" src={img.sereiaEsq} height={feed ? 560 : 780} style={{ position: "absolute", left: feed ? -70 : -120, bottom: feed ? 110 : 230 }} />
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- imagem dentro da ImageResponse */}
        <img alt="" src={img.sereiaDir} height={feed ? 560 : 780} style={{ position: "absolute", right: feed ? -70 : -120, bottom: feed ? 110 : 230 }} />

        {/* rodapé */}
        <div style={{ position: "absolute", bottom: feed ? 60 : 96, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", color: "#fff" }}>
          <div style={{ display: "flex", fontFamily: "CormorantItalic", fontSize: 50, textShadow: "0 2px 6px rgba(40,20,90,0.85), 0 2px 22px rgba(40,20,90,0.9)" }}>Te vejo na virada</div>
          <div style={{ marginTop: 14, display: "flex", fontSize: 28, letterSpacing: 6, textShadow: "0 2px 6px rgba(40,20,90,0.85), 0 2px 18px rgba(40,20,90,0.9)" }}>@PEROLASEVENTOS</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: H,
      headers: { "Cache-Control": "private, no-store", "Content-Disposition": `inline; filename="presenca-confirmada-perolas${feed ? "-feed" : ""}.png"` },
      fonts: [
        { name: "Cinzel", data: fonts.cinzel, weight: 600, style: "normal" },
        { name: "Cormorant", data: fonts.corm, weight: 400, style: "normal" },
        { name: "CormorantItalic", data: fonts.cormIt, weight: 400, style: "normal" },
        { name: "Montserrat", data: fonts.sans, weight: 600, style: "normal" },
      ],
    },
  );
}
