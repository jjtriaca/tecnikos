import type { Metadata } from "next";
import { headers } from "next/headers";

const INTERNAL_API = process.env.NEXT_PUBLIC_API_URL || "http://backend:4000";

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
    const res = await fetch(`${INTERNAL_API}/api/public/tenant/${slug}/branding`, {
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
