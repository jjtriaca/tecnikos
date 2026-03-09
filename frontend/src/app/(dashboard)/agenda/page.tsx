"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Redirect: agenda was moved to /orders as a tab
export default function AgendaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/orders?tab=agenda");
  }, [router]);
  return (
    <div className="flex items-center justify-center py-20 text-sm text-slate-400">
      Redirecionando para Ordens de Servico...
    </div>
  );
}
