import type { MetadataRoute } from "next";

// Buscadores só indexam o site público; páginas de pedido, ingresso, painel e portaria ficam de fora.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "https://perolaseventos.store";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/portaria", "/pedido/", "/i/", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
