"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  deviceName,
  deviceToken,
  forgetDevice,
  loadList,
  loadQueue,
  saveList,
  saveQueue,
  sha256b64url,
  type ListTicket,
  type Pending,
  type TicketList,
} from "./offline";

type Result = {
  result: "ok" | "used" | "invalid" | "unauthorized" | "error";
  message: string;
  usedAt?: string;
  usedBy?: string;
  ticketId?: string;
  holder?: string;
  type?: string;
  batch?: string;
  gender?: string;
  offline?: boolean;
};
type SearchHit = {
  ticketId: string;
  holder: string;
  buyer: string;
  code: string;
  cpfEnd?: string;
  type: string;
  batch: string;
  gender: string;
  status?: string;
  usedAt: string | null;
  usedBy: string | null;
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

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const noSubscribe = () => () => {};

export function Scanner() {
  // chave do aparelho: gravada pela página de ativação (link/QR gerado no painel)
  const storedToken = useSyncExternalStore(noSubscribe, deviceToken, () => null);
  const storedName = useSyncExternalStore(noSubscribe, deviceName, () => null);
  const [revoked, setRevoked] = useState(false);
  const token = revoked ? null : storedToken;
  const device = storedName ?? "Portaria";

  const [last, setLast] = useState<Result | null>(null);
  const [count, setCount] = useState(0);
  const [camera, setCamera] = useState(false);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [online, setOnline] = useState(true);
  // lista e fila salvas no aparelho (no servidor não existe localStorage: começa vazio)
  const [list, setList] = useState<TicketList | null>(() => (typeof window === "undefined" ? null : loadList()));
  const [queue, setQueue] = useState<Pending[]>(() => (typeof window === "undefined" ? [] : loadQueue()));
  const [tab, setTab] = useState<"ler" | "buscar">("ler");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);

  const recent = useRef(new Map<string, number>());
  const wedgeRef = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const listRef = useRef<TicketList | null>(null);
  const clearTimer = useRef(0);

  const authHeaders = useCallback((): Record<string, string> => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const unauthorized = useCallback(() => {
    forgetDevice();
    setRevoked(true);
  }, []);

  // ── lista offline e fila ──
  const updateLocal = useCallback((ticketId: string, usedAt: string, usedBy: string) => {
    const l = listRef.current;
    if (!l) return;
    const t = l.tickets.find((x) => x.id === ticketId);
    if (t && !t.usedAt) {
      t.usedAt = usedAt;
      t.usedBy = usedBy;
      saveList(l);
    }
  }, []);

  const enqueue = useCallback((p: Pending) => {
    const q = [...loadQueue(), p];
    saveQueue(q);
    setQueue(q);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    // 1) manda as entradas feitas offline
    const pending = loadQueue();
    if (pending.length) {
      const r = await fetch("/api/portaria/sync", { method: "POST", headers: authHeaders(), body: JSON.stringify({ checkins: pending }), signal: AbortSignal.timeout(15000) });
      if (r.status === 401) return unauthorized();
      if (r.ok) {
        const { results } = (await r.json()) as { results: { result: string; holder?: string }[] };
        const conflicts = results.filter((x) => x.result !== "ok");
        saveQueue([]);
        setQueue([]);
        if (conflicts.length) {
          setLast({
            result: "error",
            message: `${conflicts.length} entrada(s) offline já tinham sido usadas em outro aparelho`,
            holder: conflicts.map((c) => c.holder).filter(Boolean).slice(0, 3).join(", "),
          });
        }
      }
    }
    // 2) baixa a lista atualizada (inclui entradas dos outros aparelhos)
    const r = await fetch("/api/portaria/lista", { headers: authHeaders(), signal: AbortSignal.timeout(20000) });
    if (r.status === 401) return unauthorized();
    if (!r.ok) throw new Error("lista");
    const l = (await r.json()) as TicketList;
    listRef.current = l;
    saveList(l);
    setList(l);
  }, [token, authHeaders, unauthorized]);

  useEffect(() => {
    if (!token) return;
    listRef.current ??= loadList();
    const tick = () =>
      refresh()
        .then(() => setOnline(true))
        .catch(() => setOnline(false));
    tick();
    const t = setInterval(tick, 30_000);
    const goOnline = () => tick();
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [token, refresh]);

  const show = useCallback((r: Result) => {
    if (r.result === "ok") setCount((c) => c + 1);
    beep(r.result === "ok");
    setLast(r);
    // a tela volta ao normal sozinha: a próxima pessoa não vê o resultado da anterior
    clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setLast(null), r.result === "ok" ? 4000 : 7000);
  }, []);

  // ── validação offline (lista + fila) ──
  const checkOffline = useCallback(
    async (code: string): Promise<Result> => {
      const l = listRef.current;
      if (!l) return { result: "error", message: "Sem internet e sem lista baixada neste aparelho" };
      const h = await sha256b64url(code);
      const t = l.tickets.find((x) => x.h === h);
      if (!t) {
        // Sem internet não dá para conferir a assinatura: QR com formato de ingresso que não está na lista
        // pode ter sido comprado depois da última atualização. Amarelo = confira, não "falso".
        return /^PE[12]\.[a-z0-9]{20,40}\./i.test(code)
          ? { result: "error", message: "Não confirmado: fora da lista offline. Confira pela busca ou aguarde o sinal", offline: true }
          : { result: "invalid", message: "QR inválido: não é um ingresso Pérolas", offline: true };
      }
      return admitOffline(t, false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- admitOffline é estável (só usa refs/setters)
    [],
  );

  function admitOffline(t: ListTicket, manual: boolean): Result {
    const base = { ticketId: t.id, holder: t.holder, type: t.type, batch: t.batch, gender: t.gender, offline: true };
    if (t.usedAt) return { result: "used", message: `Já utilizado às ${hhmm(t.usedAt)} (${t.usedBy ?? "?"})`, ...base };
    const at = new Date().toISOString();
    updateLocal(t.id, at, device);
    enqueue({ ticketId: t.id, version: manual ? null : t.v, at, manual });
    return { result: "ok", message: "Liberado (offline)", ...base };
  }

  const check = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || !token) return;
      // a câmera lê o mesmo QR várias vezes por segundo: ignora repetição em 4 s
      const seen = recent.current.get(code);
      if (seen && Date.now() - seen < 4000) return;
      recent.current.set(code, Date.now());

      let r: Result;
      try {
        const res = await fetch("/api/checkin", { method: "POST", headers: authHeaders(), body: JSON.stringify({ code }), signal: AbortSignal.timeout(5000) });
        r = await res.json();
        if (res.status === 401) return unauthorized();
        setOnline(true);
        // mesma pessoa lida de novo neste aparelho logo depois (ex.: resposta lenta e nova leitura):
        // amarelo com o tempo, para o porteiro conferir, em vez de vermelho "já utilizado"
        const usedAt = r.result === "used" && r.usedBy === device && r.usedAt ? Date.parse(r.usedAt) : NaN;
        if (Date.now() - usedAt < 120_000) {
          r = { ...r, result: "error", message: `Já liberado neste aparelho há ${Math.round((Date.now() - usedAt) / 1000)} s: é a mesma pessoa?` };
        }
        if (r.result === "ok" && r.ticketId) updateLocal(r.ticketId, new Date().toISOString(), device);
      } catch {
        // sem resposta em 5 s: valida pela lista baixada e guarda para sincronizar depois
        setOnline(false);
        r = await checkOffline(code);
      }
      show(r);
    },
    [token, authHeaders, unauthorized, updateLocal, device, checkOffline, show],
  );

  // ── busca e liberação manual ──
  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 3) return setHits(null);
    try {
      if (!online) throw new Error("offline");
      const r = await fetch(`/api/portaria/busca?q=${encodeURIComponent(q.trim())}`, { headers: authHeaders(), signal: AbortSignal.timeout(5000) });
      if (r.status === 401) return unauthorized();
      setHits(((await r.json()) as { results: SearchHit[] }).results);
    } catch {
      const n = q.trim().toLowerCase();
      const local = (listRef.current?.tickets ?? []).filter(
        (t) => t.holder.toLowerCase().includes(n) || t.buyer.toLowerCase().includes(n) || t.code.toLowerCase() === n,
      );
      setHits(local.slice(0, 30).map((t) => ({ ticketId: t.id, holder: t.holder, buyer: t.buyer, code: t.code, type: t.type, batch: t.batch, gender: t.gender, usedAt: t.usedAt, usedBy: t.usedBy })));
    }
  }

  async function admitManual(hit: SearchHit) {
    if (!window.confirm(`Liberar a entrada de ${hit.holder} (${hit.type}) sem o QR?\nConfira o documento com foto.`)) return;
    let r: Result;
    try {
      const res = await fetch("/api/checkin", { method: "POST", headers: authHeaders(), body: JSON.stringify({ ticketId: hit.ticketId, manual: true }), signal: AbortSignal.timeout(5000) });
      if (res.status === 401) return unauthorized();
      r = await res.json();
      if (r.result === "ok") updateLocal(hit.ticketId, new Date().toISOString(), device);
    } catch {
      const t = listRef.current?.tickets.find((x) => x.id === hit.ticketId);
      r = t ? admitOffline(t, true) : { result: "error", message: "Sem internet e ingresso fora da lista" };
    }
    show(r);
    setTab("ler");
    setQuery("");
    setHits(null);
  }

  // ── câmera do celular / maquininha ──
  useEffect(() => {
    if (!camera || !token) return;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode("reader");
      scannerRef.current = scanner;
      scanner
        .start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, (text) => check(text), () => {})
        .then(() => {
          try {
            const supported = scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported();
            setTorch({ supported, on: false });
          } catch {
            setTorch({ supported: false, on: false });
          }
        })
        .catch(() => show({ result: "error", message: "Não foi possível abrir a câmera" }));
    });
    return () => {
      cancelled = true;
      setTorch({ supported: false, on: false });
      scannerRef.current?.stop().catch(() => {});
      scannerRef.current = null;
    };
  }, [camera, token, check, show]);

  async function toggleTorch() {
    const s = scannerRef.current;
    if (!s) return;
    try {
      await s.getRunningTrackCameraCapabilities().torchFeature().apply(!torch.on);
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {}
  }

  if (!token) {
    return (
      <main className="grid min-h-svh place-items-center p-6 text-center">
        <div className="glass-card grid max-w-sm gap-4 p-8">
          <span className="eyebrow rule justify-center">Portaria</span>
          <h1 className="font-display text-3xl">Aparelho não autorizado</h1>
          <p className="text-sm text-fg-muted">
            {revoked ? "Este aparelho foi desautorizado no painel." : "Para validar ingressos, este celular precisa ser autorizado."} No painel, vá em{" "}
            <strong className="text-fg">Portaria → Autorizar novo aparelho</strong> e leia o QR gerado com a câmera deste celular.
          </p>
        </div>
      </main>
    );
  }

  const listInfo = list ? `${list.tickets.length} ingressos · lista ${hhmm(list.at)}` : "lista ainda não baixada";

  return (
    <main className="flex min-h-svh flex-col" onClick={() => tab === "ler" && !camera && wedgeRef.current?.focus()}>
      <header className="grid gap-1 border-b border-line px-5 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{device}</span>
          <span className="tabular-nums text-fg-muted">{count} entradas aqui</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-faint">
          <span className={`inline-flex items-center gap-1.5 ${online ? "text-ok" : "text-yellow-400"}`}>
            <span className={`size-2 rounded-full ${online ? "bg-ok" : "bg-yellow-400"}`} />
            {online ? "online" : "SEM INTERNET · validando pela lista"}
          </span>
          <span>{listInfo}</span>
          {queue.length > 0 && <span className="text-yellow-400">{queue.length} a sincronizar</span>}
        </div>
      </header>

      <div className={`grid flex-1 place-items-center p-6 text-center transition-colors ${last ? COLORS[last.result] : ""}`}>
        {last ? (
          <div>
            <div className="text-6xl font-semibold md:text-8xl">{last.result === "ok" ? "✓" : last.result === "error" ? "!" : "✕"}</div>
            <div className="mt-3 text-2xl font-semibold md:text-4xl">{last.message}</div>
            {last.holder && (
              <div className="mt-4 text-lg">
                {last.holder}
                {last.type && ` · ${last.type}`}
                {last.batch && ` · ${last.batch}`}
                {last.gender && <strong className="mt-2 block text-2xl uppercase">{last.gender}</strong>}
              </div>
            )}
          </div>
        ) : (
          <p className="text-fg-muted">{tab === "ler" ? "Aponte para o QR ou use o leitor" : "Procure pelo nome, código do pedido ou CPF"}</p>
        )}
      </div>

      <div className="grid gap-3 border-t border-line p-5">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(["ler", "buscar"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" className={`btn ${tab === t ? "solid" : ""}`} onClick={() => setTab(t)}>
              {t === "ler" ? "Ler QR" : "Buscar por nome"}
            </button>
          ))}
        </div>

        {tab === "ler" ? (
          <>
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
            <div className="flex gap-2">
              <button type="button" className="btn flex-1" onClick={() => setCamera((c) => !c)}>
                {camera ? "Desligar câmera" : "Usar câmera"}
              </button>
              {camera && torch.supported && (
                <button type="button" className={`btn ${torch.on ? "solid" : ""}`} onClick={toggleTorch} aria-pressed={torch.on}>
                  {torch.on ? "Lanterna ligada" : "Lanterna"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="Nome, código do pedido ou CPF"
              autoFocus
              className="w-full rounded-xl border border-line bg-bg px-4 py-3"
            />
            <ul className="grid max-h-[45svh] gap-2 overflow-y-auto">
              {hits?.map((h) => (
                <li key={h.ticketId} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{h.holder}</div>
                    <div className="truncate text-xs text-fg-faint">
                      {h.type} · {h.batch}
                      {h.gender && ` · ${h.gender}`} · pedido {h.code}
                      {h.cpfEnd && ` · CPF ${h.cpfEnd}`}
                      {h.buyer !== h.holder && ` · comprou: ${h.buyer}`}
                    </div>
                  </div>
                  {h.status === "CANCELED" ? (
                    <span className="shrink-0 text-xs text-danger">cancelado</span>
                  ) : h.usedAt ? (
                    <span className="shrink-0 text-xs text-danger">usado {hhmm(h.usedAt)}</span>
                  ) : (
                    <button type="button" className="btn solid shrink-0 px-4! py-2!" onClick={() => admitManual(h)}>
                      Liberar
                    </button>
                  )}
                </li>
              ))}
              {hits && hits.length === 0 && <li className="text-sm text-fg-faint">Ninguém encontrado.</li>}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
