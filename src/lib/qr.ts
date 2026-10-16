import QRCode from "qrcode";

/**
 * Padrão único de QR dos ingressos (página, link individual, imagem salva e PDF).
 * - Correção de erros "Q" (~25%): lê mesmo com tela trincada, suja ou reflexo.
 * - Margem de 4 módulos (a "zona quieta" que a norma ISO/IEC 18004 exige): sem ela, câmeras
 *   e leitores falham em fundo escuro.
 * O teste `npm run test:qr` lê todos os formatos com imagem pequena, borrada e girada.
 */
export const QR_OPTIONS = { errorCorrectionLevel: "Q", margin: 4 } as const;

export const qrDataUrl = (text: string, width = 480) => QRCode.toDataURL(text, { ...QR_OPTIONS, width });

/** Matriz de módulos (true = escuro) para desenhar o QR em vetor no PDF. */
export function qrMatrix(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel });
  const n = qr.modules.size;
  const dark = (x: number, y: number) => qr.modules.get(y, x) === 1;
  return { size: n, dark };
}
