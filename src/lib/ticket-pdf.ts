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
};
function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontBytes: Promise<Record<string, Uint8Array>> | null = null;
let glowBytes: Promise<Uint8Array> | null = null;
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
  const glow = await doc.embedPng(await (glowBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "topo.png"))));
  opts.tickets.forEach((t, i) => drawTicket(doc.addPage([W, H]), F, glow, opts.event, opts.orderCode, t, (opts.startIndex ?? 0) + i + 1, total));
  return doc.save();
}

type Fonts = Record<"display" | "serif" | "serifItalic" | "sans" | "sansMedium" | "sansBold", PDFFont>;

function drawTicket(p: PDFPage, F: Fonts, glow: PDFImage, ev: PdfEvent, orderCode: string, t: PdfTicket, n: number, total: number) {
  // ── fundo: noite lilás, mais clara no topo ──
  p.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.bg });
  // brilho lilás no topo: imagem de degradê (assets/pdf/topo.png) esticada, sem faixas visíveis
  p.drawImage(glow, { x: 0, y: H - 380, width: W, height: 380 });
  // estrelas fixas (posições determinísticas)
  const stars = [[40, 770, 1.1], [92, 744, 0.7], [318, 786, 0.9], [372, 742, 1.2], [356, 700, 0.6], [58, 690, 0.8], [384, 640, 0.7], [24, 612, 0.6]];
  for (const [x, y, r] of stars) p.drawCircle({ x, y, size: r, color: C.white, opacity: 0.7 });

  // ── concha em linhas douradas + pérola ──
  drawShell(p, W / 2, H - 40, 0.36);

  // ── título ──
  center(p, "RÉVEILLON", H - 168, F.sansBold, 9, C.gold, 4);
  center(p, "Pérolas", H - 222, F.display, 58, C.white);
  center(p, `${ev.edition.toUpperCase()}  ·  6ª EDIÇÃO`, H - 248, F.sansMedium, 8.5, C.goldLight, 3);

  // ── painel de informações ──
  const top = H - 272;
  const panelH = 196;
  roundRect(p, M, top - panelH, W - 2 * M, panelH, 14, C.bgAlt, 0.9, C.gold, 0.35);
  const colL = M + 18;
  const colR = W / 2 + 8;
  const cell = (x: number, y: number, label: string, value: string, sub?: string) => {
    text(p, label, x, y, F.sansBold, 7, C.gold, 2.2);
    text(p, fit(value, F.serif, 17, W / 2 - 46), x, y - 20, F.serif, 17, C.white);
    if (sub) text(p, fit(sub, F.sans, 8.5, W / 2 - 46), x, y - 34, F.sans, 8.5, C.muted);
  };
  cell(colL, top - 26, "DATA", dateLong(ev.startsAt), weekday(ev.startsAt));
  cell(colR, top - 26, "HORÁRIO", `A partir das ${hour(ev.startsAt)}`, "Abertura dos portões");
  cell(colL, top - 86, "LOCAL", ev.venue, ev.city);
  cell(colR, top - 86, "SETOR", t.type, t.batch);
  cell(colL, top - 146, "INGRESSO", t.half ? "Meia-entrada" : "Inteira", t.half ? "Leve o documento" : undefined);
  cell(colR, top - 146, "VALOR", t.priceCents > 0 ? formatBRL(t.priceCents) : "Cortesia");

  // ── titular ──
  const hy = top - panelH - 34;
  center(p, "TITULAR", hy, F.sansBold, 7, C.gold, 2.2);
  center(p, fit(t.holder, F.serifItalic, 25, W - 2 * M), hy - 28, F.serifItalic, 25, C.white);

  // ── picote do canhoto ──
  const cutY = hy - 52;
  for (let x = M; x < W - M; x += 9) p.drawLine({ start: { x, y: cutY }, end: { x: x + 4.5, y: cutY }, thickness: 0.8, color: C.gold, opacity: 0.55 });
  p.drawCircle({ x: 0, y: cutY, size: 13, color: C.ink });
  p.drawCircle({ x: W, y: cutY, size: 13, color: C.ink });

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
  center(p, `Ingresso ${n} de ${total}  ·  Pedido ${orderCode}`, qrY - 30, F.sansMedium, 9, C.white);
  center(p, `Nº ${t.id.slice(-10).toUpperCase()}${t.qrVersion ? ` · v${t.qrVersion}` : ""}`, qrY - 44, F.sans, 7.5, C.faint, 1);

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
      center(p, line, ry, F.sans, 7.6, C.muted);
      ry -= 11;
    }
    ry -= 3;
  }
  center(p, "perolaseventos.store  ·  @perolaseventos", 30, F.sansBold, 7.5, C.gold, 1.5);

  // ── modo demonstração: marca d'água, para ninguém confundir com ingresso de verdade ──
  if (isDemo()) {
    const label = "DEMONSTRAÇÃO";
    const size = 46;
    const w = F.sansBold.widthOfTextAtSize(label, size);
    const a = (32 * Math.PI) / 180;
    for (const cy of [H * 0.66, H * 0.3]) {
      p.drawText(label, { x: W / 2 - (w / 2) * Math.cos(a), y: cy - (w / 2) * Math.sin(a), size, font: F.sansBold, color: C.gold, opacity: 0.16, rotate: degrees(32) });
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

/** Concha em linhas douradas (mesma geometria da concha do topo do site, viewBox 400x320). */
function drawShell(p: PDFPage, cx: number, topY: number, s: number) {
  const HX = 200, HY = 214, R = 170, LOBES = 9, START = 196, END = 344, step = (END - START) / LOBES;
  const pt = (r: number, deg: number) => ({ x: HX + r * Math.cos((deg * Math.PI) / 180), y: HY + r * Math.sin((deg * Math.PI) / 180) });
  const f = (n: number) => n.toFixed(1);
  const scallop = (rad: number, bulge: number) => {
    const a = pt(rad, START);
    let d = `M ${f(a.x)} ${f(a.y)}`;
    for (let i = 0; i < LOBES; i++) {
      const c = pt(rad * bulge, START + (i + 0.5) * step);
      const e = pt(rad, START + (i + 1) * step);
      d += ` Q ${f(c.x)} ${f(c.y)} ${f(e.x)} ${f(e.y)}`;
    }
    return d;
  };
  const x = cx - 200 * s;
  const draw = (d: string, width: number, opacity: number) => p.drawSvgPath(d, { x, y: topY, scale: s, borderColor: C.gold, borderWidth: width, borderOpacity: opacity });
  const outer = scallop(R, 1.09);
  const a0 = pt(R, START);
  draw(`M ${HX} ${HY} L ${f(a0.x)} ${f(a0.y)} ${outer.slice(outer.indexOf("Q"))} L ${HX} ${HY}`, 1.4, 1);
  [0.8, 0.61, 0.43].forEach((k, i) => draw(scallop(R * k, 1.08 - i * 0.01), 1, 0.8 - i * 0.15));
  for (let i = 1; i < LOBES; i++) {
    const deg = START + i * step;
    const a = pt(24, deg), c = pt(R * 0.55, deg + 2.5), b = pt(R * 0.97, deg);
    draw(`M ${f(a.x)} ${f(a.y)} Q ${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`, 0.7, 0.5);
  }
  // pérola
  const py = topY - 196 * s;
  p.drawCircle({ x: cx, y: py, size: 24 * s * 1.6, color: C.gold, opacity: 0.12 });
  p.drawCircle({ x: cx, y: py, size: 16 * s * 1.6, color: C.pearl });
  p.drawCircle({ x: cx - 5 * s, y: py + 5 * s, size: 6 * s * 1.6, color: C.white, opacity: 0.9 });
  // base da concha
  let lip = "M 52 216";
  for (let i = 0; i < 8; i++) lip += ` Q ${f(52 + i * 37 + 18.5)} ${i % 2 ? 224 : 207} ${f(52 + (i + 1) * 37)} 216`;
  draw(lip, 1.3, 1);
  [1, 0.74].forEach((k, i) => {
    const half = 148 * k, depth = 82 * k;
    draw(`M ${f(200 - half)} 216 C ${f(200 - half * 0.9)} ${f(216 + depth)}, ${f(200 + half * 0.9)} ${f(216 + depth)}, ${f(200 + half)} 216`, 1.2, 0.9 - i * 0.3);
  });
}
