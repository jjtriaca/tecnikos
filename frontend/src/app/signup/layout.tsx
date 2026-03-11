import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar Conta",
  description: "Cadastre sua empresa no Tecnikos. Plataforma de gestao de servicos tecnicos em campo com ordens de servico, despacho e financeiro.",
  openGraph: {
    title: "Cadastre-se no Tecnikos",
    description: "Crie sua conta e comece a gerenciar seus servicos tecnicos em minutos.",
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
