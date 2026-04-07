"use client";

import { BOLETO_STATUS_CONFIG } from "@/types/finance";

export default function BoletoStatusBadge({ status }: { status: string }) {
  const cfg = BOLETO_STATUS_CONFIG[status] || BOLETO_STATUS_CONFIG.DRAFT;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.color} ${cfg.bgColor} ${cfg.borderColor}`}
    >
      {cfg.label}
    </span>
  );
}
