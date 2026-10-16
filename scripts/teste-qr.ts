// Teste de confiabilidade dos QR dos ingressos: nenhum falso positivo (QR adulterado/falso aceito)
// e nenhum falso negativo (QR válido recusado ou ilegível em condições ruins de leitura).
// Uso: npm run test:qr   (não usa banco; precisa só do TICKET_SECRET no .env)
import "dotenv/config";
import { randomBytes } from "node:crypto";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { qrDataUrl } from "../src/lib/qr";
import { orderToken, ticketLinkToken, ticketToken, verifyTicketToken } from "../src/lib/tokens";

let falhas = 0;
const check = (label: string, ok: boolean, extra = "") => {
  if (!ok) falhas++;
  console.log(`${ok ? "✔" : "✘"} ${label}${extra ? ` — ${extra}` : ""}`);
};

// ids no formato cuid (25 caracteres minúsculos/dígitos), como os do banco
const cuid = () => "c" + randomBytes(18).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 24);
const ids = Array.from({ length: 200 }, cuid);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// ── 1. ida e volta: todo QR emitido é aceito com o id e a versão certos ──
let roundtrip = 0;
for (const id of ids) {
  for (const v of [0, 1, 2, 17]) {
    const r = verifyTicketToken(ticketToken(id, v));
    if (r?.id === id && r.version === v) roundtrip++;
  }
}
check("todo QR emitido é aceito (id e versão corretos)", roundtrip === ids.length * 4, `${roundtrip}/${ids.length * 4}`);

// ── 2. Caps Lock / espaços do leitor pistola ──
let caps = 0;
for (const id of ids.slice(0, 50)) {
  const t = ticketToken(id, 3);
  const swapped = t.replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
  if (verifyTicketToken(swapped)?.id === id && verifyTicketToken(`  ${t}\r\n`)?.id === id) caps++;
}
check("leitor com Caps Lock ou Enter/espaços extras continua aceito", caps === 50, `${caps}/50`);

// ── 3. adulteração: trocar QUALQUER caractere de qualquer QR deve ser recusado ──
let tentativas = 0;
let aceitosIndevidos = 0;
for (const id of ids.slice(0, 60)) {
  for (const v of [0, 4]) {
    const t = ticketToken(id, v);
    for (let i = 0; i < t.length; i++) {
      for (const c of [B64[(B64.indexOf(t[i]) + 1) % 64], B64[(B64.indexOf(t[i]) + 33) % 64]]) {
        if (c === t[i] || t[i] === ".") continue;
        const forged = t.slice(0, i) + c + t.slice(i + 1);
        tentativas++;
        const r = verifyTicketToken(forged);
        // só conta como falha se aceitou algo DIFERENTE do original (trocar só a caixa de tudo é o caso Caps Lock)
        if (r && !(r.id === id && r.version === v)) aceitosIndevidos++;
      }
    }
  }
}
check("QR adulterado (1 caractere trocado) nunca é aceito", aceitosIndevidos === 0, `${tentativas} tentativas, ${aceitosIndevidos} aceitas`);

// versão adulterada (tentar "ressuscitar" QR antigo ou pular para outra versão)
const t5 = ticketToken(ids[0], 5).split(".");
check("trocar a versão dentro do QR é recusado", verifyTicketToken(`PE2.${t5[1]}.6.${t5[3]}`) === null && verifyTicketToken(`PE2.${t5[1]}.0.${t5[3]}`) === null);
check("assinatura de um ingresso não vale para outro", verifyTicketToken(`PE1.${ids[1]}.${ticketToken(ids[0]).split(".")[2]}`) === null);
check("link de pedido ou link individual não passam como ingresso", verifyTicketToken(orderToken(ids[0])) === null && verifyTicketToken(ticketLinkToken(ids[0], 0)) === null);
check("lixo e QR de outros eventos são recusados", ["", "PE1", "PE1..", "https://instagram.com/perolaseventos", "PE3.a.b.c", "PE2.x.-1.y", "PE2.x.01.y"].every((x) => verifyTicketToken(x) === null));

// chaves aleatórias: 20 mil QR "chutados" com formato perfeito
let chute = 0;
for (let i = 0; i < 20000; i++) if (verifyTicketToken(`PE1.${ids[i % ids.length]}.${randomBytes(16).toString("base64url").slice(0, 22)}`)) chute++;
check("20.000 assinaturas chutadas: nenhuma aceita", chute === 0, `${chute} aceitas`);

