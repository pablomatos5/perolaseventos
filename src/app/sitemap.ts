import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "https://perolaseventos.store";
  return [{ url: `${base}/`, changeFrequency: "daily", priority: 1 }];
}
