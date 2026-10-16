// Conteúdo institucional, levantado do @perolaseventos (posts públicos + destaques, lidos em 15/10/2026).
// Tudo aqui é texto da própria Pérolas ou fato publicado por ela. Revisar com a equipe antes de publicar.

/** Tema de cores ativo (globals.css → [data-edition]). "2k26" = azul oceano; "2k27" = lilás "nova era". */
export const CURRENT_EDITION = "2k27";

/** Campanha da 6ª edição: artes oficiais 2027 ("Um novo ciclo. Infinitas possibilidades."). */
export const campaign = {
  tagline: "Um novo ciclo. Infinitas possibilidades.",
  pillars: ["Momentos inesquecíveis", "Detalhes que encantam", "Surpresas que transformam"],
  closing: ["Algo grandioso.", "Algo único.", "Algo Pérolas."],
};

/** Legenda do anúncio da 5ª edição. */
export const manifesto = ["Mais que uma festa.", "É um ritual.", "É o nosso momento.", "É a virada que você merece."];

/** Linha do tempo. A 5ª edição foi o Réveillon 2026; logo, 2027 é a 6ª. */
export const history = [
  {
    year: "2K25",
    title: "4ª edição",
    text: "A 4ª edição, guardada no destaque TBT 2K25 do nosso Instagram.",
  },
  {
    year: "2K26",
    title: "5ª edição",
    text: "Ponte do Assunção, 7 horas de open bar e mais de 500 participantes. 70% dos ingressos saíram 11 dias antes da virada.",
    lineup: ["Davi Alencar", "Rebelo", "DJ Ferrugem", "Swing do Panda"],
  },
  {
    year: "2K27",
    title: "6ª edição",
    text: "Uma nova era. Lotes abertos e, ao atingir 100%, as vendas encerram sem reabertura.",
    current: true,
  },
];

export const stats = [
  { value: "6ª", label: "edição" },
  { value: "500+", label: "participantes em 2026" },
  { value: "7h", label: "de open bar" },
];

/** Artistas que já passaram pelo palco (destaque "Atrações", edição 2026). @ conferidos nos stories. */
// Fotos tiradas do Instagram de cada artista (public/atracoes). `focus` = object-position no card.
export const pastLineup = [
  { name: "Davi Alencar", instagram: "davialenncar", imageUrl: "/atracoes/davi-alencar.jpg", focus: "50% 30%" },
  { name: "Rebelo", instagram: "rebelodj_", imageUrl: "/atracoes/rebelo.jpg", focus: "50% 45%" },
  { name: "DJ Ferrugem", instagram: "dj.ferrugem", imageUrl: "/atracoes/dj-ferrugem.jpg", focus: "50% 25%" },
  { name: "Swing do Panda", instagram: "swingdopanda", imageUrl: "/atracoes/swing-do-panda.jpg", focus: "50% 70%" },
];

/** Faixa rolando logo abaixo da praia (palavras da própria campanha e dos posts). */
export const ticker = [
  "7 horas de open bar",
  "Momentos inesquecíveis",
  "Detalhes que encantam",
  "Surpresas que transformam",
  "Uma nova era",
  "Experiência premium",
  "Algo Pérolas",
  "A virada que você merece",
];

/**
 * Destaque "Relatos". Frases curtas de stories repostados pela Pérolas.
 * Convidados ficam anônimos de propósito; artista vai com o nome.
 */
export const testimonials = [
  { quote: "Fechando com chave de ouro. Tamo no maior Réveillon de Cametá.", author: "Rebelo", role: "DJ, Réveillon 2026" },
  { quote: "Passagem de som ok, estrutura tá impecável.", author: "Rebelo", role: "antes da virada 2026" },
  { quote: "O maior open está online.", author: "Convidada", role: "Réveillon 2026" },
  { quote: "No melhor réveillon da cidade.", author: "Convidado", role: "Réveillon 2026" },
  { quote: "Partiu último show do ano.", author: "DJ Ferrugem", role: "Réveillon 2026" },
];

/**
 * Vídeos do Réveillon 2026 (reels do @perolaseventos de 03/01/2026), cortados em 12 s e comprimidos
 * (480x640, ~1 MB) em /public/edicoes. Cada um leva um relato por cima. Brutos em .midia-bruta/videos.
 */
