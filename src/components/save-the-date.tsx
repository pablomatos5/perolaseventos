import { Star4 } from "@/components/hero-2027";

/**
 * "Save the date" como o post oficial da campanha 2027: a sereia (recorte da arte, em /public/2027)
 * à esquerda e a data/local à direita, chamando para os ingressos logo abaixo.
 */
export function SaveTheDate({ day, month, venue }: { day: string; month: string; venue: string }) {
  return (
    <section className="save-date" aria-labelledby="save-date-titulo">
      {/* eslint-disable-next-line @next/next/no-img-element -- recorte da arte oficial, já otimizado */}
      <img src="/2027/sereia-esq.webp" alt="Sereia da campanha Réveillon Pérolas 2027 sobre as pedras, com a concha e as pérolas" className="save-date-mermaid" loading="lazy" />
      <div className="save-date-copy">
        <span className="save-date-rule" aria-hidden>
          <i />
          <Star4 className="size-3" />
          <i />
        </span>
        <h2 id="save-date-titulo" className="save-date-title">
          Save
          <small>the</small>
          Date
        </h2>
        <span className="save-date-rule" aria-hidden>
          <i />
          <Star4 className="size-3" />
          <i />
        </span>
        <p className="save-date-when">
          <strong>{day}</strong>
          <span>{month}</span>
        </p>
        <p className="save-date-venue">{venue}</p>
        <a href="#ingressos" className="btn solid mt-6">
          Garantir meu ingresso
        </a>
      </div>
    </section>
  );
}
