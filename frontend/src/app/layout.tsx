import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tecnikos — Gestao Inteligente de Servicos Tecnicos",
    template: "%s | Tecnikos",
  },
  description: "Plataforma SaaS para empresas que gerenciam equipes de tecnicos em campo. Ordens de servico, despacho, financeiro e automacao.",
  metadataBase: new URL("https://tecnikos.com.br"),
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://tecnikos.com.br",
    siteName: "Tecnikos",
    title: "Tecnikos — Gestao Inteligente de Servicos Tecnicos",
    description: "Plataforma SaaS para empresas que gerenciam equipes de tecnicos em campo. Ordens de servico, despacho, financeiro e automacao.",
  },
  twitter: {
    card: "summary",
    title: "Tecnikos — Gestao Inteligente de Servicos Tecnicos",
    description: "Plataforma SaaS para empresas que gerenciam equipes de tecnicos em campo.",
  },
  alternates: {
    canonical: "https://tecnikos.com.br",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