export const pastVideos: { src: string; poster: string; alt: string; quote?: string; author?: string; role?: string }[] = [
  { src: "/edicoes/2026-1.mp4", poster: "/edicoes/2026-1.jpg", alt: "Pista lotada sob as luzes no Réveillon Pérolas 2026", ...testimonials[0] },
  { src: "/edicoes/2026-2.mp4", poster: "/edicoes/2026-2.jpg", alt: "DJ no palco do Réveillon Pérolas 2026", ...testimonials[2] },
  { src: "/edicoes/2026-3.mp4", poster: "/edicoes/2026-3.jpg", alt: "Público de branco curtindo a virada 2026", ...testimonials[3] },
  { src: "/edicoes/2026-4.mp4", poster: "/edicoes/2026-4.jpg", alt: "Show na virada do Réveillon Pérolas 2026", ...testimonials[1] },
  { src: "/edicoes/2026-5.mp4", poster: "/edicoes/2026-5.jpg", alt: "Galera dançando no Réveillon Pérolas 2026", ...testimonials[4] },
  { src: "/edicoes/2026-6.mp4", poster: "/edicoes/2026-6.jpg", alt: "DJ animando a pista no Réveillon Pérolas 2026" },
];

/**
 * Patrocinadores anunciados para o Réveillon 2026 (posts "Patrocinador Oficial Confirmado!" de dez/2025).
 * Confirmar quem renova para 2027. `instagram`: perfil marcado no anúncio.
 * `image`: painel do logo recortado do cartaz-anúncio da Pérolas (720x360, em /public/patrocinadores);
 * `light: true` = logo sobre fundo branco (foto de perfil pequena), mostrado inteiro e centralizado.
 * Sem `image`: cartão só com o nome (Bió Costa: o cartaz dele é propaganda de casa de apostas — ver HANDOFF).
 */
export const sponsors2026: { name: string; instagram?: string; image?: string; light?: boolean }[] = [
  { name: "FB Import & Perfumaria", instagram: "fb.import__", image: "/patrocinadores/fb-import.jpg" },
  { name: "Maju Modas & Maria Bonita", image: "/patrocinadores/maju-maria-bonita.jpg" },
  { name: "Lucas Amorim Advocacia", instagram: "adv.lucaamoriim", image: "/patrocinadores/lucas-amorim.jpg" },
  { name: "Sr Drink", instagram: "sr.drink_oficial", image: "/patrocinadores/sr-drink.jpg", light: true },
  { name: "Dr. André Luiz · Odontologia", instagram: "dr.andre_luizc", image: "/patrocinadores/dr-andre-luiz.jpg" },
  { name: "Bió Costa & Janaina Costa", instagram: "costa_bio" },
];

/** Perguntas respondidas com o que o sistema garante e o que a Pérolas já publicou. */
export const faq = [
  {
    q: "Como recebo meu ingresso?",
    a: "Assim que o pagamento é aprovado, você recebe um link com seus QR codes por e-mail (e pelo WhatsApp, se marcar a opção). O mesmo link fica disponível sempre que precisar.",
  },
  {
    q: "Quais formas de pagamento?",
    a: "Pix ou cartão de crédito em até 12x, pelo Mercado Pago. Seus ingressos ficam reservados por 15 minutos enquanto você paga.",
  },
  {
    q: "Como funcionam os lotes?",
    a: "Os ingressos são limitados e vendidos por lotes. Quando um lote esgota, o próximo abre com novo valor. Ao atingir 100% das vendas, os ingressos encerram definitivamente, sem reabertura ou exceções.",
  },
  {
    q: "Quem tem direito à meia-entrada?",
    a: "Estudantes, pessoas com deficiência, jovens de baixa renda e idosos, conforme a Lei 12.933/2013. O documento é conferido na entrada.",
  },
  {
    q: "Posso mandar print do QR para outra pessoa?",
    a: "Cada QR vale uma única entrada. Depois de lido na portaria, o mesmo código não passa de novo, então não compartilhe seus ingressos.",
  },
];
