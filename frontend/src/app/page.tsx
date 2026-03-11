import type { Metadata } from "next";
import LandingContent from "./LandingContent";

export const metadata: Metadata = {
  title: "Tecnikos — Gestao Inteligente de Servicos Tecnicos | Field Service Management",
  description: "Plataforma SaaS para gestao de servicos tecnicos em campo. Ordens de servico, despacho de tecnicos, controle financeiro e automacao. Comece gratis.",
  keywords: [
    "gestao de servicos tecnicos",
    "field service management",
    "ordens de servico",
    "gestao de tecnicos",
    "despacho de tecnicos",
    "automacao de servicos",
    "software para prestadores de servico",
    "gestao de equipes em campo",
    "SaaS servicos tecnicos",
    "plataforma de OS",
  ],
  openGraph: {
    title: "Tecnikos — Gestao Inteligente de Servicos Tecnicos",
    description: "Plataforma completa para empresas que gerenciam equipes de tecnicos em campo. Ordens de servico, despacho, financeiro e automacao em um so lugar.",
    url: "https://tecnikos.com.br",
    type: "website",
    locale: "pt_BR",
    siteName: "Tecnikos",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tecnikos — Gestao Inteligente de Servicos Tecnicos",
    description: "Plataforma SaaS para gestao de equipes de tecnicos em campo.",
  },
  alternates: {
    canonical: "https://tecnikos.com.br",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tecnikos",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Plataforma SaaS para gestao de servicos tecnicos em campo. Ordens de servico, despacho de tecnicos, controle financeiro e automacao.",
  url: "https://tecnikos.com.br",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "BRL",
    lowPrice: "197",
    highPrice: "997",
    offerCount: "3",
  },
  provider: {
    "@type": "Organization",
    name: "SLS Obras LTDA",
    url: "https://tecnikos.com.br",
    address: {
      "@type": "PostalAddress",
      addressCountry: "BR",
    },
  },
  featureList: [
    "Ordens de Servico",
    "Gestao de Tecnicos",
    "Controle Financeiro",
    "Automacao Inteligente",
    "Despacho em tempo real",
    "Emissao de NFS-e",
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingContent />
    </>
  );
}
