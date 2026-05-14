import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Acesse sua conta Tecnikos. Plataforma de gestao de serviços tecnicos em campo.",
  openGraph: {
    title: "Login — Tecnikos",
    description: "Acesse sua conta para gerenciar seus serviços tecnicos.",
    url: "https://tecnikos.com.br/login",
  },
  alternates: {
    canonical: "https://tecnikos.com.br/login",
  },
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
