import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/ctrl-zr8k2x", "/api/"],
      },
    ],
    sitemap: "https://tecnikos.com.br/sitemap.xml",
  };
}
