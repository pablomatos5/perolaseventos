import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { formatBRL } from "@/lib/format";
import { isDemo } from "@/lib/payment-mode";
import { qrMatrix } from "@/lib/qr";
import { ticketToken } from "@/lib/tokens";

// Ingresso em PDF: uma página por ingresso, formato "de bolso" (bom na tela do celular e impresso).
// Fontes do site (Cormorant Garamond + Montserrat, OFL) em assets/fonts; QR desenhado em vetor.

export type PdfTicket = {
  id: string;
  qrVersion: number;
  holder: string;
  type: string;
  batch: string;
  half: boolean;
  priceCents: number;
  usedAt: Date | null;
};
export type PdfEvent = { name: string; edition: string; startsAt: Date; venue: string; city: string };

const W = 420;
const H = 980;
const M = 30; // margem

// paleta 2K27 (globals.css [data-edition="2k27"])
const C = {
  bg: hex("#0c0719"),
  bgAlt: hex("#1b1236"),
  sea: hex("#5a43b8"),
  gold: hex("#f3c27e"),
  goldLight: hex("#ffe3b8"),
  goldInk: hex("#c98f4a"),
  white: rgb(1, 1, 1),
  muted: rgb(0.78, 0.76, 0.84),
  faint: rgb(0.55, 0.52, 0.64),
  pearl: hex("#f4ecff"),
  ink: hex("#140c26"),
  // identidade 2027 (artes oficiais): texto escuro sobre o degradê violeta → pêssego
  violet: hex("#6a4ecf"),
  deep: hex("#2e2466"),
  soft: hex("#4f4488"),
  brown: hex("#8c6230"),
  cream: hex("#ffe3b2"),
};
function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontBytes: Promise<Record<string, Uint8Array>> | null = null;
let bgBytes: Promise<Uint8Array> | null = null;
function loadFonts() {
  const files = {
    display: "CormorantGaramond-LightItalic.ttf",
    serif: "CormorantGaramond-Regular.ttf",
    serifItalic: "CormorantGaramond-Italic.ttf",
    sans: "Montserrat-Regular.ttf",
    sansMedium: "Montserrat-Medium.ttf",
    sansBold: "Montserrat-SemiBold.ttf",
  };
  fontBytes ??= Promise.all(Object.entries(files).map(async ([k, f]) => [k, await readFile(path.join(FONT_DIR, f))] as const)).then(Object.fromEntries);
  return fontBytes;
}

const TZ = "America/Belem";
const dateLong = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const weekday = (d: Date) => d.toLocaleDateString("pt-BR", { weekday: "long", timeZone: TZ });
const hour = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(":00", "h").replace(":", "h");

