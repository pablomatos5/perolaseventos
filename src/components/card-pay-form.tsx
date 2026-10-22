"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cardPayAction, reportCardIssue, type CardField } from "@/app/actions";

// Pagamento com cartão dentro do site, no visual da página do pedido.
// Número, validade e CVV são "Secure Fields" do Mercado Pago (caixas seguras embutidas): o número do cartão
// fica com o Mercado Pago, que devolve um token; o servidor cobra só com esse token.
// Cada campo mostra o próprio erro (borda vermelha + mensagem embaixo), ao digitar e quando o cartão é recusado.

type MPError = { message?: string; cause?: string; code?: string; field?: string };
type MPField = {
  mount: (id: string) => MPField;
  on: (ev: string, cb: (d: { bin?: string; errorMessages?: MPError[] }) => void) => void;
  unmount: () => void;
};
type MPInstance = {
  fields: { create: (type: string, opts: object) => MPField; createCardToken: (d: object) => Promise<{ id: string }> };
  getPaymentMethods: (d: { bin: string }) => Promise<{ results: { id: string; payment_type_id: string; additional_info_needed?: string[] }[] }>;
  getIssuers: (d: { paymentMethodId: string; bin: string }) => Promise<{ id: string; name: string }[]>;
  getInstallments: (d: { amount: string; bin: string; paymentTypeId: string }) => Promise<{ payer_costs: { installments: number; recommended_message: string }[] }[]>;
};
declare global {
  interface Window {
    MercadoPago?: new (key: string, opts: { locale: string }) => MPInstance;
    MP_DEVICE_SESSION_ID?: string;
  }
}

// carrega cada script uma vez só; quem chamar de novo espera o mesmo carregamento terminar
const loading = new Map<string, Promise<void>>();
function loadScript(src: string, attrs: Record<string, string> = {}) {
  let p = loading.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
      s.onload = () => resolve();
      s.onerror = () => {
        loading.delete(src);
        reject(new Error("não carregou " + src));
      };
      document.head.appendChild(s);
    });
    loading.set(src, p);
  }
  return p;
}

// estilo do texto DENTRO das caixas seguras (a borda e o fundo são do nosso CSS)
const FIELD_STYLE = { fontSize: "16px", color: "#2e2466", placeholderColor: "#8f86b8", fontFamily: "Montserrat, Arial, sans-serif" };

const maskCpf = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
};

