"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cardCancelChallengeAction, cardPayAction, cardStatusAction, reportCardIssue, type CardField, type CardState } from "@/app/actions";

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
  number: "Número do cartão inválido. Confira os dígitos.",
  expiry: "Validade inválida ou vencida. Use o formato MM/AA, como está no cartão.",
  cvv: "CVV inválido: são os 3 números do verso do cartão (4 na frente, no Amex).",
  name: "Digite o nome e o sobrenome como estão impressos no cartão.",
  cpf: "CPF inválido. Confira os 11 números do CPF do dono do cartão.",
};
// quando o campo está só incompleto (o Mercado Pago avisa "invalid_length"), a mensagem diz o que falta
const FIELD_SHORT: Partial<Record<CardField, string>> = {
  number: "Número incompleto: faltam dígitos do cartão.",
  expiry: "Validade incompleta: digite mês e ano (MM/AA).",
  cvv: "CVV incompleto: são 3 números no verso (4 no Amex).",
};
const FIELD_LABEL: Record<CardField, string> = { number: "número do cartão", expiry: "validade", cvv: "CVV", name: "nome", cpf: "CPF" };
const mpMessage = (f: CardField, errs: MPError[]) => {
  const t = JSON.stringify(errs).toLowerCase();
  if (f === "expiry" && /past|expired|venc/.test(t)) return "Este cartão está vencido. Use outro cartão ou pague no Pix.";
  return (/length|incomplete/.test(t) && FIELD_SHORT[f]) || FIELD_MSG[f];
};
// nome do titular: pelo menos nome e sobrenome, sem números
const validName = (v: string) => /^\p{L}[\p{L}'.-]*(\s+\p{L}[\p{L}'.-]*)+$/u.test(v.trim());
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
  const [declines, setDeclines] = useState(0);
  // 3D Secure: confirmação do banco aberta (janela por cima da página) e pagamento em análise no Mercado Pago
  const [challenge, setChallenge] = useState<{ url: string; creq: string; paymentId: string } | null>(null);
  const [review, setReview] = useState<{ paymentId: string; msg: string } | null>(null);
  const challengeForm = useRef<HTMLFormElement | null>(null);
  // erro do Mercado Pago guardado enquanto a pessoa digita; só aparece quando ela sai do campo
  const pendingMsg = useRef<Partial<Record<CardField, string>>>({});

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
          // o Mercado Pago avisa quando o que foi digitado deixa de ser válido (ou volta a ser): o erro some na hora
          // em que o campo fica certo, mas só aparece quando a pessoa sai do campo (para não brigar enquanto digita)
          el.on("validityChange", ({ errorMessages }) => {
            if (errorMessages?.length) pendingMsg.current[f] = mpMessage(f, errorMessages);
            else {
              delete pendingMsg.current[f];
              setFieldError(f, null);
            }
          });
          el.on("blur", () => {
            const msg = pendingMsg.current[f];
            if (msg) setFieldError(f, msg);
          });
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
              return setFieldError("number", "Não reconhecemos este cartão. Confira os primeiros números ou use Visa, Mastercard, Elo, Hipercard ou Amex.");
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

  /** Resposta do servidor (pagamento novo ou conferência): aprovado, desafio do banco, em análise ou recusado. */
  function handleReply(r: CardState) {
    if (r?.ok) {
      setChallenge(null);
      setReview(null);
      setPaid(true);
      router.refresh();
      return;
    }
    if (r?.challenge && r.paymentId) {
      setError(null);
      setChallenge({ ...r.challenge, paymentId: r.paymentId });
      return;
    }
    if (r?.review && r.paymentId) {
      setChallenge(null);
      setError(null);
      setReview({ paymentId: r.paymentId, msg: r.error ?? "Pagamento em análise." });
      return;
    }
    setChallenge(null);
    if (r?.field) {
      setFieldError(r.field, r.error ?? FIELD_MSG[r.field]);
      focusField(r.field);
      return;
    }
    if (r?.declined) setDeclines((n) => n + 1);
    setError(r?.error ?? "Pagamento recusado. Tente de novo.");
  }

  // abre a confirmação do banco: o formulário com o creq é enviado para dentro do iframe (receita do Mercado Pago)
  useEffect(() => {
    if (challenge) challengeForm.current?.submit();
  }, [challenge]);

  // acompanha o pagamento enquanto o banco confirma (o Mercado Pago avisa com "COMPLETE" pelo iframe, mas a
  // situação só muda depois: confere a cada poucos segundos) ou enquanto está em análise
  useEffect(() => {
    const watching = challenge ?? review;
    if (!watching) return;
    const { paymentId } = watching;
    const inChallenge = !!challenge;
    let stop = false;
    let busy = false;
    const started = Date.now();
    const check = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const r = await cardStatusAction(token, paymentId);
        if (stop) return;
        // ainda esperando a confirmação do banco
        if (r?.paymentId && !r.ok && !r.review && !r.error) {
          if (inChallenge && Date.now() - started > 6 * 60_000) {
            stop = true;
            setChallenge(null);
            setError("A confirmação do banco expirou. Tente pagar de novo ou pague no Pix.");
          }
          return;
        }
        if (!inChallenge && r?.review) return; // continua em análise
        stop = true;
        handleReply(r);
      } finally {
        busy = false;
      }
    };
    const onMessage = (e: MessageEvent) => {
      if ((e.data as { status?: string } | null)?.status === "COMPLETE") void check();
    };
    window.addEventListener("message", onMessage);
    const t = setInterval(check, inChallenge ? 3000 : 10_000);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("message", onMessage);
    };
    // handleReply só usa setters e o router (estáveis)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, review, token]);

  async function cancelChallenge() {
    const c = challenge;
    setChallenge(null);
    setError("Confirmação do banco cancelada. Você pode tentar de novo ou pagar no Pix.");
    if (c) await cardCancelChallengeAction(token, c.paymentId);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mp = mpRef.current;
    if (!mp || pending) return;
    setError(null);
    // conferência local antes de falar com o Mercado Pago
    const local: Partial<Record<CardField, string>> = { ...errors, ...pendingMsg.current };
    if (!method && !local.number) local.number = "Digite o número do cartão.";
    if (!validName(name)) local.name = FIELD_MSG.name;
    else delete local.name;
    if (!validCpf(doc)) local.cpf = FIELD_MSG.cpf;
    else delete local.cpf;
    setErrors(local);
    const first = ORDER.find((f) => local[f]);
    if (first) setError(`Falta corrigir: ${ORDER.filter((f) => local[f]).map((f) => FIELD_LABEL[f]).join(", ")}. Os campos estão marcados em vermelho.`);
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
      // o id do aparelho (script de segurança) pesa na aprovação: espera até 3 s se ainda não ficou pronto
      for (let i = 0; i < 15 && !window.MP_DEVICE_SESSION_ID; i++) await new Promise((ok) => setTimeout(ok, 200));
      const r = await cardPayAction(token, {
        token: card.id,
        paymentMethodId: method.id,
        issuerId: method.issuerId,
        installments,
        deviceId: window.MP_DEVICE_SESSION_ID,
        holderName: name.trim(),
        holderCpf: doc.replace(/\D/g, ""),
      });
      handleReply(r);
    } finally {
      setPending(false);
    }
  }

  if (paid) return <p className="pay-result is-ok">Pagamento aprovado! Seus ingressos estão chegando…</p>;
  if (review)
    return (
      <p role="status" className="pay-result is-wait">
        {review.msg}
      </p>
    );

  const hint = (f: CardField) =>
    errors[f] ? (
      <span id={`${FIELD_ID[f]}-err`} role="alert" className="card-error">
        {errors[f]}
      </span>
    ) : null;
  const bad = (f: CardField) => (errors[f] ? " is-invalid" : "");

  return (
    <>
    {challenge && (
      <div className="tds-overlay" role="dialog" aria-modal="true" aria-labelledby="tds-title">
        <div className="tds-box">
          <p id="tds-title" className="tds-title">Confirme a compra com o seu banco</p>
          <p className="tds-text">O banco pediu uma confirmação de segurança (código por SMS, app do banco ou senha). Não feche esta página.</p>
          <form ref={challengeForm} method="post" action={challenge.url} target="mp-3ds" hidden>
            <input type="hidden" name="creq" value={challenge.creq} />
          </form>
          <iframe name="mp-3ds" title="Confirmação do banco" className="tds-frame" />
          <button type="button" className="tds-cancel" onClick={cancelChallenge}>
            Cancelar e escolher outra forma
          </button>
        </div>
      </div>
    )}
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
            if (errors.name && validName(e.target.value)) setFieldError("name", null);
          }}
          onBlur={() => {
            if (name.trim() && !validName(name)) setFieldError("name", FIELD_MSG.name);
          }}
          autoComplete="cc-name"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "card-name-err" : undefined}
        />
        {hint("name")}
        {!errors.name && <span className="card-tip">O cartão é de outra pessoa? Troque o nome e o CPF pelos do dono do cartão.</span>}
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
      {!ready && !loadError && <p className="card-hint card-field-full">Carregando os campos seguros do cartão…</p>}
      {error && (
        <div role="alert" className="pay-result is-error card-field-full">
          <p>{error}</p>
          {declines >= 2 && <p className="mt-1 font-semibold">Este cartão já foi recusado {declines} vezes. Novas tentativas costumam ser recusadas também.</p>}
          {declines > 0 && (
            <a href={`/pedido/${token}`} className="pay-switch">
              Pagar no Pix agora (aprovação na hora)
            </a>
          )}
        </div>
      )}
      <button className="btn solid card-field-full w-full" disabled={!ready || pending}>
        {pending ? "Processando…" : `Pagar ${(amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
      </button>
      <p className="card-hint card-field-full">🔒 Os dados do cartão vão direto para o Mercado Pago, com criptografia. A Pérolas não vê nem guarda o número do cartão.</p>
    </form>
    </>
  );
}
