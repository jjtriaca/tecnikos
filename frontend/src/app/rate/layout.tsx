import type { Metadata } from "next";
import { headers } from "next/headers";

// SSR fetch precisa de URL absoluta (Node.js nao resolve `/api` relativo).
// Mesmo padrao das rotas publicas /q/[token] e /p/[token]. Em prod o frontend
// roda no container "frontend" e o backend em "backend"; `INTERNAL_BACKEND_URL`
// aponta pro container interno. Como o backend nao tem `setGlobalPrefix('api')`,
// a URL interna eh direto `http://backend:4000` (sem /api).
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
    const parts = host.split(":")[0].split(".");
    if (parts.length < 3) return null; // dominio raiz (tecnikos.com.br) — sem tenant
    const slug = parts[0].toLowerCase();
    if (["www", "api", "admin", "app", "static", "cdn"].includes(slug)) return null;
    return slug;
  } catch {
    return null;
  }
}

async function fetchBranding(slug: string): Promise<BrandingInfo | null> {
  try {
    const isInternal =
      INTERNAL_API.startsWith("http://backend") || INTERNAL_API.startsWith("http://localhost");
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
  const faviconUrl = branding?.logos.favicon32 || "/favicon.svg";
  const appleTouchUrl = branding?.logos.appleTouch || "/apple-touch-icon.png";

  return {
    title: `Avaliacao de Serviço — ${companyName}`,
    description: `Avalie o atendimento realizado por ${companyName}`,
    icons: {
      icon: [{ url: faviconUrl, type: faviconUrl.endsWith(".svg") ? "image/svg+xml" : "image/png" }],
      apple: [{ url: appleTouchUrl, sizes: "180x180", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: companyName,
      title: `Avaliacao de Serviço — ${companyName}`,
      description: `Avalie o atendimento realizado por ${companyName}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: companyName }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Avaliacao de Serviço — ${companyName}`,
      description: `Avalie o atendimento realizado por ${companyName}`,
      images: [ogImageUrl],
    },
  };
}

export default async function RateLayout({ children }: { children: React.ReactNode }) {
  const slug = await resolveTenantSlug();
  const branding = slug ? await fetchBranding(slug) : null;
  const companyName = branding?.companyName || null;
  const logoUrl = branding?.logos?.icon512 || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/40">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-8">
        {/* Cabecalho de marca do tenant — identifica a empresa pra quem avalia.
            Server-rendered: aparece instantaneo e persiste nos estados de erro/sucesso.
            Sem branding resolvido (dominio raiz/custom), mostra titulo neutro. */}
        <div className="mb-6 flex flex-col items-center text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={companyName || "Logo da empresa"}
              className="mb-3 h-16 w-16 rounded-2xl bg-white object-contain shadow-sm ring-1 ring-slate-200"
            />
          ) : null}
          {companyName ? (
            <p className="text-lg font-bold text-slate-800">{companyName}</p>
          ) : (
            <p className="text-base font-semibold text-slate-600">Avaliacao de Serviço</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
