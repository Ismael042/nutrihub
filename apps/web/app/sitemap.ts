import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nutrihub.isdev.online";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/paciente", "/login", "/cadastro"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date()
  }));
}
