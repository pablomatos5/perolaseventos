// Gera as imagens do fundo do mar do rodapé a partir da cena 3D (cena.js).
// Uso (num container com playwright e three instalados):
//   node scripts/fundo-mar/render.mjs <pasta-node_modules> <pasta-de-saida>
// Saída: fundo-mar-pc.png (2880×760) e fundo-mar-cel.png (1170×1000). Converter para webp depois.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [nm, out] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname);
const html = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module" src="/cena.js"></script></body></html>`;

const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = process.env.TESTE
  ? [["teste", 720, 190, 0]]
  : [
      ["pc", 2880, 760, 0],
      ["cel", 1170, 1000, 1],
    ];
for (const [name, w, h, m] of SIZES) {
  const p = await b.newPage({ viewport: { width: 400, height: 300 } });
  p.on("pageerror", (e) => console.log("ERRO", e.message));
  p.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));
  await p.route("http://cena.local/**", (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === "/") return r.fulfill({ body: html, contentType: "text/html" });
    if (u.pathname === "/cena.js") return r.fulfill({ path: path.join(here, "cena.js"), contentType: "text/javascript" });
    const f = path.join(nm, u.pathname);
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ path: f, contentType: "text/javascript" });
  });
  await p.goto(`http://cena.local/?w=${w}&h=${h}&m=${m}`, { waitUntil: "commit" });
  await p.waitForFunction(() => window.__pronto, null, { timeout: Number(process.env.LIMITE || 1500000) });
  const data = await p.evaluate(() => window.__pronto);
  fs.writeFileSync(path.join(out, `fundo-mar-${name}.png`), Buffer.from(data.split(",")[1], "base64"));
  console.log("ok", name);
  await p.close();
}
await b.close();
