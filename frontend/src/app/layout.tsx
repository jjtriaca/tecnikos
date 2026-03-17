import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import DeployGuard from "@/components/DeployGuard";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Tecnikos — Gestao Inteligente de Servicos Tecnicos",
    template: "%s | Tecnikos",
  },
  description: "Plataforma SaaS para empresas que gerenciam equipes de tecnicos em campo. Ordens de servico, despacho, financeiro e automacao.",
  metadataBase: new URL("https://tecnikos.com.br"),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tecnikos",
  },
  formatDetection: {
    telephone: true,
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
          <ToastProvider>
            <DeployGuard />
            <ServiceWorkerRegistration />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