// ── 4. leitura óptica em condições ruins (falso negativo por QR ilegível) ──
type Img = { w: number; h: number; d: Uint8ClampedArray };
const fromDataUrl = (u: string): Img => {
  const p = PNG.sync.read(Buffer.from(u.split(",")[1], "base64"));
  return { w: p.width, h: p.height, d: new Uint8ClampedArray(p.data) };
};
const lum = (img: Img, x: number, y: number) => {
  const i = (Math.max(0, Math.min(img.h - 1, y)) * img.w + Math.max(0, Math.min(img.w - 1, x))) * 4;
  return img.d[i];
};
const make = (w: number, h: number, f: (x: number, y: number) => number): Img => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y); const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  return { w, h, d };
};
const scale = (img: Img, w: number) => make(w, w, (x, y) => lum(img, Math.floor((x * img.w) / w), Math.floor((y * img.h) / w)));
const blur = (img: Img, r: number) => make(img.w, img.h, (x, y) => { let s = 0, n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { s += lum(img, x + dx, y + dy); n++; } return s / n; });
// gira com uma borda branca em volta (a câmera enquadra o QR inteiro, com o papel/tela ao redor)
const pad = (img: Img) => { const W = Math.round(img.w * 1.5), o = Math.round((W - img.w) / 2); return make(W, W, (x, y) => (x < o || y < o || x >= o + img.w || y >= o + img.h ? 255 : lum(img, x - o, y - o))); };
const rotate = (img0: Img, deg: number) => { const img = pad(img0); const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), cx = img.w / 2, cy = img.h / 2; return make(img.w, img.h, (x, y) => { const sx = c * (x - cx) + s * (y - cy) + cx, sy = -s * (x - cx) + c * (y - cy) + cy; return sx < 0 || sy < 0 || sx >= img.w || sy >= img.h ? 255 : lum(img, Math.round(sx), Math.round(sy)); }); };
const lowContrast = (img: Img) => make(img.w, img.h, (x, y) => 90 + (lum(img, x, y) / 255) * 100); // tela com brilho baixo
// ruído de sensor com sorteio fixo (resultado repetível) e a suavização que toda câmera aplica
let seed = 20270101;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const noise = (img: Img, amp: number) => blur(make(img.w, img.h, (x, y) => lum(img, x, y) + (rnd() - 0.5) * 2 * amp), 1);
// "trinca/sujeira" no miolo do código: trinca diagonal + mancha. Os 3 quadrados de posição dos cantos
// ficam fora (sem eles nenhum QR é lido, com qualquer correção de erros).
// O quadradinho de alinhamento (perto do canto inferior direito, ~78% x 78%) também fica fora.
const damage = (img: Img) => make(img.w, img.h, (x, y) => {
  const u = x / img.w, v = y / img.h;
  const crack = u > 0.3 && u < 0.64 && Math.abs(v - (0.62 - (u - 0.3) * 0.75)) < 0.011; // trinca diagonal
  const smudge = (u - 0.5) ** 2 + (v - 0.7) ** 2 < 0.0036; // mancha de dedo
  return crack || smudge ? 25 : lum(img, x, y);
});
// tela do celular dentro da foto: QR (com a margem dele) sobre fundo escuro, como na portaria
const onDark = (img: Img) => { const W = Math.round(img.w * 1.5), o = Math.round((W - img.w) / 2); return make(W, W, (x, y) => (x < o || y < o || x >= o + img.w || y >= o + img.h ? 20 : lum(img, x - o, y - o))); };
const read = (img: Img) => jsQR(img.d, img.w, img.h)?.data ?? null;

const longest = ticketToken(ids[0].padEnd(30, "z"), 999999); // pior caso: maior QR possível
const samples = [ticketToken(ids[1]), ticketToken(ids[2], 3), longest];
const conditions: [string, (i: Img) => Img][] = [
  ["nítido", (i) => i],
  ["pequeno na câmera (160 px)", (i) => scale(i, 160)],
  ["muito pequeno (125 px)", (i) => scale(i, 125)],
  ["fora de foco", (i) => blur(i, 2)],
  ["girado 12°", (i) => rotate(i, 12)],
  ["girado 45°", (i) => rotate(i, 45)],
  ["de ponta-cabeça", (i) => rotate(i, 180)],
  ["brilho da tela baixo", lowContrast],
  ["ruído de câmera", (i) => noise(i, 55)],
  ["tela trincada / suja", damage],
  ["sobre fundo escuro", onDark],
  ["pequeno + borrado + girado", (i) => rotate(blur(scale(i, 220), 1), 8)],
];
async function main() {
  for (const [label, fn] of conditions) {
    let ok = 0;
    const bad: string[] = [];
    for (const [k, s] of samples.entries()) {
      const img = fromDataUrl(await qrDataUrl(s));
      if (read(fn(img)) === s) ok++;
      else bad.push(`amostra ${k + 1} (${s.length} caracteres)`);
    }
    check(`leitura: ${label}`, ok === samples.length, `${ok}/${samples.length}${bad.length ? ` · falhou: ${bad.join(", ")}` : ""}`);
  }

  console.log(falhas ? `\n${falhas} problema(s).` : "\nNenhum falso positivo nem falso negativo.");
  process.exit(falhas ? 1 : 0);
}

void main();