/** Gera o PDF com um ingresso por página. */
export async function ticketsPdf(opts: { event: PdfEvent; orderCode: string; tickets: PdfTicket[]; totalInOrder?: number; startIndex?: number }) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Ingressos · ${opts.event.name} ${opts.event.edition}`);
  doc.setAuthor("Pérolas Eventos");
  doc.setSubject(`Pedido ${opts.orderCode}`);
  doc.setCreator("perolaseventos.store");
  const b = await loadFonts();
  const F = {
    display: await doc.embedFont(b.display, { subset: true }),
    serif: await doc.embedFont(b.serif, { subset: true }),
    serifItalic: await doc.embedFont(b.serifItalic, { subset: true }),
    sans: await doc.embedFont(b.sans, { subset: true }),
    sansMedium: await doc.embedFont(b.sansMedium, { subset: true }),
    sansBold: await doc.embedFont(b.sansBold, { subset: true }),
  };
  const total = opts.totalInOrder ?? opts.tickets.length;
  // fundo: degradê das artes 2027 (assets/pdf/fundo-2027.png esticado, sem faixas)
  const glow = await doc.embedPng(await (bgBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "fundo-2027.png"))));
  opts.tickets.forEach((t, i) => drawTicket(doc.addPage([W, H]), F, glow, opts.event, opts.orderCode, t, (opts.startIndex ?? 0) + i + 1, total));
  return doc.save();
}

type Fonts = Record<"display" | "serif" | "serifItalic" | "sans" | "sansMedium" | "sansBold", PDFFont>;

function drawTicket(p: PDFPage, F: Fonts, glow: PDFImage, ev: PdfEvent, orderCode: string, t: PdfTicket, n: number, total: number) {
  // ── fundo: céu da campanha 2027 (violeta no alto → pêssego embaixo) ──
  p.drawImage(glow, { x: 0, y: 0, width: W, height: H });
  // estrelas fixas no céu (posições determinísticas)
  const stars = [[40, 50, 1.1], [92, 76, 0.7], [318, 34, 0.9], [372, 78, 1.2], [356, 120, 0.6], [58, 130, 0.8], [384, 180, 0.7], [24, 208, 0.6], [210, 22, 0.8]];
  for (const [x, dy, r] of stars) p.drawCircle({ x, y: H - dy, size: r, color: C.white, opacity: 0.8 });
  drawStar(p, 330, H - 60, 7, C.cream, 0.9);
  drawStar(p, 82, H - 168, 5, C.cream, 0.7);

  // ── pérola com brilho, como na arte principal ──
  const py = H - 78;
  p.drawCircle({ x: W / 2, y: py, size: 34, color: C.cream, opacity: 0.18 });
  p.drawCircle({ x: W / 2, y: py, size: 22, color: C.cream, opacity: 0.28 });
  p.drawCircle({ x: W / 2, y: py, size: 15, color: hex("#f7efe6") });
  p.drawCircle({ x: W / 2 - 4.5, y: py + 4.5, size: 5.5, color: C.white, opacity: 0.95 });

  // ── logo RÉVEILLON PÉROLAS 2027, com a estrela de 4 pontas no O ──
  const year = ev.edition.replace(/^2K/i, "20");
  center(p, "RÉVEILLON", H - 132, F.sansMedium, 9.5, C.cream, 4.5);
  const name = "PÉROLAS";
  const ns = 50;
  const sp = 1.5;
  const nw = F.serif.widthOfTextAtSize(name, ns) + (name.length - 1) * sp;
  text(p, name, (W - nw) / 2, H - 182, F.serif, ns, C.cream, sp);
  // estrela dentro do O (4ª letra)
  const before = F.serif.widthOfTextAtSize("PÉR", ns) + 3 * sp;
  const ow = F.serif.widthOfTextAtSize("O", ns);
  drawStar(p, (W - nw) / 2 + before + ow / 2, H - 182 + ns * 0.34, 6.5, C.cream, 1);
  const yw = F.sansMedium.widthOfTextAtSize(year, 13) + (year.length - 1) * 5;
  center(p, year, H - 210, F.sansMedium, 13, C.cream, 5);
  p.drawLine({ start: { x: W / 2 - yw / 2 - 62, y: H - 205 }, end: { x: W / 2 - yw / 2 - 12, y: H - 205 }, thickness: 0.6, color: C.cream, opacity: 0.8 });
  p.drawLine({ start: { x: W / 2 + yw / 2 + 12, y: H - 205 }, end: { x: W / 2 + yw / 2 + 62, y: H - 205 }, thickness: 0.6, color: C.cream, opacity: 0.8 });
  center(p, "UM NOVO CICLO. INFINITAS POSSIBILIDADES.", H - 236, F.sansBold, 6.8, C.white, 2.4);

  // ── painel de informações ──
  const top = H - 272;
  const panelH = 196;
  roundRect(p, M, top - panelH, W - 2 * M, panelH, 14, C.white, 0.62, C.brown, 0.4);
  const colL = M + 18;
  const colR = W / 2 + 8;
  const cell = (x: number, y: number, label: string, value: string, sub?: string) => {
    text(p, label, x, y, F.sansBold, 7, C.violet, 2.2);
    text(p, fit(value, F.serif, 17, W / 2 - 46), x, y - 20, F.serif, 17, C.deep);
    if (sub) text(p, fit(sub, F.sans, 8.5, W / 2 - 46), x, y - 34, F.sans, 8.5, C.soft);
  };
  cell(colL, top - 26, "DATA", dateLong(ev.startsAt), weekday(ev.startsAt));
  cell(colR, top - 26, "HORÁRIO", `A partir das ${hour(ev.startsAt)}`, "Abertura dos portões");
  cell(colL, top - 86, "LOCAL", ev.venue, ev.city);
  cell(colR, top - 86, "SETOR", t.type, t.batch);
  cell(colL, top - 146, "INGRESSO", t.half ? "Meia-entrada" : "Inteira", t.half ? "Leve o documento" : undefined);
  cell(colR, top - 146, "VALOR", t.priceCents > 0 ? formatBRL(t.priceCents) : "Cortesia");

  // ── titular ──
  const hy = top - panelH - 34;
  center(p, "TITULAR", hy, F.sansBold, 7, C.violet, 2.2);
  center(p, fit(t.holder, F.serifItalic, 25, W - 2 * M), hy - 28, F.serifItalic, 25, C.deep);

  // ── picote do canhoto ──
  const cutY = hy - 52;
  for (let x = M; x < W - M; x += 9) p.drawLine({ start: { x, y: cutY }, end: { x: x + 4.5, y: cutY }, thickness: 0.8, color: C.brown, opacity: 0.6 });
  drawStar(p, W / 2, cutY, 4.5, C.brown, 0.8);

  // ── QR em vetor sobre branco (a matriz já inclui a margem de 4 módulos exigida) ──
  const qrSize = 214;
  const qrX = (W - qrSize) / 2;
  const qrY = cutY - 28 - qrSize;
  roundRect(p, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 14, C.white, 1);
  const { size, dark } = qrMatrix(ticketToken(t.id, t.qrVersion));
  const q = 4; // zona quieta em módulos
  const mod = qrSize / (size + 2 * q);
  // um único caminho preenchido (faixas horizontais de módulos escuros): sem frestas entre os quadradinhos
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!dark(x, y)) continue;
      let run = 1;
      while (x + run < size && dark(x + run, y)) run++;
      const px = (x + q) * mod, py = (y + q) * mod;
      d += `M${px.toFixed(3)} ${py.toFixed(3)}h${(run * mod).toFixed(3)}v${mod.toFixed(3)}h${(-run * mod).toFixed(3)}z`;
      x += run - 1;
    }
  }
  p.drawSvgPath(d, { x: qrX, y: qrY + qrSize, color: rgb(0, 0, 0) });
  center(p, `Ingresso ${n} de ${total}  ·  Pedido ${orderCode}`, qrY - 30, F.sansMedium, 9, C.deep);
  center(p, `Nº ${t.id.slice(-10).toUpperCase()}${t.qrVersion ? ` · v${t.qrVersion}` : ""}`, qrY - 44, F.sans, 7.5, C.soft, 1);

  // ── regras ──
  const rules = [
    "Apresente este QR na entrada, na tela do celular ou impresso.",
    "Vale uma entrada: depois de lido, o mesmo QR não passa de novo. Não compartilhe nem poste.",
    "Se o nome do titular for trocado no site, este PDF deixa de valer: baixe o novo.",
    ...(t.half ? ["Meia-entrada: apresente o documento que comprova o direito (Lei 12.933/2013)."] : []),
  ];
  let ry = qrY - 70;
  for (const r of rules) {
    for (const line of wrap(r, F.sans, 7.6, W - 2 * M - 10)) {
      center(p, line, ry, F.sans, 7.6, C.soft);
      ry -= 11;
    }
    ry -= 3;
  }
  center(p, "perolaseventos.store  ·  @perolaseventos", 30, F.sansBold, 7.5, C.brown, 1.5);

  // ── modo demonstração: marca d'água, para ninguém confundir com ingresso de verdade ──
  if (isDemo()) {
    const label = "DEMONSTRAÇÃO";
    const size = 46;
    const w = F.sansBold.widthOfTextAtSize(label, size);
    const a = (32 * Math.PI) / 180;
    for (const cy of [H * 0.66, H * 0.3]) {
      p.drawText(label, { x: W / 2 - (w / 2) * Math.cos(a), y: cy - (w / 2) * Math.sin(a), size, font: F.sansBold, color: C.violet, opacity: 0.12, rotate: degrees(32) });
    }
    center(p, "INGRESSO DE DEMONSTRAÇÃO · NÃO VALE PARA O EVENTO", 48, F.sansBold, 7, hex("#d64545"), 1.2);
  }

  // ── carimbo de usado ──
  if (t.usedAt) {
    const label = "UTILIZADO";
    const size = 36;
    const w = F.sansBold.widthOfTextAtSize(label, size);
    // centralizado no QR: o texto gira em torno do início da linha de base
    const a = (24 * Math.PI) / 180;
    const cx = W / 2, cy = qrY + qrSize / 2 - size * 0.35;
    p.drawText(label, { x: cx - (w / 2) * Math.cos(a), y: cy - (w / 2) * Math.sin(a), size, font: F.sansBold, color: hex("#d64545"), opacity: 0.85, rotate: degrees(24) });
  }
}

// ───────── desenho ─────────

/** Texto com espaçamento entre letras (o pdf-lib não tem characterSpacing: desenha letra por letra). */
function text(p: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number, color: RGB, spacing = 0, opacity = 1) {
  if (!spacing) return p.drawText(s, { x, y, size, font, color, opacity });
  let cx = x;
  for (const ch of s) {
    p.drawText(ch, { x: cx, y, size, font, color, opacity });
    cx += font.widthOfTextAtSize(ch, size) + spacing;
  }
}
function center(p: PDFPage, s: string, y: number, font: PDFFont, size: number, color: RGB, spacing = 0) {
  const w = font.widthOfTextAtSize(s, size) + Math.max(0, s.length - 1) * spacing;
  text(p, s, (W - w) / 2, y, font, size, color, spacing);
}
/** Corta com "…" se não couber na largura. */
function fit(s: string, font: PDFFont, size: number, max: number) {
  if (font.widthOfTextAtSize(s, size) <= max) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > max) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}
function wrap(s: string, font: PDFFont, size: number, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
function roundRect(p: PDFPage, x: number, y: number, w: number, h: number, r: number, fill: RGB, fillOpacity: number, border?: RGB, borderOpacity = 1) {
  const d = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
  p.drawSvgPath(d, { x, y: y + h, color: fill, opacity: fillOpacity, borderColor: border, borderWidth: border ? 0.8 : 0, borderOpacity });
}

/** Estrela de 4 pontas da marca 2027 (mesmo desenho do site), centrada em (cx, cy) com raio r. */
function drawStar(p: PDFPage, cx: number, cy: number, r: number, color: RGB, opacity: number) {
  const k = r / 12;
  p.drawSvgPath("M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z", {
    x: cx - 12 * k,
    y: cy + 12 * k,
    scale: k,
    color,
    opacity,
  });
}