function validCpf(raw: string) {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

const FIELD_MSG: Record<CardField, string> = {
  number: "Número do cartão inválido.",
  expiry: "Validade inválida ou vencida.",
  cvv: "Código de segurança (CVV) inválido.",
  name: "Digite o nome como está impresso no cartão.",
  cpf: "CPF inválido.",
};
const FIELD_ID: Record<CardField, string> = { number: "mp-card-number", expiry: "mp-card-expiry", cvv: "mp-card-cvv", name: "card-name", cpf: "card-cpf" };
const ORDER: CardField[] = ["number", "expiry", "cvv", "name", "cpf"];

/** Descobre a que campo um erro do Mercado Pago se refere (pelos códigos e nomes de campo que ele devolve). */
/** Só os códigos de erro do Mercado Pago (nunca o que foi digitado), para o registro de problemas do cartão. */
const errCodes = (err: unknown) => (JSON.stringify(err ?? "").match(/"(?:code|cause)":"?([A-Za-z0-9_]{2,30})/g) ?? []).join(",").slice(0, 80);

function fieldOf(err: unknown): CardField | null {
  const t = JSON.stringify(err ?? "").toLowerCase();
  if (/cardnumber|card_number|"(205|e301)"/.test(t)) return "number";
  if (/expiration|"(208|209|325|326|e205)"/.test(t)) return "expiry";
  if (/securitycode|security_code|"(224|e302|e203)"/.test(t)) return "cvv";
  if (/cardholdername|"(221|316)"/.test(t)) return "name";
  if (/identification|"(214|324|e214)"/.test(t)) return "cpf";
  return null;
}

export function CardPayForm({ token, publicKey, amountCents, buyerName, cpf }: { token: string; publicKey: string; amountCents: number; buyerName: string; cpf: string }) {
  const router = useRouter();
  const mpRef = useRef<MPInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [method, setMethod] = useState<{ id: string; type: string; issuerId?: string } | null>(null);
  const [options, setOptions] = useState<{ installments: number; label: string }[]>([]);
  const [installments, setInstallments] = useState(1);
  const [name, setName] = useState(buyerName);
  const [doc, setDoc] = useState(maskCpf(cpf));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CardField, string>>>({});
  const [paid, setPaid] = useState(false);

  const setFieldError = (f: CardField, msg: string | null) =>
    setErrors((e) => {
      const next = { ...e };
      if (msg) next[f] = msg;
      else delete next[f];
      return next;
    });
  const focusField = (f: CardField) => document.getElementById(FIELD_ID[f])?.scrollIntoView({ block: "center", behavior: "smooth" });

  useEffect(() => {
    let cancelled = false;
    const fields: MPField[] = [];
    (async () => {
      try {
        // script de segurança do Mercado Pago (identifica o aparelho, melhora a aprovação) e o SDK
        loadScript("https://www.mercadopago.com/v2/security.js", { view: "checkout" }).catch(() => {});
        await loadScript("https://sdk.mercadopago.com/js/v2");
        if (cancelled || !window.MercadoPago) return;
        for (const id of ["mp-card-number", "mp-card-expiry", "mp-card-cvv"]) document.getElementById(id)?.replaceChildren();
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        mpRef.current = mp;
        const make = (type: string, id: string, placeholder: string, f: CardField) => {
          const el = mp.fields.create(type, { placeholder, style: FIELD_STYLE }).mount(id);
          // o Mercado Pago avisa quando o que foi digitado deixa de ser válido (ou volta a ser)
          el.on("validityChange", ({ errorMessages }) => setFieldError(f, errorMessages?.length ? FIELD_MSG[f] : null));
          fields.push(el);
          return el;
        };
        const number = make("cardNumber", "mp-card-number", "0000 0000 0000 0000", "number");
        make("expirationDate", "mp-card-expiry", "MM/AA", "expiry");
        make("securityCode", "mp-card-cvv", "CVV", "cvv");
        number.on("binChange", async ({ bin }) => {
          if (!bin) {
            setMethod(null);
            setOptions([]);
            return;
          }
          try {
            const { results } = await mp.getPaymentMethods({ bin });
            const pm = results[0];
            if (!pm) {
              void reportCardIssue(token, "bandeira", "BIN sem bandeira no Mercado Pago");
              return setFieldError("number", "Cartão não aceito. Use Visa, Mastercard, Elo, Hipercard ou Amex.");
            }
            setFieldError("number", null);
            let issuerId: string | undefined;
            if (pm.additional_info_needed?.includes("issuer_id")) issuerId = (await mp.getIssuers({ paymentMethodId: pm.id, bin }))[0]?.id;
            setMethod({ id: pm.id, type: pm.payment_type_id, issuerId: issuerId ? String(issuerId) : undefined });
            if (pm.payment_type_id === "credit_card") {
              const inst = await mp.getInstallments({ amount: (amountCents / 100).toFixed(2), bin, paymentTypeId: pm.payment_type_id });
              const costs = inst[0]?.payer_costs ?? [];
              // o Mercado Pago oferece até 18x; o site (e o servidor, MAX_INSTALLMENTS em actions.ts) aceitam até 6x
              setOptions(costs.filter((c) => c.installments <= 6).map((c) => ({ installments: c.installments, label: c.recommended_message })));
            } else setOptions([]);
            setInstallments(1);
          } catch {
            /* sem bandeira ainda: o usuário continua digitando */
          }
        });
        setReady(true);
      } catch {
        if (!cancelled) {
          setLoadError(true);
          void reportCardIssue(token, "carregar", "SDK ou campos do Mercado Pago não carregaram");
        }
      }
    })();
    return () => {
      cancelled = true;
      for (const f of fields) {
        try {
          f.unmount();
        } catch {}
      }
    };
  }, [publicKey, amountCents, token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mp = mpRef.current;
    if (!mp || pending) return;
    setError(null);
    // conferência local antes de falar com o Mercado Pago
    const local: Partial<Record<CardField, string>> = { ...errors };
    if (!method && !local.number) local.number = "Digite o número do cartão.";
    if (name.trim().length < 2) local.name = FIELD_MSG.name;
    else delete local.name;
    if (!validCpf(doc)) local.cpf = FIELD_MSG.cpf;
    else delete local.cpf;
    setErrors(local);
    const first = ORDER.find((f) => local[f]);
    if (first || !method) {
      void reportCardIssue(token, "local", `campos: ${ORDER.filter((f) => local[f]).join(",") || "sem bandeira"}`);
      return focusField(first ?? "number");
    }

    setPending(true);
    try {
      let card: { id: string };
      try {
        card = await mp.fields.createCardToken({ cardholderName: name.trim(), identificationType: "CPF", identificationNumber: doc.replace(/\D/g, "") });
      } catch (err) {
        // o Mercado Pago diz qual campo está errado; se não disser, marca os três dados do cartão
        const f = fieldOf(err);
        void reportCardIssue(token, "token", `${f ?? "sem campo"} ${errCodes(err)}`);
        if (f) {
          setFieldError(f, FIELD_MSG[f]);
          focusField(f);
        } else {
          setErrors((x) => ({ ...x, number: x.number ?? "Confira o número.", expiry: x.expiry ?? "Confira a validade.", cvv: x.cvv ?? "Confira o CVV." }));
          focusField("number");
        }
        return;
      }
      const r = await cardPayAction(token, { token: card.id, paymentMethodId: method.id, issuerId: method.issuerId, installments, deviceId: window.MP_DEVICE_SESSION_ID });
      if (r?.ok) {
        setPaid(true);
        router.refresh();
      } else if (r?.field) {
        setFieldError(r.field, r.error ?? FIELD_MSG[r.field]);
        focusField(r.field);
      } else setError(r?.error ?? "Pagamento recusado. Tente de novo.");
    } finally {
      setPending(false);
    }
  }

  if (paid) return <p className="pay-result is-ok">Pagamento aprovado! Seus ingressos estão chegando…</p>;

  const hint = (f: CardField) =>
    errors[f] ? (
      <span id={`${FIELD_ID[f]}-err`} role="alert" className="card-error">
        {errors[f]}
      </span>
    ) : null;
  const bad = (f: CardField) => (errors[f] ? " is-invalid" : "");

  return (
    <form onSubmit={submit} className="card-form" noValidate>
      {loadError && <p className="pay-result is-error card-field-full">Não foi possível carregar o pagamento com cartão. Atualize a página ou pague no Pix.</p>}
      <div className="card-field card-field-full">
        <span>Número do cartão</span>
        <div id="mp-card-number" className={`card-input${ready ? "" : " is-loading"}${bad("number")}`} />
        {hint("number")}
      </div>
      <div className="card-field">
        <span>Validade</span>
        <div id="mp-card-expiry" className={`card-input${bad("expiry")}`} />
        {hint("expiry")}
      </div>
      <div className="card-field">
        <span>CVV</span>
        <div id="mp-card-cvv" className={`card-input${bad("cvv")}`} />
        {hint("cvv")}
      </div>
      <label className="card-field card-field-full">
        <span>Nome impresso no cartão</span>
        <input
          id="card-name"
          className={`card-input${bad("name")}`}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name && e.target.value.trim().length >= 2) setFieldError("name", null);
          }}
          autoComplete="cc-name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "card-name-err" : undefined}
        />
        {hint("name")}
      </label>
      <label className="card-field card-field-full">
        <span>CPF do dono do cartão</span>
        <input
          id="card-cpf"
          className={`card-input${bad("cpf")}`}
          value={doc}
          onChange={(e) => {
            const v = maskCpf(e.target.value);
            setDoc(v);
            if (errors.cpf && validCpf(v)) setFieldError("cpf", null);
          }}
          onBlur={() => {
            if (doc.replace(/\D/g, "").length > 0 && !validCpf(doc)) setFieldError("cpf", FIELD_MSG.cpf);
          }}
          inputMode="numeric"
          placeholder="000.000.000-00"
          aria-invalid={errors.cpf ? true : undefined}
          aria-describedby={errors.cpf ? "card-cpf-err" : undefined}
        />
        {hint("cpf")}
      </label>
      {options.length > 1 && (
        <label className="card-field card-field-full">
          <span>Parcelas</span>
          <select className="card-input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
            {options.map((o) => (
              <option key={o.installments} value={o.installments}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {method?.type === "debit_card" && <p className="card-hint card-field-full">Cartão de débito: pagamento à vista.</p>}
      {error && (
        <p role="alert" className="pay-result is-error card-field-full">
          {error}
        </p>
      )}
      <button className="btn solid card-field-full w-full" disabled={!ready || pending}>
        {pending ? "Processando…" : `Pagar ${(amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
      </button>
      <p className="card-hint card-field-full">🔒 Os dados do cartão vão direto para o Mercado Pago, com criptografia. A Pérolas não vê nem guarda o número do cartão.</p>
    </form>
  );
}
