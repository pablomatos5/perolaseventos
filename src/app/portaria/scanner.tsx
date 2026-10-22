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

/** Saídas por ingresso (igual ao servidor: MAX_EXITS em src/lib/checkin.ts). */
const MAX_EXITS = 2;

type Result = {
  result: "ok" | "used" | "invalid" | "unauthorized" | "error" | "exit";
  reentry?: boolean;
  exitsLeft?: number;
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
  exit: "bg-violet-500 text-white",
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

// preferências deste aparelho (localStorage; sem acesso = valores padrão)
const pref = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};
const countKey = () => `portaria-entradas-${new Date().toLocaleDateString("sv-SE")}`; // contador do dia

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

  // ao abrir: câmera ligada por padrão no celular (ou o que o porteiro escolheu da última vez) e o
  // contador de entradas do dia que já estava neste aparelho
  useEffect(() => {
    const saved = pref.get("portaria-camera");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferência lida só no navegador
    setCamera(saved ? saved === "1" : matchMedia("(pointer: coarse)").matches);
    setCount(Number(pref.get(countKey()) ?? 0));
  }, []);
  const toggleCamera = () =>
    setCamera((c) => {
      pref.set("portaria-camera", c ? "0" : "1");
      return !c;
    });

  // tela sempre acesa enquanto a portaria está aberta (o celular não apaga no meio da fila)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const ask = () => {
      if (document.visibilityState === "visible") navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      document.removeEventListener("visibilitychange", ask);
      lock?.release().catch(() => {});
    };
  }, []);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [online, setOnline] = useState(true);
  // lista e fila salvas no aparelho (no servidor não existe localStorage: começa vazio)
  const [list, setList] = useState<TicketList | null>(() => (typeof window === "undefined" ? null : loadList()));
  const [queue, setQueue] = useState<Pending[]>(() => (typeof window === "undefined" ? [] : loadQueue()));
  const [tab, setTab] = useState<"ler" | "buscar">("ler");
  // Entrada (padrão) ou Saída temporária: na saída, ler o QR registra que o convidado saiu e vai voltar
  const [mode, setMode] = useState<"entrada" | "saida">("entrada");
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
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

  const updateLocalExit = useCallback((ticketId: string, at: string) => {
    const l = listRef.current;
    if (!l) return;
    const t = l.tickets.find((x) => x.id === ticketId);
    if (t) {
      t.usedAt = null;
      t.usedBy = null;
      t.x = (t.x ?? 0) + 1;
      t.xa = at;
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
    if (r.result === "ok" && !r.reentry)
      setCount((c) => {
        pref.set(countKey(), String(c + 1));
        return c + 1;
      });
    beep(r.result === "ok" || r.result === "exit");
    setLast(r);
    // a tela volta ao normal sozinha: a próxima pessoa não vê o resultado da anterior
    clearTimeout(clearTimer.current);
    // verde some rápido (fila andando); erro fica mais, mas o porteiro fecha na hora com um toque
    clearTimer.current = window.setTimeout(() => setLast(null), r.result === "ok" || r.result === "exit" ? 2500 : 6000);
  }, []);

  /** Fecha o aviso na hora. Depois de erro, libera ler o mesmo QR de novo ("tentar de novo"). */
  const dismiss = useCallback(
    (then?: "buscar") => {
      clearTimeout(clearTimer.current);
      setLast((l) => {
        if (l && l.result !== "ok") recent.current.clear();
        return null;
      });
      if (then === "buscar") setTab("buscar");
      else window.setTimeout(() => wedgeRef.current?.focus(), 0);
    },
    [],
  );

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
      return modeRef.current === "saida" ? exitOffline(t, false) : admitOffline(t, false);
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
    if (t.xa) return { result: "ok", reentry: true, message: `Reentrada (offline) · saiu às ${hhmm(t.xa)}`, ...base, exitsLeft: MAX_EXITS - (t.x ?? 0) };
    return { result: "ok", message: "Liberado (offline)", ...base };
  }

  function exitOffline(t: ListTicket, manual: boolean): Result {
    const base = { ticketId: t.id, holder: t.holder, type: t.type, batch: t.batch, gender: t.gender, offline: true };
    if (!t.usedAt && t.xa) return { result: "invalid", message: `Saída já registrada às ${hhmm(t.xa)}: ainda não voltou`, ...base };
    if (!t.usedAt) return { result: "invalid", message: "Este ingresso ainda não entrou: não há saída para registrar", ...base };
    if ((t.x ?? 0) >= MAX_EXITS) return { result: "invalid", message: `Limite de ${MAX_EXITS} saídas atingido: se sair, não volta com este ingresso`, ...base, exitsLeft: 0 };
    const at = new Date().toISOString();
    updateLocalExit(t.id, at);
    enqueue({ ticketId: t.id, version: manual ? null : t.v, at, manual, kind: "exit" });
    return { result: "exit", message: "Saída registrada (offline) · pode voltar com o mesmo QR", ...base, exitsLeft: MAX_EXITS - (t.x ?? 0) };
  }

  /** Saída pelo botão (depois de "já utilizado") ou pela busca: sem QR, pelo id do ingresso. */
  async function exitById(ticketId: string) {
    let r: Result;
    try {
      const res = await fetch("/api/portaria/saida", { method: "POST", headers: authHeaders(), body: JSON.stringify({ ticketId }), signal: AbortSignal.timeout(5000) });
      if (res.status === 401) return unauthorized();
      r = await res.json();
      if (r.result === "exit") updateLocalExit(ticketId, new Date().toISOString());
    } catch {
      const t = listRef.current?.tickets.find((x) => x.id === ticketId);
      r = t ? exitOffline(t, true) : { result: "error", message: "Sem internet e ingresso fora da lista" };
    }
    show(r);
  }

  const check = useCallback(
    async (raw: string, fromCamera = false) => {
      const code = raw.trim();
      if (!code || !token) return;
      // a câmera lê o mesmo QR várias vezes por segundo: só ela ignora repetição (4,5 s). Leitor pistola e
      // código digitado conferem sempre (senão a tela verde anterior ficava parada para um print repetido).
      if (fromCamera) {
        const seen = recent.current.get(code);
        if (seen && Date.now() - seen < 4500) return; // enquanto o resultado (4 s) está na tela
      }
      recent.current.set(code, Date.now());
      setLast(null); // limpa o resultado anterior enquanto confere (nunca mostra o verde de outra pessoa)

      let r: Result;
      const saida = modeRef.current === "saida";
      try {
        const res = await fetch(saida ? "/api/portaria/saida" : "/api/checkin", { method: "POST", headers: authHeaders(), body: JSON.stringify({ code }), signal: AbortSignal.timeout(5000) });
        r = await res.json();
        if (res.status === 401) return unauthorized();
        setOnline(true);
        if (r.result === "exit" && r.ticketId) updateLocalExit(r.ticketId, new Date().toISOString());
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
    [token, authHeaders, unauthorized, updateLocal, updateLocalExit, device, checkOffline, show],
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
    if (!window.confirm(`Liberar a entrada de ${hit.holder} (${hit.type}${hit.gender ? ` · ${hit.gender.toUpperCase()}` : ""}) sem o QR?\nConfira o documento com foto.`)) return;
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
      // leitor nativo de QR do navegador quando existe (Android/Chrome): mais rápido e lê QR pequeno/torto
      const scanner = new Html5Qrcode("reader", { verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
      scannerRef.current = scanner;
      scanner
        .start(
          { facingMode: "environment" },
          // quadro de leitura proporcional à tela (a câmera ocupa a área principal)
          // vídeo quadrado; lê dentro do quadro de mira (78% do lado)
          { fps: 12, aspectRatio: 1, qrbox: (w, h) => ({ width: Math.round(Math.min(w, h) * 0.78), height: Math.round(Math.min(w, h) * 0.78) }) },
          (text) => check(text, true),
          () => {},
        )
        .then(() => {
          try {
            const supported = scanner.getRunningTrackCameraCapabilities().torchFeature().isSupported();
            setTorch({ supported, on: false });
          } catch {
            setTorch({ supported: false, on: false });
          }
        })
        .catch(() => {
          // sem permissão ou sem câmera: volta para o leitor/código e explica
          setCamera(false);
          show({ result: "error", message: "Câmera bloqueada: permita o acesso à câmera nas configurações do navegador" });
        });
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
      <main className="portaria-night grid min-h-svh place-items-center p-6 text-center">
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
    <main className="portaria-night flex h-svh flex-col overflow-hidden" onClick={() => tab === "ler" && !camera && wedgeRef.current?.focus()}>
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

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* câmera ocupa a área principal; o resultado cobre a câmera por alguns segundos */}
        <div className={camera && tab === "ler" ? "portaria-cam" : "hidden"}>
          <div id="reader" className="portaria-reader" />
          <span className="portaria-aim" aria-hidden />
        </div>
        {camera && tab === "ler" && !last && <p className="portaria-hint">Aponte para o QR do ingresso</p>}
        <div
          className={`grid flex-1 place-items-center p-6 text-center transition-colors ${last ? COLORS[last.result] : ""} ${camera && tab === "ler" ? "absolute inset-0" : ""} ${camera && tab === "ler" && !last ? "pointer-events-none opacity-0" : ""}`}
          aria-live="assertive"
          onClick={(e) => {
            if (!last) return;
            e.stopPropagation();
            dismiss();
          }}
        >
          {last ? (
            <div className="grid justify-items-center">
              <div className="text-7xl font-semibold md:text-8xl">{last.result === "ok" ? "✓" : last.result === "exit" ? "↩" : last.result === "error" ? "!" : "✕"}</div>
              <div className="mt-3 text-2xl font-semibold md:text-4xl">{last.message}</div>
              {last.holder && (
                <div className="mt-4 grid justify-items-center gap-3 text-lg">
                  {/* gênero em destaque: evita homem entrando com ingresso feminino (mais barato) */}
                  <GenderBadge gender={last.gender} big />
                  <span>
                    {last.holder}
                    {last.type && ` · ${last.type}`}
                    {last.batch && ` · ${last.batch}`}
                  </span>
                  {(last.result === "exit" || last.reentry) && last.exitsLeft !== undefined && (
                    <span className="text-base opacity-90">
                      {last.exitsLeft > 0 ? `Pode sair mais ${last.exitsLeft} vez(es) e voltar` : "Não pode mais sair e voltar com este ingresso"}
                    </span>
                  )}
                </div>
              )}
              {/* ações grandes: um toque e já lê o próximo */}
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="portaria-act"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                >
                  {last.result === "ok" || last.result === "exit" ? "Próximo" : "Tentar de novo"}
                </button>
                {last.result === "used" && last.ticketId && (
                  <button
                    type="button"
                    className="portaria-act is-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      const id = last.ticketId!;
                      if (window.confirm(`Registrar a saída de ${last.holder}? Poderá voltar com o mesmo QR (até ${MAX_EXITS} saídas por noite).`)) void exitById(id);
                    }}
                  >
                    Registrar saída
                  </button>
                )}
                {last.result !== "ok" && last.result !== "exit" && (
                  <button
                    type="button"
                    className="portaria-act is-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss("buscar");
                    }}
                  >
                    Buscar por nome
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs opacity-70">ou toque em qualquer lugar</p>
            </div>
          ) : (
            <p className="text-fg-muted">
              {tab === "buscar" ? "Procure pelo nome, código do pedido ou CPF" : mode === "saida" ? "MODO SAÍDA: leia o QR de quem vai sair e voltar" : "Aponte para o QR ou use o leitor"}
            </p>
          )}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 border-t border-line p-5 [&>*]:min-w-0">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {(["ler", "buscar"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} type="button" className={`btn ${tab === t ? "solid" : ""}`} onClick={() => setTab(t)}>
              {t === "ler" ? "Ler QR" : "Buscar por nome"}
            </button>
          ))}
        </div>

        {tab === "ler" ? (
          <>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo da leitura">
              <button type="button" role="radio" aria-checked={mode === "entrada"} className={`btn ${mode === "entrada" ? "solid" : ""}`} onClick={() => setMode("entrada")}>
                Entrada
              </button>
              <button type="button" role="radio" aria-checked={mode === "saida"} className={`btn ${mode === "saida" ? "portaria-saida-on" : ""}`} onClick={() => setMode("saida")}>
                Saída (vai voltar)
              </button>
            </div>
            {mode === "saida" && (
              <p className="rounded-lg bg-violet-500/20 px-3 py-2 text-center text-xs text-violet-200">
                Modo saída ligado: cada QR lido registra a saída (até {MAX_EXITS} por ingresso). Volte para “Entrada” depois.
              </p>
            )}
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
              <button type="button" className="btn flex-1" onClick={toggleCamera}>
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
            <ul className="grid min-w-0 max-h-[45svh] grid-cols-1 gap-2 overflow-y-auto">
              {hits?.map((h) => (
                <li key={h.ticketId} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.holder}</div>
                    <div className="truncate text-xs text-fg-faint">
                      {h.type} · {h.batch}
                      {h.gender && <> · <GenderBadge gender={h.gender} /></>} · pedido {h.code}
                      {h.cpfEnd && ` · CPF ${h.cpfEnd}`}
                      {h.buyer !== h.holder && ` · comprou: ${h.buyer}`}
                    </div>
                  </div>
                  {h.status === "CANCELED" ? (
                    <span className="shrink-0 text-xs text-danger">cancelado</span>
                  ) : h.usedAt ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-danger">entrou {hhmm(h.usedAt)}</span>
                      <button
                        type="button"
                        className="btn px-3! py-2!"
                        onClick={() => {
                          if (window.confirm(`Registrar a saída de ${h.holder}? Poderá voltar com o mesmo QR (até ${MAX_EXITS} saídas por noite).`)) {
                            void exitById(h.ticketId);
                            setTab("ler");
                            setQuery("");
                            setHits(null);
                          }
                        }}
                      >
                        Saída
                      </button>
                    </div>
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

/** Selo do gênero do ingresso (feminino rosa, masculino azul); grande no resultado da leitura. */
function GenderBadge({ gender, big = false }: { gender?: string; big?: boolean }) {
  if (!gender) return null;
  if (gender === "Cortesia") return <span className="gender-badge is-cortesia">{gender.toUpperCase()}</span>;
  const fem = gender === "Feminino";
  return (
    <span className={`gender-badge ${fem ? "is-fem" : "is-masc"} ${big ? "is-big" : ""}`}>
      <b aria-hidden>{fem ? "♀" : "♂"}</b> {gender.toUpperCase()}
      {big && <small>{fem ? "Confira: entrada feminina" : "Entrada masculina"}</small>}
    </span>
  );
}
