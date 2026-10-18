import QRCode from "qrcode";
import { PNG } from "pngjs";

/**
 * Padrão único de QR dos ingressos (página, link individual, imagem salva e PDF), com a cara do evento:
 * pontinhos arredondados em violeta-noite, "olhos" em quadrados arredondados e a pérola no centro.
 * - Correção de erros "H" (~30%): a pérola central cobre ~5% e ainda sobra folga para tela trincada,
 *   suja ou com reflexo.
 * - Margem de 4 módulos (a "zona quieta" da ISO/IEC 18004) em branco: sem ela, câmeras falham.
 * - Contraste: violeta #24185c sobre branco (como preto para os leitores).
 * O teste `npm run test:qr` lê todos os formatos com imagem pequena, borrada e girada.
 */
export const QR_OPTIONS = { errorCorrectionLevel: "H", margin: 4 } as const;

const INK = [0x16, 0x0e, 0x3d] as const; // violeta-noite (quase preto: contraste máximo)
const EYE = INK; // miolo dos olhos na mesma tinta (dourado claro reduzia a leitura com tela escura)
const WHITE = [255, 255, 255] as const;

export type QrShape = {
  size: number; // módulos por lado (sem a margem)
  dark: (x: number, y: number) => boolean;
  /** módulo faz parte de um dos 3 "olhos" (desenhados à parte) */
  inEye: (x: number, y: number) => boolean;
  /** módulo coberto pela pérola central (deixado em branco) */
  inLogo: (x: number, y: number) => boolean;
  eyes: [number, number][]; // canto superior esquerdo de cada olho (em módulos)
  logo: { c: number; r: number }; // centro e raio da pérola (em módulos)
};

/** Matriz + regiões especiais, usadas pelos dois desenhos (PNG da página e vetor do PDF). */
export function qrShape(text: string): QrShape {
  const qr = QRCode.create(text, { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel });
  const n = qr.modules.size;
  const eyes: [number, number][] = [
    [0, 0],
    [n - 7, 0],
    [0, n - 7],
  ];
  const inEye = (x: number, y: number) => eyes.some(([ex, ey]) => x >= ex && x < ex + 7 && y >= ey && y < ey + 7);
  const c = n / 2;
  const r = Math.max(2.4, n * 0.09); // ~3,5% da área
  const inLogo = (x: number, y: number) => Math.hypot(x + 0.5 - c, y + 0.5 - c) < r + 0.9;
  return { size: n, dark: (x, y) => qr.modules.get(y, x) === 1, inEye, inLogo, eyes, logo: { c, r } };
}

/** Compatibilidade: matriz simples (true = escuro). */
export function qrMatrix(text: string) {
  const s = qrShape(text);
  return { size: s.size, dark: s.dark };
}

// ───────── PNG (página do pedido / link individual) ─────────

const sdRoundRect = (px: number, py: number, x0: number, y0: number, w: number, h: number, rad: number) => {
  // distância com sinal até um retângulo arredondado (negativa = dentro)
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - rad);
  const qy = Math.abs(py - cy) - (h / 2 - rad);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};

function colorAt(s: QrShape, u: number, v: number): readonly [number, number, number] {
  // u, v em módulos (0..size) dentro do QR, sem a margem
  const n = s.size;
  if (u < 0 || v < 0 || u >= n || v >= n) return WHITE;
  // pérola central: aro dourado fino + esfera perolada com brilho
  const d = Math.hypot(u - s.logo.c, v - s.logo.c);
  if (d < s.logo.r + 0.9) {
    if (d > s.logo.r + 0.25) return WHITE;
    if (d > s.logo.r - 0.25) return [0xc9, 0x94, 0x4a];
    const hx = u - (s.logo.c - s.logo.r * 0.35);
    const hy = v - (s.logo.c - s.logo.r * 0.35);
    if (Math.hypot(hx, hy) < s.logo.r * 0.28) return WHITE;
    const t = Math.min(1, d / s.logo.r);
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * t * t);
    return [lerp(0xf6, 0xb7), lerp(0xf0, 0x9e), lerp(0xff, 0xe8)];
  }
  // olhos: anel externo arredondado + miolo arredondado
  for (const [ex, ey] of s.eyes) {
    if (u >= ex && u < ex + 7 && v >= ey && v < ey + 7) {
      if (sdRoundRect(u, v, ex + 2, ey + 2, 3, 3, 0.9) < 0) return EYE;
      const outer = sdRoundRect(u, v, ex, ey, 7, 7, 2);
      const inner = sdRoundRect(u, v, ex + 1, ey + 1, 5, 5, 1.4);
      return outer < 0 && inner > 0 ? INK : WHITE;
    }
  }
  // dados: pontinhos arredondados
  const x = Math.floor(u);
  const y = Math.floor(v);
  if (!s.dark(x, y)) return WHITE;
  return sdRoundRect(u, v, x, y, 1, 1, 0.28) < 0 ? INK : WHITE;
}

/** PNG do QR personalizado como data URL (supersampling 3×3 para bordas lisas). */
export async function qrDataUrl(text: string, width = 480) {
  const s = qrShape(text);
  const m = QR_OPTIONS.margin;
  const total = s.size + 2 * m;
  const png = new PNG({ width, height: width });
  const SS = 3;
  for (let py = 0; py < width; py++) {
    for (let px = 0; px < width; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((px + (sx + 0.5) / SS) / width) * total - m;
          const v = ((py + (sy + 0.5) / SS) / width) * total - m;
          const c = colorAt(s, u, v);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (py * width + px) * 4;
      png.data[i] = r / (SS * SS);
      png.data[i + 1] = g / (SS * SS);
      png.data[i + 2] = b / (SS * SS);
      png.data[i + 3] = 255;
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}
