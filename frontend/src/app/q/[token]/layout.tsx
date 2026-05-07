import type { Metadata } from "next";
import { headers } from "next/headers";

// SSR fetch precisa de URL absoluta (Node.js nao resolve `/api` relativo).
// Em prod o frontend roda no container "frontend" e o backend em "backend".
// `NEXT_PUBLIC_API_URL` vale `/api` em prod (pra browser usar via rewrite Next.js),
// entao usamos uma var separada `INTERNAL_BACKEND_URL` pro SSR. Como o backend
// nao tem `setGlobalPrefix('api')`, a URL eh direto `http://backend:4000`.
const INTERNAL_API =
  process.env.INTERNAL_BACKEND_URL ||
  (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.startsWith("/")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://backend:4000");

interface BrandingInfo {
  tenantSlug: string;
  tenantName: string;
  companyName: string;
  hasCustomLogo: boolean;
  logos: {
    og: string;
    favicon32: string;
    icon192: string;
    icon512: string;
    appleTouch: string;
  };
}

/**
 * Resolve tenant slug pelo subdominio (ex: "sls" em "sls.tecnikos.com.br").
 * Usa header `host` do request server-side.
 */
async function resolveTenantSlug(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get("host") || "";
    // Pega primeira parte do subdominio
    const parts = host.split(":")[0].split(".");
    if (parts.length < 3) return null; // dominio raiz (tecnikos.com.br) — sem tenant
    const slug = parts[0].toLowerCase();
    // Filtra subdominios reservados (www, api, admin, etc)
    if (["www", "api", "admin", "app", "static", "cdn"].includes(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

async function fetchBranding(slug: string): Promise<BrandingInfo | null> {
  try {
    // Backend nao tem `setGlobalPrefix('api')` — controller `public/tenant` mapeia
    // direto. Quando SSR sai pelo container interno (http://backend:4000), o path
    // eh sem `/api`. Quando SSR aponta pra dominio externo (HTTPS), o nginx rewrita
    // `/api/*` -> backend, entao o path precisa do `/api` na frente.
    const isInternal = INTERNAL_API.startsWith("http://backend") || INTERNAL_API.startsWith("http://localhost");
    const path = isInternal
      ? `/public/tenant/${slug}/branding`
      : `/api/public/tenant/${slug}/branding`;
    const res = await fetch(`${INTERNAL_API}${path}`, {
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const slug = await resolveTenantSlug();
  const branding = slug ? await fetchBranding(slug) : null;

  const companyName = branding?.companyName || "Tecnikos";
  const ogImageUrl = branding
    ? `https://${slug}.tecnikos.com.br${branding.logos.og}`
    : "https://tecnikos.com.br/icons/icon-512.png";
  const faviconUrl = branding
    ? `${branding.logos.favicon32}`
    : "/favicon.svg";
  const appleTouchUrl = branding
    ? `${branding.logos.appleTouch}`
    : "/apple-touch-icon.png";

  return {
    title: `Orçamento — ${companyName}`,
    description: `Orçamento de serviço — ${companyName}`,
    icons: {
      icon: [{ url: faviconUrl, type: faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/png" }],
      apple: [{ url: appleTouchUrl, sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: companyName,
      title: `Orçamento — ${companyName}`,
      description: `Orçamento de serviço emitido por ${companyName}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: companyName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Orçamento — ${companyName}`,
      description: `Orçamento de serviço emitido por ${companyName}`,
      images: [ogImageUrl],
    },
  };
}

export default function QuotePublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
