import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar Conta",
  description: "Cadastre sua empresa no Tecnikos. Plataforma de gestao de serviços tecnicos em campo com ordens de serviço, despacho e financeiro.",
  openGraph: {
    title: "Cadastre-se no Tecnikos",
    description: "Crie sua conta e comece a gerenciar seus serviços tecnicos em minutos.",
    url: "https://tecnikos.com.br/signup",
  },
  alternates: {
    canonical: "https://tecnikos.com.br/signup",
  },
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
