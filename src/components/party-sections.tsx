import { cloneElement } from "react";
import { AttractionCards } from "@/components/attraction-cards";
import { PerkTrail } from "@/components/perk-trail";
import { SponsorCarousel } from "@/components/story-sections";
import type { Attraction, Highlight } from "@/generated/prisma/client";

// Ícones em linha fina (stroke = currentColor), desenhados para o tamanho 28px.
const ICONS: Record<string, React.ReactElement<React.SVGProps<SVGPathElement>>> = {
  bar: <path d="M6 4h16l-7 9v8m-4 0h8M9 8h10" />,
  river: <path d="M3 10c3-3 5-3 8 0s5 3 8 0 4-2 6-1M3 16c3-3 5-3 8 0s5 3 8 0 4-2 6-1M3 22c3-3 5-3 8 0s5 3 8 0 4-2 6-1" />,
  fireworks: <path d="M14 14V3m0 11 7.8-7.8M14 14h11m-11 0 7.8 7.8M14 14v11m0-11-7.8 7.8M14 14H3m11 0L6.2 6.2" />,
  crown: <path d="M4 21h20M5 18 3 8l6 4 5-7 5 7 6-4-2 10H5Z" />,
  music: <path d="M10 21V6l13-3v15M10 21a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm13-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />,
  security: <path d="M14 3 5 6v7c0 6 4 10 9 12 5-2 9-6 9-12V6l-9-3Zm-4 11 3 3 6-6" />,
  food: <path d="M7 3v9a3 3 0 0 0 6 0V3M10 3v22M19 3c-2 2-3 5-3 9h3v13" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 28 28" className="size-7 text-accent" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {cloneElement(ICONS[name] ?? ICONS.music, { pathLength: 1 })}
    </svg>
  );
}

export function PartyDetails({ highlights }: { highlights: Highlight[] }) {
  if (!highlights.length) return null;
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8 md:py-28">
      <span className="eyebrow rule">A festa</span>
      <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
        Uma noite para <em>colecionar</em>
      </h2>
      <div className="mt-14 md:mt-20">
        <PerkTrail items={highlights.map((h) => ({ id: h.id, title: h.title, description: h.description, icon: <Icon name={h.icon} /> }))} />
      </div>
    </section>
  );
}

export function Lineup({ attractions }: { attractions: Attraction[] }) {
  if (!attractions.length) return null;
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="ambient-glow -right-40 top-10 size-[28rem] bg-ocean opacity-20" />
      <div className="relative mx-auto w-full max-w-6xl px-5 md:px-8">
        <span className="eyebrow rule">Atrações</span>
        <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)]!">
          Quem faz a <em>virada</em>
        </h2>
        <p className="mt-4 max-w-xl text-fg-muted">O line-up da 6ª edição está sendo revelado aos poucos. Vire as cartas.</p>
        <div className="mt-12">
          <AttractionCards
            attractions={attractions.map((a) => ({
              id: a.id,
              name: a.name,
              genre: a.genre,
              time: a.time,
              announced: a.announced,
              headliner: a.headliner,
              instagram: a.instagram,
              imageUrl: a.imageUrl,
              videoUrl: a.videoUrl,
            }))}
          />
        </div>

        <span className="eyebrow rule mt-24 flex">Patrocinadores</span>
        <h3 className="display mt-4 text-[clamp(2rem,4.5vw,3.4rem)]!">
          Quem brindou com a gente em <em>2026</em>
        </h3>
        <div className="mt-10">
          <SponsorCarousel />
        </div>
      </div>
    </section>
  );
}
