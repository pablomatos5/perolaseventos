// Dados de exemplo para desenvolvimento. Preços e quantidades são FICTÍCIOS: ajustar com a Pérolas.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const reais = (v: number) => v * 100;

async function main() {
  await db.event.deleteMany({ where: { slug: "reveillon-perolas-2k27" } });

  await db.event.create({
    data: {
      slug: "reveillon-perolas-2k27",
      name: "Réveillon Pérolas",
      edition: "2K27",
      // 31/12/2026 às 22h no horário de Belém (UTC-3)
      startsAt: new Date("2027-01-01T01:00:00Z"),
      venue: "Ponte do Assunção",
      city: "Cametá · PA",
      description: "O réveillon mais exclusivo de Cametá. Sete horas de open bar, atrações e a virada à beira do rio.",
      published: true,
      // Textos da própria Pérolas (Instagram). Local de 2027 confirmado no post oficial: Ponte do Assunção.
      highlights: {
        create: [
          { icon: "bar", title: "7 horas de open bar", description: "O open bar mais desejado de Cametá, do começo da festa ao amanhecer.", sortOrder: 1 },
          { icon: "crown", title: "Experiência premium", description: "Atmosfera encantadora, num cenário deslumbrante para brindar à vida.", sortOrder: 2 },
          { icon: "music", title: "Line-up a noite toda", description: "Atrações se revezando no palco até o primeiro sol do ano.", sortOrder: 3 },
          { icon: "fireworks", title: "Surpresas que transformam", description: "Detalhes que encantam e momentos guardados só para quem estiver lá.", sortOrder: 4 },
          { icon: "river", title: "Virada à beira do rio", description: "A virada de 2027 é de novo na Ponte do Assunção, de frente para o rio.", sortOrder: 5 },
          { icon: "security", title: "Entrada por QR code", description: "Ingresso nominal no celular, validado na portaria. Sem fila de papel, sem falsificação.", sortOrder: 6 },
        ],
      },
      // 1ª atração confirmada (último story do destaque 2K27, 10/09/2026) + 3 vagas "Em breve".
      // Foto e vídeo vêm do próprio anúncio da Pérolas (public/atracoes).
      attractions: {
        create: [
          {
            name: "Baltazar",
            genre: "1ª atração confirmada",
            headliner: true,
            instagram: "alexandrebaltazar_",
            imageUrl: "/atracoes/baltazar-capa.jpg", // foto do perfil dele (@alexandrebaltazar_), com fogos atrás
            videoUrl: "/atracoes/baltazar.mp4",
            sortOrder: 1,
          },
          {
            name: "DJ Caçulinha",
            genre: "2ª atração confirmada",
            instagram: "djcaculinha_ofc",
            imageUrl: "/atracoes/dj-caculinha-capa.jpg", // quadro do "Set audiovisual 4K" do YouTube dele
            videoUrl: "/atracoes/dj-caculinha.mp4",
            sortOrder: 2,
          },
          {
            name: "Guilherme Menezes",
            genre: "3ª atração confirmada",
            instagram: "guilhermemenezesgm",
            imageUrl: "/atracoes/guilherme-menezes-avatar.jpg", // só a foto de perfil (150 px): vai em medalhão
            sortOrder: 3,
          },
          { name: "", announced: false, sortOrder: 4 },
        ],
      },
      ticketTypes: {
        create: [
          {
            name: "Pista Open Bar",
            description: "Acesso à pista e 7 horas de open bar.",
            sortOrder: 1,
            batches: {
              create: [
                // 1º lote já esgotado, para a tela mostrar a virada de lote
                { name: "1º lote", sortOrder: 1, priceCents: reais(150), quantity: 100, closedAt: new Date() },
                { name: "2º lote", sortOrder: 2, priceCents: reais(180), quantity: 150 },
                { name: "3º lote", sortOrder: 3, priceCents: reais(220), quantity: 150 },
                { name: "Lote final", sortOrder: 4, priceCents: reais(260), quantity: 100 },
              ],
            },
          },
          {
            name: "Camarote Pérola",
            description: "Área exclusiva com vista para o rio, open bar premium e espaço para sentar.",
            sortOrder: 2,
            maxPerOrder: 6,
            batches: {
              create: [
                { name: "1º lote", sortOrder: 1, priceCents: reais(350), quantity: 40 },
                { name: "2º lote", sortOrder: 2, priceCents: reais(420), quantity: 40 },
              ],
            },
          },
          {
            name: "Cortesia / Lista",
            sortOrder: 99,
            batches: { create: [{ name: "Cortesia", sortOrder: 1, priceCents: 0, quantity: 50, hidden: true }] },
          },
        ],
      },
    },
  });
  console.log("Seed ok: Réveillon Pérolas 2K27");
}

main().finally(() => db.$disconnect());
