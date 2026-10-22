import type { NextConfig } from "next";

// Cabeçalhos de segurança em todas as respostas. A CSP só vale em produção (o `next dev` precisa de eval).
// 'unsafe-inline' em script: o Next injeta scripts inline de hidratação; sem nonce isso é o necessário.
const csp = [
  "default-src 'self'",
  // Mercado Pago: SDK, campos seguros do cartão e script de segurança do aparelho (pagamento dentro do site)
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://sdk.mercadopago.com https://www.mercadopago.com https://*.mlstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.mlstatic.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com",
  "media-src 'self'",
  "font-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com https://*.mlstatic.com",
  "frame-src https://challenges.cloudflare.com https://*.mercadopago.com https://*.mercadolibre.com https://*.mercadolivre.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // o link do pedido (/pedido/<token>) nunca vaza inteiro para outros sites
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // câmera só para a portaria (mesmo site); o resto desligado
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // build enxuto para a imagem Docker da VPS (Dockerfile copia .next/standalone)
  output: "standalone",
  poweredByHeader: false,
  // fontes do ingresso em PDF são lidas do disco em tempo de execução: incluir no build
  outputFileTracingIncludes: {
    "/pedido/[token]/pdf": ["./assets/fonts/**", "./assets/pdf/**"],
    "/i/[token]/pdf": ["./assets/fonts/**", "./assets/pdf/**"],
    "/pedido/[token]/story": ["./assets/fonts/**", "./assets/story/**"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // páginas com dados pessoais/QR: nunca em cache compartilhado
      { source: "/(pedido|i|admin|portaria)/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Só afeta o `next dev`: libera abrir o site pelo IP da rede local (testar no celular).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "localhost", "127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
