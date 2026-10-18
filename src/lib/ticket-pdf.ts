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
  gender: string;
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
let topBytes: Promise<Uint8Array> | null = null;
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
  // topo: as sereias e o mar das artes oficiais (assets/pdf/topo-ingresso.jpg, ~40 KB, uma vez por PDF)
  const art = await doc.embedJpg(await (topBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "topo-ingresso.jpg"))));
  opts.tickets.forEach((t, i) => drawTicket(doc.addPage([W, H]), F, glow, art, opts.event, opts.orderCode, t, (opts.startIndex ?? 0) + i + 1, total));
  return doc.save();
}

type Fonts = Record<"display" | "serif" | "serifItalic" | "sans" | "sansMedium" | "sansBold", PDFFont>;

function drawTicket(p: PDFPage, F: Fonts, glow: PDFImage, art: PDFImage, ev: PdfEvent, orderCode: string, t: PdfTicket, n: number, total: number) {
  // ── fundo: céu da campanha 2027 (violeta no alto → pêssego embaixo) ──
  p.drawImage(glow, { x: 0, y: 0, width: W, height: H });
  // ── topo: sereias e mar das artes oficiais ──
  const artH = 350;
  p.drawImage(art, { x: 0, y: H - artH, width: W, height: artH });
  const stars = [[40, 50, 1.1], [92, 76, 0.7], [318, 34, 0.9], [372, 78, 1.2], [210, 22, 0.8], [150, 40, 0.6], [270, 64, 0.7]];
  for (const [x, dy, r] of stars) p.drawCircle({ x, y: H - dy, size: r, color: C.white, opacity: 0.85 });
  drawStar(p, 334, H - 50, 7, C.cream, 0.95);
  drawStar(p, 86, H - 34, 5, C.cream, 0.8);

  // ── logo: RÉVEILLON · PÉROLAS (pérola no lugar do O) · 2K27 em serifa dourada ──
  center(p, "RÉVEILLON", H - 78, F.sansBold, 9.5, C.cream, 5);
  const ns = 44;
  const sp = 5;
  const L1 = "PÉR";
  const L2 = "LAS";
  const pearlD = ns * 0.62;
  const w1 = F.sans.widthOfTextAtSize(L1, ns) + L1.length * sp;
  const w2 = F.sans.widthOfTextAtSize(L2, ns) + (L2.length - 1) * sp;
  const lx = (W - (w1 + pearlD + sp + w2)) / 2;
  const ly = H - 128;
  text(p, L1, lx, ly, F.sans, ns, C.white, sp);
  const pcx = lx + w1 + pearlD / 2;
  const pcy = ly + ns * 0.35;
  p.drawCircle({ x: pcx, y: pcy, size: pearlD * 0.85, color: C.cream, opacity: 0.25 });
  p.drawCircle({ x: pcx, y: pcy, size: pearlD / 2, color: hex("#f3ebff") });
  p.drawCircle({ x: pcx + 2, y: pcy - 2, size: pearlD / 2 - 3, color: hex("#e2d4f7"), opacity: 0.6 });
  p.drawCircle({ x: pcx - pearlD * 0.15, y: pcy + pearlD * 0.15, size: pearlD * 0.13, color: C.white });
  text(p, L2, lx + w1 + pearlD + sp, ly, F.sans, ns, C.white, sp);
  const ed = ev.edition.toUpperCase();
  const ew = F.serif.widthOfTextAtSize(ed, 30) + (ed.length - 1) * 2;
  center(p, ed, H - 166, F.serif, 30, C.cream, 2);
  p.drawLine({ start: { x: W / 2 - ew / 2 - 70, y: H - 157 }, end: { x: W / 2 - ew / 2 - 14, y: H - 157 }, thickness: 0.8, color: C.cream, opacity: 0.9 });
  p.drawLine({ start: { x: W / 2 + ew / 2 + 14, y: H - 157 }, end: { x: W / 2 + ew / 2 + 70, y: H - 157 }, thickness: 0.8, color: C.cream, opacity: 0.9 });
  center(p, "UM NOVO CICLO. INFINITAS POSSIBILIDADES.", H - 190, F.sansBold, 6.8, C.white, 2.4);

  // ── moldura dourada fina com cantos de concha ──
  const fm = 12;
  roundRect(p, fm, fm, W - 2 * fm, H - 2 * fm, 18, C.white, 0, C.gold, 0.9);
  for (const [cx, cy, r] of [[fm + 4, fm + 4, 0], [W - fm - 4, fm + 4, 90], [W - fm - 4, H - fm - 4, 180], [fm + 4, H - fm - 4, 270]] as const) {
    drawShell(p, cx, cy, 13, r, C.gold);
  }

  // ── painel de informações ──
  const top = H - 362;
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
  cell(colL, top - 146, "INGRESSO", t.gender);
  cell(colR, top - 146, "VALOR", t.priceCents > 0 ? formatBRL(t.priceCents) : "Cortesia");

  // ── titular ──
  const hy = top - panelH - 30;
  center(p, "TITULAR", hy, F.sansBold, 7, C.violet, 2.2);
  center(p, fit(t.holder, F.serifItalic, 25, W - 2 * M), hy - 28, F.serifItalic, 25, C.deep);

  // ── picote do canhoto ──
  const cutY = hy - 46;
  for (let x = M; x < W - M; x += 9) p.drawLine({ start: { x, y: cutY }, end: { x: x + 4.5, y: cutY }, thickness: 0.8, color: C.brown, opacity: 0.6 });
  // meia-lua de picote nas duas laterais (canhoto)
  p.drawCircle({ x: 0, y: cutY, size: 14, color: hex("#efe2f6") });
  p.drawCircle({ x: W, y: cutY, size: 14, color: hex("#efe2f6") });
  p.drawCircle({ x: 0, y: cutY, size: 14, borderColor: C.gold, borderWidth: 0.8, opacity: 0 });
  p.drawCircle({ x: W, y: cutY, size: 14, borderColor: C.gold, borderWidth: 0.8, opacity: 0 });
  drawShell(p, W / 2, cutY - 6, 9, 0, C.brown);

  // ── QR em vetor sobre branco (a matriz já inclui a margem de 4 módulos exigida) ──
  const qrSize = 184;
  const qrX = (W - qrSize) / 2;
  const qrY = cutY - 30 - qrSize;
  roundRect(p, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 18, C.white, 1, C.gold, 1);
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
  ];
  let ry = qrY - 64;
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

