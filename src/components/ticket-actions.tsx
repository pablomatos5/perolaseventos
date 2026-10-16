"use client";

import { useActionState, useState } from "react";
import { updateHolderAction, type HolderState } from "@/app/actions";

type TicketCard = {
  qr: string; // data URL do QR (PNG)
  holder: string;
  title: string; // "Réveillon Pérolas 2K27"
  when: string; // data e local
  type: string; // "Pista Open Bar · 2º lote · Inteira"
  label: string; // "Ingresso 1 de 2 · Pedido K9G82E"
  fileName: string;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/** Monta uma imagem do ingresso (QR grande + dados) para guardar na galeria: abre sem internet na portaria. */
async function ticketImage(t: TicketCard) {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily;
  const W = 900;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1b1236");
  bg.addColorStop(1, "#0c0719");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.fillStyle = "#f3c27e";
  g.font = `600 30px ${font}`;
  g.fillText(t.title.toUpperCase(), W / 2, 110);
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = `400 28px ${font}`;
  g.fillText(t.when, W / 2, 160);
  // QR em fundo branco, com margem: o leitor lê melhor com contraste máximo
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(150, 220, 600, 600, 28);
  g.fill();
  const qr = await loadImage(t.qr);
  g.imageSmoothingEnabled = false;
  g.drawImage(qr, 180, 250, 540, 540);
  g.fillStyle = "#fff";
  g.font = `500 52px ${font}`;
  g.fillText(t.holder, W / 2, 920, W - 80);
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.font = `400 30px ${font}`;
  g.fillText(t.type, W / 2, 975, W - 80);
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = `400 26px ${font}`;
  g.fillText(t.label, W / 2, 1025, W - 80);
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.font = `400 24px ${font}`;
  g.fillText("Vale uma entrada. Depois de lido, o mesmo QR não passa de novo.", W / 2, 1230, W - 80);
  g.fillText("Não compartilhe prints deste ingresso.", W / 2, 1268, W - 80);
  return new Promise<Blob>((resolve) => c.toBlob((b) => resolve(b!), "image/png"));
}

export function SaveTicketButton({ ticket }: { ticket: TicketCard }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn px-4! py-2!"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await ticketImage(ticket);
          const file = new File([blob], `${ticket.fileName}.png`, { type: "image/png" });
          // no celular, a folha de compartilhar tem "Salvar imagem"; no computador, baixa o arquivo
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: ticket.title }).catch(() => {});
          } else {
            const url = URL.createObjectURL(blob);
            const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 2000);
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Gerando…" : "Salvar ingresso"}
    </button>
  );
}

/** Link deste ingresso só, para mandar a quem vai usar (WhatsApp etc.). */
export function ShareTicketButton({ url, holder }: { url: string; holder: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn px-4! py-2!"
      onClick={async () => {
        const text = `Seu ingresso do Réveillon Pérolas (${holder}): ${url}`;
        if (navigator.share) {
          await navigator.share({ title: "Ingresso Réveillon Pérolas", text, url }).catch(() => {});
          return;
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }}
    >
      {copied ? "Link copiado ✓" : "Enviar a quem vai usar"}
    </button>
  );
}

/** Nome de quem vai usar o ingresso. Trocar gera QR novo; o antigo (e prints dele) deixa de valer. */
export function HolderForm({ orderToken, ticketId, holder }: { orderToken: string; ticketId: string; holder: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<HolderState, FormData>(updateHolderAction.bind(null, orderToken, ticketId), undefined);
  // salvou: fecha o formulário (ajuste de estado durante a renderização, padrão do React)
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setOpen(false);
  }
  if (!open) {
    return (
      <button type="button" className="text-xs text-accent underline-offset-4 hover:underline" onClick={() => setOpen(true)}>
        {state?.ok ?? "Trocar o nome de quem vai usar"}
      </button>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <label className="grid gap-1 text-xs uppercase tracking-widest text-fg-faint">
        Nome de quem vai usar
        <input
          name="holder"
          defaultValue={holder}
          required
          minLength={5}
          maxLength={80}
          autoComplete="name"
          className="rounded-xl border border-line bg-bg/60 px-4 py-3 text-base normal-case tracking-normal text-fg outline-none focus:border-accent"
        />
      </label>
      <p className="text-xs text-fg-faint">Ao trocar, um QR novo é gerado e o anterior (inclusive prints e links enviados) deixa de valer.</p>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn solid px-4! py-2!" disabled={pending}>
          {pending ? "Salvando…" : "Salvar nome"}
        </button>
        <button type="button" className="btn px-4! py-2!" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
