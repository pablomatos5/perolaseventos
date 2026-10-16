"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Result = {
  result: "ok" | "used" | "invalid" | "unauthorized" | "error";
  message: string;
  holder?: string;
  type?: string;
  batch?: string;
  half?: boolean;
};

const COLORS: Record<Result["result"], string> = {
  ok: "bg-ok text-black",
  used: "bg-danger text-white",
  invalid: "bg-danger text-white",
  unauthorized: "bg-danger text-white",
  error: "bg-yellow-400 text-black",
};

let audio: AudioContext | null = null;
function beep(ok: boolean) {
  try {
    const ctx = (audio ??= new AudioContext());
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    osc.frequency.value = ok ? 880 : 220;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.4));
    navigator.vibrate?.(ok ? 80 : [200, 80, 200]);
  } catch {}
}

const noSubscribe = () => () => {};
function read(storage: "session" | "local", key: string) {
  try {
    return (storage === "session" ? sessionStorage : localStorage).getItem(key);
  } catch {
    return null;
  }
}

export function Scanner() {
  // PIN fica só na aba (sessionStorage); o nome do aparelho fica salvo entre aberturas.
  const storedPin = useSyncExternalStore(noSubscribe, () => read("session", "portaria-pin"), () => null);
  const storedDevice = useSyncExternalStore(noSubscribe, () => read("local", "portaria-device"), () => null);
  const [pinOverride, setPin] = useState<string | null | undefined>(undefined);
  const [deviceOverride, setDevice] = useState<string | undefined>(undefined);
  const pin = pinOverride === undefined ? storedPin : pinOverride;
  const device = deviceOverride ?? storedDevice ?? "Portaria";
  const [last, setLast] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const [camera, setCamera] = useState(false);
  const recent = useRef(new Map<string, number>());
  const wedgeRef = useRef<HTMLInputElement>(null);

  const check = useCallback(
    async (code: string) => {
      code = code.trim();
      if (!code || !pin) return;
      // A câmera lê o mesmo QR várias vezes por segundo: ignora repetição em 4s.
      const seen = recent.current.get(code);
      if (seen && Date.now() - seen < 4000) return;
      recent.current.set(code, Date.now());

      let r: Result;
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-portaria-pin": pin },
          body: JSON.stringify({ code, device }),
        });
        r = await res.json();
      } catch {
        r = { result: "error", message: "Sem conexão: tente de novo" };
      }
      if (r.result === "unauthorized") {
        try {
          sessionStorage.removeItem("portaria-pin");
        } catch {}
        setPin(null);
      }
      if (r.result === "ok") setCount((c) => c + 1);
      beep(r.result === "ok");
      setLast(r);
    },
    [pin, device],
  );

  // Câmera do celular / maquininha smart
  useEffect(() => {
    if (!camera || !pin) return;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      scanner = new Html5Qrcode("reader");
      scanner
        .start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text) => check(text), () => {})
        .catch(() => setLast({ result: "error", message: "Não foi possível abrir a câmera" }));
    });
    return () => {
      cancelled = true;
      scanner?.stop().catch(() => {});
    };
  }, [camera, pin, check]);

  if (!pin) {
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <form
          className="glass-card grid w-full max-w-sm gap-4 p-8"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const p = String(f.get("pin"));
            const d = String(f.get("device")).trim() || "Portaria";
            try {
              sessionStorage.setItem("portaria-pin", p);
              localStorage.setItem("portaria-device", d);
            } catch {}
            setDevice(d);
            setPin(p);
          }}
        >
          <span className="eyebrow rule">Portaria</span>
          <input name="pin" type="password" inputMode="numeric" placeholder="PIN do evento" required className="rounded-xl border border-line bg-bg px-4 py-3" />
          <input name="device" defaultValue={device} placeholder="Nome deste aparelho (ex.: Portão 1)" className="rounded-xl border border-line bg-bg px-4 py-3" />
          <button className="btn solid">Entrar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col" onClick={() => !camera && wedgeRef.current?.focus()}>
      <header className="flex items-center justify-between border-b border-line px-5 py-4 text-sm">
        <span>{device}</span>
        <span className="tabular-nums text-fg-muted">{count} entradas aqui</span>
      </header>

      <div className={`grid flex-1 place-items-center p-6 text-center transition-colors ${last ? COLORS[last.result] : ""}`}>
        {last ? (
          <div>
            <div className="text-6xl font-semibold md:text-8xl">{last.result === "ok" ? "✓" : "✕"}</div>
            <div className="mt-3 text-2xl font-semibold md:text-4xl">{last.message}</div>
            {last.holder && (
              <div className="mt-4 text-lg">
                {last.holder} · {last.type} · {last.batch}
                {last.half && <strong className="mt-2 block text-2xl">MEIA: conferir documento</strong>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-fg-muted">Aponte para o QR ou use o leitor</p>
        )}
      </div>

      <div className="grid gap-3 border-t border-line p-5">
        <div id="reader" className={camera ? "mx-auto w-full max-w-sm overflow-hidden rounded-xl" : "hidden"} />
        {/* Leitor tipo pistola funciona como teclado: "digita" o código e manda Enter. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = wedgeRef.current!;
            check(input.value);
            input.value = "";
          }}
        >
          <input ref={wedgeRef} autoFocus placeholder="Leitor / código manual" className="w-full rounded-xl border border-line bg-bg px-4 py-3" />
        </form>
        <button type="button" className="btn" onClick={() => setCamera((c) => !c)}>
          {camera ? "Desligar câmera" : "Usar câmera"}
        </button>
      </div>
    </main>
  );
}
