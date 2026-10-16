"use client";

import { useSyncExternalStore } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), seg: s % 60 };
}

function subscribe(tick: () => void) {
  const t = setInterval(tick, 1000);
  return () => clearInterval(t);
}
// arredondado ao segundo: o snapshot fica estável entre leituras do mesmo segundo
const clientNow = () => Math.floor(Date.now() / 1000) * 1000;

/** Contagem regressiva para a virada. Renderiza "--" no servidor para não divergir na hidratação. */
export function Countdown({ target }: { target: string }) {
  const now = useSyncExternalStore(subscribe, clientNow, () => null);
  const p = parts(now === null ? 0 : new Date(target).getTime() - now);
  return (
    <div className="flex gap-6 md:gap-10" aria-label="Contagem regressiva para o réveillon">
      {Object.entries(p).map(([label, value]) => (
        <div key={label} className="text-center">
          <div className="font-display text-4xl font-light tabular-nums md:text-6xl">
            {now === null ? "--" : String(value).padStart(2, "0")}
          </div>
          <div className="eyebrow mt-1 text-[0.55rem]! text-fg-faint!">{label}</div>
        </div>
      ))}
    </div>
  );
}
