import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, degrees, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { formatBRL } from "@/lib/format";
import { isDemo } from "@/lib/payment-mode";
import { QR_OPTIONS, qrShape } from "@/lib/qr";
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
const DAY = {
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
  // painel, meia-lua do picote e selo
  panel: rgb(1, 1, 1),
  panelOpacity: 0.62,
  notch: hex("#efe2f6"),
  seal: hex("#fff6ea"),
};
/** Tema noturno: céu azul-noite, textos em creme e dourado. O QR continua escuro sobre branco (leitura na portaria). */
const NIGHT: typeof DAY = {
  ...DAY,
  deep: hex("#fbeedd"),
  soft: hex("#c9bfe6"),
  violet: hex("#e9c27e"),
  brown: hex("#e2b469"),
  goldInk: hex("#e2b469"),
  panel: hex("#1d1650"),
  panelOpacity: 0.72,
  notch: hex("#06051a"),
  seal: hex("#1d1650"),
};
export type TicketTheme = "dia" | "noite";
function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let fontBytes: Promise<Record<string, Uint8Array>> | null = null;
let bgBytes: Promise<Uint8Array> | null = null;
let topBytes: Promise<Uint8Array> | null = null;
let logoBytes: Promise<Uint8Array> | null = null;
let shellBytes: Promise<Uint8Array> | null = null;
const nightBytes: Record<string, Promise<Uint8Array>> = {};
const readAsset = (f: string) => (nightBytes[f] ??= readFile(path.join(process.cwd(), "assets", "pdf", f)));
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

/**
 * Tema de cada ingresso: o FEMININO sai no tema claro ("dia") e o MASCULINO no escuro ("noite"), cada página
 * com o seu. Cortesia (sem gênero) sai no claro. `theme` força o mesmo tema para todos (ex.: ?tema=noite).
 */
const themeFor = (t: PdfTicket, forced?: TicketTheme): TicketTheme => forced ?? (t.gender === "Masculino" ? "noite" : "dia");

/** Gera o PDF com um ingresso por página. */
export async function ticketsPdf(opts: { event: PdfEvent; orderCode: string; tickets: PdfTicket[]; totalInOrder?: number; startIndex?: number; theme?: TicketTheme }) {
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
  // artes de cada tema, embutidas uma vez por PDF e só se algum ingresso usar aquele tema
  const themes = new Map<TicketTheme, Promise<ThemeArt>>();
  const artFor = (theme: TicketTheme) => {
    let a = themes.get(theme);
    if (!a) {
      const night = theme === "noite";
      a = (async () => ({
        // fundo: degradê das artes 2027 (esticado, sem faixas)
        glow: await doc.embedPng(await (night ? readAsset("fundo-noite.png") : (bgBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "fundo-2027.png"))))),
        // topo: as sereias e o mar das artes oficiais
        art: await doc.embedJpg(await (night ? readAsset("topo-noite.jpg") : (topBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "topo-ingresso.jpg"))))),
        // pé no visual atual do site (scripts/fundo-mar/ingresso.py): areia no claro, fundo do mar no escuro
        foot: await doc.embedPng(await readAsset(night ? "pe-noite.png" : "pe-dia.png")),
        colors: night ? NIGHT : DAY,
        night,
      }))();
      themes.set(theme, a);
    }
    return a;
  };
  // logotipo oficial (arte aprovada, public/2027/logo) + linha 2K27, exportado do próprio site com a margem livre
  const logo = await doc.embedPng(await (logoBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "logo-2027.png"))));
  // concha Pérolas (identidade 2027): selo, marca d'água e assinatura — assets/pdf/concha-dourada.png
  // (gerada da arte oficial por scripts/concha-dourada.py)
  const shell = await doc.embedPng(await (shellBytes ??= readFile(path.join(process.cwd(), "assets", "pdf", "concha-dourada.png"))));
  // fios de luz dourados do céu do site, por cima do topo (nos dois temas)
  const threads = await doc.embedPng(await readAsset("fios-luz.png"));
  for (const [i, t] of opts.tickets.entries()) {
    const a = await artFor(themeFor(t, opts.theme));
    drawTicket(doc.addPage([W, H]), F, a, threads, logo, shell, opts.event, opts.orderCode, t, (opts.startIndex ?? 0) + i + 1, total);
  }
  return doc.save();
}

type ThemeArt = { glow: PDFImage; art: PDFImage; foot: PDFImage; colors: typeof DAY; night: boolean };

type Fonts = Record<"display" | "serif" | "serifItalic" | "sans" | "sansMedium" | "sansBold", PDFFont>;