/** Conchinha vieira (leque com nervuras) só em traço, centrada em (cx, cy), girada `rot` graus. */
function drawShell(p: PDFPage, cx: number, cy: number, r: number, rot: number, color: RGB) {
  const k = r / 12;
  const a = (rot * Math.PI) / 180;
  const pts = (x: number, y: number) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  let d = "";
  const fan: number[][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = Math.PI * (0.12 + 0.76 * (i / 8));
    fan.push(pts(Math.cos(t) * 12, Math.sin(t) * 12));
  }
  d += `M${pts(0, 0).join(" ")}`;
  fan.forEach(([x, y], i) => (d += i === 0 ? ` L${x} ${y}` : ` Q${pts(Math.cos(Math.PI * (0.12 + 0.76 * ((i - 0.5) / 8))) * 13.5, Math.sin(Math.PI * (0.12 + 0.76 * ((i - 0.5) / 8))) * 13.5).join(" ")} ${x} ${y}`));
  d += " Z";
  for (const [x, y] of fan.slice(1, -1)) d += ` M${pts(0, 0).join(" ")} L${x * 0.92} ${y * 0.92}`;
  // pdf-lib desenha o y para baixo no caminho SVG: espelha
  p.drawSvgPath(d, { x: cx, y: cy, scale: k, borderColor: color, borderWidth: 1 / k, borderOpacity: 0.9, color, opacity: 0.12 });
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
