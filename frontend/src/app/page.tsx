import type { Metadata } from "next";
import LandingContent from "./LandingContent";

export const metadata: Metadata = {
  title: "Tecnikos — Sistema de Gestao de Serviços Técnicos | Software de OS Online",
  description: "Sistema de gestao de serviços tecnicos em campo. Ordens de serviço, despacho de tecnicos, controle financeiro, emissao de NFS-e e automacao inteligente. Para empresas de telecomunicacoes, climatizacao, energia solar, seguranca eletronica e mais.",
  keywords: [
    "sistema de gestao de serviços",
    "software de ordem de serviço",
    "sistema de OS online",
    "gestao de serviços tecnicos",
    "field service management",
    "software para prestadores de serviço",
    "gestao de equipes em campo",
    "despacho de tecnicos",
    "controle de ordens de serviço",
    "sistema para empresas de serviços",
    "app para tecnicos em campo",
    "software de gestao de manutencao",
    "sistema de OS com financeiro",
    "plataforma de gestao de serviços",
    "software FSM Brasil",
    "sistema de despacho de equipes",
    "controle de equipes externas",
    "gestao de tecnicos em campo",
    "software para telecomunicacoes",
    "sistema para climatizacao",
    "gestao energia solar",
    "software seguranca eletronica",
    "sistema manutencao piscinas",
    "gestao de serviços com NFS-e",
    "sistema de OS para pequenas empresas",
    "aplicativo gestao de tecnicos",
    "automacao de serviços tecnicos",
    "SaaS serviços tecnicos",
    "plataforma de OS online",
    "software gestao de serviços Brasil",
  ],
  openGraph: {
    title: "Tecnikos — Sistema de Gestao de Serviços Técnicos",
    description: "Plataforma completa para gestao de serviços tecnicos em campo. Ordens de serviço, despacho, financeiro, NFS-e e automacao em um so lugar.",
    url: "https://tecnikos.com.br",
    type: "website",
    locale: "pt_BR",
    siteName: "Tecnikos",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tecnikos — Sistema de Gestao de Serviços Técnicos",
    description: "Software de gestao de ordens de serviço, tecnicos em campo, financeiro e automacao.",
  },
  alternates: {
    canonical: "https://tecnikos.com.br",
  },
};

const jsonLdApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tecnikos",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Field Service Management",
  operatingSystem: "Web",
  inLanguage: "pt-BR",
  description: "Sistema de gestao de serviços tecnicos em campo. Ordens de serviço, despacho de tecnicos, controle financeiro, emissao de NFS-e e automacao inteligente. Para empresas de telecomunicacoes, climatizacao, energia solar, seguranca eletronica, piscinas e mais.",
  url: "https://tecnikos.com.br",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "BRL",
    lowPrice: "15",
    highPrice: "997",
    offerCount: "3",
    availability: "https://schema.org/InStock",
  },
  provider: {
    "@type": "Organization",
    name: "SLS Obras LTDA",
    legalName: "SLS Obras LTDA",
    taxID: "47.226.599/0001-40",
    url: "https://tecnikos.com.br",
    address: {
      "@type": "PostalAddress",
      addressCountry: "BR",
    },
  },
  featureList: [
    "Ordens de Serviço",
    "Gestao de Técnicos",
    "Controle Financeiro",
    "Automacao Inteligente",
    "Despacho em tempo real",
    "Emissao de NFS-e",
    "Dashboard e KPIs",
    "Portal do Técnico Mobile",
  ],
  audience: {
    "@type": "BusinessAudience",
    audienceType: "Empresas de serviços tecnicos em campo",
  },
};

const jsonLdOrg = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tecnikos",
  legalName: "SLS Obras LTDA",
  taxID: "47.226.599/0001-40",
  url: "https://tecnikos.com.br",
  description: "Plataforma SaaS de gestao de serviços tecnicos em campo",
  address: {
    "@type": "PostalAddress",
    addressCountry: "BR",
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }}
      />
      <LandingContent />
    </>
  );
}