function drawTicket(p: PDFPage, F: Fonts, theme: ThemeArt, threads: PDFImage, logo: PDFImage, shell: PDFImage, ev: PdfEvent, orderCode: string, t: PdfTicket, n: number, total: number) {
  const { glow, art, foot, colors: C, night } = theme;
  const conch = (cx: number, cy: number, w: number, opacity = 1) => {
    const h = (w * shell.height) / shell.width;
    p.drawImage(shell, { x: cx - w / 2, y: cy - h / 2, width: w, height: h, opacity });
  };
  // ── fundo: céu da campanha 2027 (violeta no alto → pêssego embaixo) ──
  p.drawImage(glow, { x: 0, y: 0, width: W, height: H });
  // ── pé: areia (claro) ou fundo do mar (escuro), como no site; sobe esfumado atrás das regras e da assinatura ──
  const footH = (W * foot.height) / foot.width;
  p.drawImage(foot, { x: 0, y: 0, width: W, height: footH });
  // ── topo: sereias e mar das artes oficiais ──
  const artH = 350;
  p.drawImage(art, { x: 0, y: H - artH, width: W, height: artH });
  // fios de luz dourados do céu do site, do canto esquerdo (como na página)
  p.drawImage(threads, { x: -60, y: H - 360, width: 400, height: 400, opacity: night ? 1 : 0.9 });
  const stars = [[40, 50, 1.1], [92, 76, 0.7], [318, 34, 0.9], [372, 78, 1.2], [210, 22, 0.8], [150, 40, 0.6], [270, 64, 0.7]];
  for (const [x, dy, r] of stars) p.drawCircle({ x, y: H - dy, size: r, color: C.white, opacity: 0.85 });
  drawStar(p, 334, H - 50, 7, C.cream, 0.95);
  drawStar(p, 86, H - 34, 5, C.cream, 0.8);

  // ── logo: o mesmo do site (concha do flyer oficial com RÉVEILLON · PÉROLAS · 2K27) ──
  const lw = 260;
  const lh = (lw * logo.height) / logo.width;
  p.drawImage(logo, { x: (W - lw) / 2, y: H - 56 - lh, width: lw, height: lh });
  center(p, "UM NOVO CICLO. INFINITAS POSSIBILIDADES.", H - 252, F.sansBold, 6.8, C.white, 2.4);
  // data e local em dourado, como no flyer oficial
  const dmy = ev.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ }).split("/").join(" · ");
  const dw = F.serif.widthOfTextAtSize(dmy, 26) + (dmy.length - 1) * 1.5;
  center(p, dmy, H - 284, F.serif, 26, C.deep, 1.5);
  p.drawLine({ start: { x: W / 2 - dw / 2 - 52, y: H - 275 }, end: { x: W / 2 - dw / 2 - 12, y: H - 275 }, thickness: 0.8, color: C.goldInk, opacity: 0.9 });
  p.drawLine({ start: { x: W / 2 + dw / 2 + 12, y: H - 275 }, end: { x: W / 2 + dw / 2 + 52, y: H - 275 }, thickness: 0.8, color: C.goldInk, opacity: 0.9 });
  center(p, ev.venue.toUpperCase(), H - 310, F.serif, 17, C.deep, 2.2);

  // ── moldura dourada fina ──
  const fm = 12;
  roundRect(p, fm, fm, W - 2 * fm, H - 2 * fm, 18, C.white, 0, C.gold, 0.9);


  // ── painel de informações ──
  const top = H - 340;
  const panelH = 196;
  roundRect(p, M, top - panelH, W - 2 * M, panelH, 14, C.panel, C.panelOpacity, C.brown, 0.4);
  // marca d'água: a concha grande e bem clara atrás das informações
  conch(W / 2, top - panelH / 2, 250, 0.18);
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
  const cutY = hy - 60;
  for (let x = M; x < W - M; x += 9) p.drawLine({ start: { x, y: cutY }, end: { x: x + 4.5, y: cutY }, thickness: 0.8, color: C.brown, opacity: 0.6 });
  // meia-lua de picote nas duas laterais (canhoto)
  p.drawCircle({ x: 0, y: cutY, size: 14, color: C.notch });
  p.drawCircle({ x: W, y: cutY, size: 14, color: C.notch });
  p.drawCircle({ x: 0, y: cutY, size: 14, borderColor: C.gold, borderWidth: 0.8, opacity: 0 });
  p.drawCircle({ x: W, y: cutY, size: 14, borderColor: C.gold, borderWidth: 0.8, opacity: 0 });
  // selo da concha no picote
  p.drawCircle({ x: W / 2, y: cutY, size: 17, color: C.seal, borderColor: C.goldInk, borderWidth: 0.9 });
  conch(W / 2, cutY + 0.5, 25);

  // ── QR em vetor sobre branco (a matriz já inclui a margem de 4 módulos exigida) ──
  const qrSize = 170;
  const qrX = (W - qrSize) / 2;
  const qrY = cutY - 34 - qrSize;
  roundRect(p, qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 18, C.white, 1, C.gold, 1);
  // QR personalizado (mesmo desenho da página, src/lib/qr.ts): pontinhos, olhos arredondados e a pérola
  const shape = qrShape(ticketToken(t.id, t.qrVersion));
  const q = QR_OPTIONS.margin; // zona quieta em módulos
  const mod = qrSize / (shape.size + 2 * q);
  const P = (v: number) => ((v + q) * mod).toFixed(3);
  const rr = (x: number, y: number, w: number, h: number, r: number) =>
    `M${P(x + r)} ${P(y)}H${P(x + w - r)}A${(r * mod).toFixed(3)} ${(r * mod).toFixed(3)} 0 0 1 ${P(x + w)} ${P(y + r)}V${P(y + h - r)}A${(r * mod).toFixed(3)} ${(r * mod).toFixed(3)} 0 0 1 ${P(x + w - r)} ${P(y + h)}H${P(x + r)}A${(r * mod).toFixed(3)} ${(r * mod).toFixed(3)} 0 0 1 ${P(x)} ${P(y + h - r)}V${P(y + r)}A${(r * mod).toFixed(3)} ${(r * mod).toFixed(3)} 0 0 1 ${P(x + r)} ${P(y)}Z`;
  let dots = "";
  for (let y = 0; y < shape.size; y++)
    for (let x = 0; x < shape.size; x++) if (shape.dark(x, y) && !shape.inEye(x, y) && !shape.inLogo(x, y)) dots += rr(x, y, 1, 1, 0.28);
  const ink = hex("#160e3d");
  const at = { x: qrX, y: qrY + qrSize };
  p.drawSvgPath(dots, { ...at, color: ink });
  for (const [ex, ey] of shape.eyes) {
    p.drawSvgPath(rr(ex, ey, 7, 7, 2), { ...at, color: ink });
    p.drawSvgPath(rr(ex + 1, ey + 1, 5, 5, 1.4), { ...at, color: C.white });
    p.drawSvgPath(rr(ex + 2, ey + 2, 3, 3, 0.9), { ...at, color: ink });
  }
  // pérola central com aro dourado e brilho
  const lc = { x: qrX + (shape.logo.c + q) * mod, y: qrY + qrSize - (shape.logo.c + q) * mod };
  p.drawCircle({ ...lc, size: (shape.logo.r + 0.25) * mod, color: hex("#c9944a") });
  p.drawCircle({ ...lc, size: (shape.logo.r - 0.25) * mod, color: hex("#d9c8f5") });
  p.drawCircle({ ...lc, size: (shape.logo.r - 0.9) * mod, color: hex("#efe6ff") });
  p.drawCircle({ x: lc.x - shape.logo.r * 0.35 * mod, y: lc.y + shape.logo.r * 0.35 * mod, size: shape.logo.r * 0.28 * mod, color: C.white });
  center(p, `Ingresso ${n} de ${total}  ·  Pedido ${orderCode}`, qrY - 30, F.sansMedium, 9, C.deep);
  center(p, `Nº ${t.id.slice(-10).toUpperCase()}${t.qrVersion ? ` · v${t.qrVersion}` : ""}`, qrY - 44, F.sans, 7.5, C.soft, 1);

  // ── regras ──
  const rules = [
    "Apresente este QR na entrada (celular ou impresso). Vale uma única entrada: depois de lido, não passa de novo. Não compartilhe nem poste.",
    "Masculino e feminino são conferidos na entrada: o ingresso feminino só vale para mulheres.",
  ];
  let ry = qrY - 64;
  for (const r of rules) {
    for (const line of wrap(r, F.sans, 7.6, W - 2 * M - 10)) {
      center(p, line, ry, F.sans, 7.6, C.soft);
      ry -= 11;
    }
    ry -= 3;
  }
  // assinatura: concha Pérolas + @perolaseventos
  const sig = "@perolaseventos";
  const sigSize = 11;
  const sigW = F.sansBold.widthOfTextAtSize(sig, sigSize) + (sig.length - 1) * 1.2;
  const sigX = (W - (sigW + 30)) / 2;
  conch(sigX + 11, 44, 24);
  text(p, sig, sigX + 30, 40, F.sansBold, sigSize, C.brown, 1.2);
  center(p, "perolaseventos.store", 26, F.sans, 7, C.soft, 1.5);

  // ── modo demonstração: marca d'água diagonal + faixa vermelha, para ninguém confundir com ingresso de verdade ──
  if (isDemo()) {
    const label = "DEMONSTRAÇÃO";
    const size = 46;
    const w = F.sansBold.widthOfTextAtSize(label, size);
    const a = (32 * Math.PI) / 180;
    for (const cy of [H * 0.66, H * 0.3]) {
      p.drawText(label, { x: W / 2 - (w / 2) * Math.cos(a), y: cy - (w / 2) * Math.sin(a), size, font: F.sansBold, color: C.violet, opacity: 0.14, rotate: degrees(32) });
    }
    // faixa vermelha no topo, dentro da moldura (a "faixa de demonstração")
    const red = hex("#d64545");
    const band = "INGRESSO DE DEMONSTRAÇÃO · NÃO VALE PARA O EVENTO";
    const bandH = 22;
    const bandY = H - fm - 4 - bandH;
    roundRect(p, fm + 4, bandY, W - 2 * (fm + 4), bandH, 6, red, 1);
    center(p, band, bandY + 7.5, F.sansBold, 7.2, C.white, 1.1);
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
